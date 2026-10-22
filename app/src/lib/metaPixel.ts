// Meta Pixel — the third sink for Sensei's events, used for ad optimization,
// retargeting audiences and lookalikes. Mirrors a handful of `track()` events
// onto Meta standard events.
//
// Policy rule: nothing product-identifying ever goes to Meta. No brand, product,
// strain, category, dispensary, query text or URL — only a neutral
// `content_type`. Meta reads parameters, and cannabis-specific data is a
// review risk for the ad account.
//
// Mapping (keep in sync with seo/build.py → analytics_js):
//   product_view                → ViewContent {content_type:'product'}
//   brand_view (SEO)            → ViewContent {content_type:'brand'}
//   search, chip_tap            → Search
//   menu_click, directions_click→ Lead {content_category:'menu'|'directions'}
//   signup                      → CompleteRegistration
//   MenuEngaged (custom, 1×/session): second product_view, or any Lead
//
// Each call carries an eventID so a later server-side (Conversions API) copy
// of the same event is deduplicated by Meta.

const PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID as string | undefined) ?? '1429430855347256'

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  push: Fbq
  loaded: boolean
  version: string
}

declare global {
  interface Window {
    fbq?: Fbq
    _fbq?: Fbq
  }
}

let on = false
let views = 0

const eid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

function engagedOnce(): void {
  try {
    if (sessionStorage.getItem('sensei_meta_engaged')) return
    sessionStorage.setItem('sensei_meta_engaged', '1')
  } catch {
    /* storage blocked: fire anyway */
  }
  window.fbq?.('trackCustom', 'MenuEngaged', {}, { eventID: eid() })
}

export function initMetaPixel(): void {
  if (on || !PIXEL_ID || PIXEL_ID.startsWith('__')) return
  try {
    // Standard Meta loader, typed.
    if (!window.fbq) {
      const n = function (...args: unknown[]) {
        if (n.callMethod) n.callMethod(...args)
        else n.queue.push(args)
      } as Fbq
      n.push = n
      n.loaded = true
      n.version = '2.0'
      n.queue = []
      window.fbq = n
      window._fbq = n
      const s = document.createElement('script')
      s.async = true
      s.src = 'https://connect.facebook.net/en_US/fbevents.js'
      document.head.appendChild(s)
    }
    window.fbq('init', PIXEL_ID)
    window.fbq('track', 'PageView', {}, { eventID: eid() })
    on = true
  } catch {
    /* never let analytics break the app */
  }
}

export function metaTrack(event: string): void {
  if (!on || !window.fbq) return
  try {
    const opt = { eventID: eid() }
    switch (event) {
      case 'product_view':
        window.fbq('track', 'ViewContent', { content_type: 'product' }, opt)
        if (++views >= 2) engagedOnce()
        break
      case 'search':
      case 'chip_tap':
        window.fbq('track', 'Search', {}, opt)
        break
      case 'menu_click':
      case 'directions_click':
        window.fbq('track', 'Lead', { content_category: event === 'menu_click' ? 'menu' : 'directions' }, opt)
        engagedOnce()
        break
      case 'signup':
        window.fbq('track', 'CompleteRegistration', {}, opt)
        break
    }
  } catch {
    /* ignore */
  }
}
