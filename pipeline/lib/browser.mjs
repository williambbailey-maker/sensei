// Helpers for platforms whose API only answers the store's own website: load
// the menu page once, copy the request the site makes, then replay it from
// inside that page so cookies, origin and referer match exactly.

// Load `url` and return the first request matching `pattern` (a RegExp on
// the URL, or a function of the Playwright request) as
// { url, method, headers, body }, or throw after `timeout` ms.
export async function captureRequest(page, url, pattern, { timeout = 30000 } = {}) {
  const match = typeof pattern === 'function' ? pattern : (r) => pattern.test(r.url())
  const found = page.waitForRequest(match, { timeout })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const req = await found
  // Sites often redirect right after this (a trailing slash, /nyc -> /nyc/menu);
  // a fetch started during that navigation is cancelled ("Failed to fetch").
  await page.waitForLoadState('load').catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 1500))
  let body = req.postData() || null
  try {
    body = body ? JSON.parse(body) : null
  } catch {
    /* keep as text */
  }
  return { url: req.url(), method: req.method(), headers: req.headers(), body }
}

// fetch() run inside the page. Only app-level headers are passed on (the
// browser sets origin, referer, cookies and user-agent itself).
export async function pageFetch(page, url, { method = 'GET', headers = {}, body } = {}) {
  const h = {}
  for (const [k, v] of Object.entries(headers)) {
    if (/^(x-|api-key|apikey|authorization|content-type|accept$)/i.test(k) && !/^x-request-id$/i.test(k)) h[k] = v
  }
  if (body !== undefined && !h['content-type']) h['content-type'] = 'application/json'
  let res
  // A navigation in progress cancels in-page fetches; wait and try again.
  for (let attempt = 0; ; attempt++) {
    try {
      res = await page.evaluate(
    async ({ url, method, h, body }) => {
      // Default credentials (same-origin): an API that answers "any origin"
      // is refused by the browser when cookies are forced onto the request.
      const r = await fetch(url, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) })
      const text = await r.text()
      return { status: r.status, ok: r.ok, text }
    },
    { url, method, h, body },
      )
      break
    } catch (e) {
      if (!/Failed to fetch|context was destroyed|navigation/i.test(e.message) || attempt >= 3) throw e
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  if (!res.ok) throw new Error(`${res.status} ${method} ${url.slice(0, 120)}`)
  return JSON.parse(res.text)
}

// pageFetch with polite retries: 429/5xx back off 2s, 4s, 8s then give up.
export async function pageFetchRetry(page, url, opts) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await pageFetch(page, url, opts)
    } catch (e) {
      const status = parseInt(e.message, 10)
      if (!(status === 429 || status >= 500) || attempt >= 3) throw e
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt))
    }
  }
}

// Store name/address/coords from a store record, matched defensively.
export function pickStoreMeta(o) {
  const meta = {}
  if (!o || typeof o !== 'object') return meta
  if (typeof o.name === 'string' && o.name.trim()) meta.name = o.name.trim()
  const a = o.address && typeof o.address === 'object' ? o.address : o
  const street = a.address1 || a.street || a.line1 || a.addressLine1 || (typeof o.address === 'string' ? o.address : null)
  if (street && /^\d+[a-z]?\s+\S/i.test(String(street).trim()) && !/^\d+(st|nd|rd|th)\b/i.test(String(street).trim())) {
    meta.address = [street, a.city, a.state, a.zip || a.zipcode || a.postalCode].filter(Boolean).join(', ')
  }
  if (typeof a.city === 'string' && a.city.trim()) meta.city = a.city.trim()
  const lat = o.lat ?? o.latitude ?? o.location?.lat ?? o.location?.latitude ?? o._geoloc?.lat
  const lng = o.lng ?? o.long ?? o.longitude ?? o.location?.lng ?? o.location?.longitude ?? o._geoloc?.lng
  if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0) Object.assign(meta, { lat, lng })
  return meta
}
