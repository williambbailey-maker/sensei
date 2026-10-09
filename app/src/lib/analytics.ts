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

// The project key is public (write-only, ships in the bundle) — baked as a
// fallback like the Supabase anon key, so analytics works out of the box. Env
// vars win; set VITE_POSTHOG_KEY='' to disable.
const KEY =
  (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ??
  'phc_rqqTjemCGcjixkB3oiNQgB2L9w4yRGyZcYK3iP4mEcXX'
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'

let on = false
let source = 'direct'

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

const isBot = () => /bot|crawl|spider|slurp|preview/i.test(navigator.userAgent)
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

// First-party pageview → Supabase. Deduped: one row per page per session per
// 30 minutes, so reloads and service-worker refreshes don't count twice.
function beacon(): void {
  try {
    if (isBot()) return
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
      })
      .then(
        () => undefined,
        () => undefined,
      )
  } catch {
    /* never let analytics break the app */
  }
}

export function initAnalytics(): void {
  source = deriveSource()
  beacon()
  if (!KEY || KEY.startsWith('__')) return
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
          props: rest,
        })
        .then(
          () => undefined,
          () => undefined,
        )
    }
  } catch {
    /* never let analytics break the app */
  }
  if (!on) return
  posthog.capture(event, full)
}
