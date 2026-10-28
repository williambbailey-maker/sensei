// Analytics — instrumentation for the Sensei app.
//
// Two sinks, same events:
//   - Supabase (first-party): one `pageviews` row per page load and one `events`
//     row per behavior event. Readable straight from the database with no
//     third-party key — this is what "what are the stats?" reads.
//   - PostHog: the same events, for its dashboards. Optional; no-op without a key.
//
// Every event carries the six properties ANALYTICS.md mandates — `brand`,
// `product_key`, `dispensary`, `neighborhood`, `page_type`, `source` — with no
// exceptions. Identity: a per-tab session id (sessionStorage) and a persistent
// visitor id (localStorage), so returning people aren't counted as new visitors
// and reloads don't inflate pageviews.
import posthog from 'posthog-js'
import { supabase } from './supabase'
import { initMetaPixel, metaTrack } from './metaPixel'

// The project key is public (write-only, ships in the bundle) — baked as a
// fallback like the Supabase anon key, so analytics works out of the box. Env
// vars win; set VITE_POSTHOG_KEY='' to disable.
const KEY =
  (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ??
  'phc_rqqTjemCGcjixkB3oiNQgB2L9w4yRGyZcYK3iP4mEcXX'
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'

let on = false
// Events sent in the same tap can reach the server out of order; this
// per-page counter (props.seq) gives the true order.
let seq = 0
let source = 'direct'
let internal = false

// source ∈ {organic, direct, qr, social, ad}. Derived once at load from the
// URL (UTM / ?src=qr-<batch>) then the referrer. Anything we can't place as
// search, social, qr or ad is `direct`.
export function deriveSource(): string {
  try {
    const q = new URLSearchParams(location.search)
    const s = (q.get('src') || '').toLowerCase()
    if (s.startsWith('qr')) return 'qr'
    const med = (q.get('utm_medium') || '').toLowerCase()
    const usrc = (q.get('utm_source') || '').toLowerCase()
    if (['cpc', 'ppc', 'paid', 'paidsearch', 'display'].includes(med) || /ad/.test(usrc)) return 'ad'
    const ref = document.referrer
    if (!ref) return 'direct'
    const host = new URL(ref).hostname.replace(/^www\./, '')
    if (host === location.hostname) return 'direct'
    if (/(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave)\./.test(host) || host.includes('search'))
      return 'organic'
    if (/(instagram|facebook|t\.co|twitter|x\.com|reddit|tiktok|linkedin|youtube|pinterest|threads)/.test(host))
      return 'social'
    return 'direct'
  } catch {
    return 'direct'
  }
}

// Canonical product key = slug(brand + name). Matches the SEO generator and the
// `clean_brand`/`clean_name` pairing used as the pipeline match definition, so
// the same product carries the same key on the pages and in the app.
export function productKey(brand?: string | null, name?: string | null): string {
  const s = `${brand || ''} ${name || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'unknown'
}

// Crawlers, link previews and automated browsers (headless Chrome, Playwright,
// Lighthouse) are not visitors; navigator.webdriver is set by automation tools.
const isBot = () =>
  /bot|crawl|spider|slurp|preview|headless|lighthouse|phantomjs/i.test(navigator.userAgent) ||
  (typeof navigator !== 'undefined' && navigator.webdriver === true)
const device = () => (/Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop')

function storedId(store: Storage, key: string): string {
  try {
    let v = store.getItem(key)
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36)
      store.setItem(key, v)
    }
    return v
  } catch {
    return 'na'
  }
}
const sessionId = () => storedId(sessionStorage, 'sensei_sid') // per tab
const visitorId = () => storedId(localStorage, 'sensei_vid') // persistent

// Self-exclusion: visiting ?me=1 once flags this browser as internal (our own
// devices); ?me=0 clears it. Internal rows are still logged but excluded from
// every stat, along with any earlier rows from the same visitor id.
function internalFlag(): boolean {
  try {
    const me = new URLSearchParams(location.search).get('me')
    if (me === '1') localStorage.setItem('sensei_internal', '1')
    else if (me === '0') localStorage.removeItem('sensei_internal')
    return localStorage.getItem('sensei_internal') === '1'
  } catch {
    return false
  }
}

// Coarse location (country / region / city) from /api/geo, which reads Vercel's
// edge headers. Fetched once per session and cached; no IP is ever stored.
type Geo = { country: string | null; region: string | null; city: string | null }
const NO_GEO: Geo = { country: null, region: null, city: null }
let geo: Geo = NO_GEO
async function loadGeo(): Promise<Geo> {
  try {
    const cached = sessionStorage.getItem('sensei_geo')
    if (cached) return (geo = JSON.parse(cached) as Geo)
    const r = await fetch('/api/geo', { cache: 'no-store' })
    if (!r.ok) return NO_GEO
    const g = (await r.json()) as Geo
    geo = { country: g.country ?? null, region: g.region ?? null, city: g.city ?? null }
    sessionStorage.setItem('sensei_geo', JSON.stringify(geo))
    return geo
  } catch {
    return NO_GEO
  }
}

// Client-side signals the connection IP cannot fake. A visitor's device
// timezone and screen size come from the browser itself, so they tell us where
// someone actually is even when a mobile carrier gateway geolocates the IP to
// another state. Used only to sanity-check paid traffic; nothing identifying.
function clientSignals(): { tz: string | null; sw: number | null; sh: number | null } {
  try {
    return {
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      sw: typeof screen !== 'undefined' ? screen.width : null,
      sh: typeof screen !== 'undefined' ? screen.height : null,
    }
  } catch {
    return { tz: null, sw: null, sh: null }
  }
}

// The link's own tags, stored as typed: ?src=… and the utm_* set, plus whether
// the click carried an ad-network click id. `source` above is only a coarse
// guess; these let the report tell one ad, flyer or link from another.
function linkTags(): Record<string, string | boolean | null> {
  try {
    const q = new URLSearchParams(location.search)
    const v = (k: string) => (q.get(k) || '').trim().slice(0, 120) || null
    return {
      src: v('src'),
      utm_source: v('utm_source'),
      utm_medium: v('utm_medium'),
      utm_campaign: v('utm_campaign'),
      utm_content: v('utm_content'),
      click_id: q.has('fbclid') || q.has('gclid') || q.has('ttclid'),
    }
  } catch {
    return {}
  }
}

// First-party pageview → Supabase. Deduped: one row per page per session per
// 30 minutes, so reloads and service-worker refreshes don't count twice.
async function beacon(): Promise<void> {
  try {
    if (isBot()) return
    await loadGeo()
    const k = 'sensei_pv_' + location.pathname
    const last = Number(sessionStorage.getItem(k) || 0)
    if (Date.now() - last < 30 * 60 * 1000) return
    sessionStorage.setItem(k, String(Date.now()))
    let referrer: string | null = null
    try {
      referrer = document.referrer ? new URL(document.referrer).hostname : null
    } catch {
      /* ignore */
    }
    void supabase
      .from('pageviews')
      .insert({
        path: location.pathname,
        page_type: 'app',
        source,
        referrer,
        session_id: sessionId(),
        visitor_id: visitorId(),
        device: device(),
        internal,
        ...geo,
        ...clientSignals(),
        ...linkTags(),
      })
      .then(
        () => undefined,
        () => undefined,
      )
  } catch {
    /* never let analytics break the app */
  }
}

// How long a visit stays and how far it scrolls. Passive signals: recorded,
// but not counted as "did something" (supabase/traffic.sql lists them).
// Time counts only while the tab is on screen: one event at 10, 30, 60 and
// 180 seconds.
function watchTime(): void {
  const marks = [10, 30, 60, 180]
  let seen = 0
  const t = setInterval(() => {
    if (document.visibilityState !== 'visible') return
    seen += 1
    if (seen === marks[0]) {
      marks.shift()
      track('time_on_site', { seconds: seen })
      if (!marks.length) clearInterval(t)
    }
  }, 1000)
}

// Seen: the page was actually on screen for 2 continuous seconds. Instagram
// and Facebook preload ad landing pages in a hidden webview; those loads write
// a pageview but never become visible, so they never send page_seen. This is
// the event that defines a "visitor" in live_numbers().
function watchSeen(): void {
  let t: ReturnType<typeof setTimeout> | null = null
  const doc = document as Document & { prerendering?: boolean }
  const done = () => {
    document.removeEventListener('visibilitychange', arm)
    document.removeEventListener('prerenderingchange', arm)
  }
  function arm() {
    if (document.visibilityState === 'visible' && !doc.prerendering) {
      if (!t)
        t = setTimeout(() => {
          done()
          track('page_seen', {})
        }, 2000)
    } else if (t) {
      clearTimeout(t)
      t = null
    }
  }
  document.addEventListener('visibilitychange', arm)
  document.addEventListener('prerenderingchange', arm)
  arm()
}

// Scroll depth on one screen (the home): one event the first time the visitor
// passes 25, 50, 75 and 100% of what can be scrolled. Returns the cleanup.
export function watchScroll(view: string): () => void {
  const hit = new Set<number>()
  const on = () => {
    const room = document.documentElement.scrollHeight - window.innerHeight
    if (room <= 0) return
    const pct = Math.round((window.scrollY / room) * 100)
    for (const m of [25, 50, 75, 100]) {
      if (pct >= m && !hit.has(m)) {
        hit.add(m)
        track('scroll_depth', { view, pct: m })
      }
    }
  }
  window.addEventListener('scroll', on, { passive: true })
  return () => window.removeEventListener('scroll', on)
}

export function initAnalytics(): void {
  source = deriveSource()
  internal = internalFlag()
  void beacon()
  if (!isBot()) {
    watchTime()
    watchSeen()
  }
  // Internal devices and bots are logged (flagged) in Supabase but kept out of
  // PostHog and Meta.
  if (!internal && !isBot()) initMetaPixel()
  if (internal || !KEY || KEY.startsWith('__')) return
  posthog.init(KEY, {
    api_host: HOST,
    capture_pageview: true,
    autocapture: false,
    person_profiles: 'identified_only',
  })
  // page_type is 'app' for the whole SPA; source is fixed for the session.
  posthog.register({ page_type: 'app', source })
  on = true
}

type Props = Record<string, unknown>

// Always ship all six properties. The four per-item fields default to null and
// are overridden by `props`; page_type + source are constant for the app.
export function track(event: string, props: Props = {}): void {
  const full: Props = { brand: null, product_key: null, dispensary: null, neighborhood: null, ...props }
  // Mirror to Supabase first — readable without any third-party key.
  try {
    if (!isBot()) {
      const { brand, product_key, dispensary, neighborhood, category, ...rest } = full
      void supabase
        .from('events')
        .insert({
          event,
          path: location.pathname,
          page_type: 'app',
          source,
          session_id: sessionId(),
          visitor_id: visitorId(),
          brand: (brand as string | null) ?? null,
          product_key: (product_key as string | null) ?? null,
          dispensary: (dispensary as string | null) ?? null,
          neighborhood: (neighborhood as string | null) ?? null,
          category: (category as string | null | undefined) ?? null,
          internal,
          ...geo,
          props: { ...rest, seq: ++seq },
        })
        .then(
          () => undefined,
          () => undefined,
        )
    }
  } catch {
    /* never let analytics break the app */
  }
  metaTrack(event)
  if (!on) return
  posthog.capture(event, full)
}
