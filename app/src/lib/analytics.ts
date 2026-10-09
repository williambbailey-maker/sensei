// Analytics — PostHog instrumentation for the Sensei app.
//
// Every event carries the six properties ANALYTICS.md mandates — `brand`,
// `product_key`, `dispensary`, `neighborhood`, `page_type`, `source` — with no
// exceptions. `page_type` and `source` are registered as super-properties so
// they ride on every capture (including the automatic $pageview); the per-
// product fields default to null and are overridden on product events.
//
// The write key is public by design (it ships in the client bundle and can only
// write events). It comes from VITE_POSTHOG_KEY; with no key set, every call
// here is a safe no-op so the app runs untouched until the key is dropped in.
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

function sessionId(): string {
  try {
    let s = sessionStorage.getItem('sensei_sid')
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem('sensei_sid', s)
    }
    return s
  } catch {
    return 'na'
  }
}

// First-party pageview beacon → Supabase (insert-only, no PII). Independent of
// PostHog, so traffic is always readable straight from the database without a
// third-party API key. One row per load.
function beacon(source: string): void {
  try {
    if (/bot|crawl|spider|slurp|preview/i.test(navigator.userAgent)) return
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
        device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
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
  const source = deriveSource()
  beacon(source)
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

// Always ship all six properties. page_type + source come from register(); the
// four per-item fields default to null and are overridden by `props`.
export function track(event: string, props: Props = {}): void {
  if (!on) return
  posthog.capture(event, {
    brand: null,
    product_key: null,
    dispensary: null,
    neighborhood: null,
    ...props,
  })
}
