// Dispense (dispenseapp.com) — the store's own site loads its menu from a
// plain JSON API: api.dispenseapp.com/v1/venues/<venue>/... with a public
// api-key header. No Cloudflare; the calls are made directly, one at a time.
//
// Config (stores.config.json, keyed by slug):
//   { "menu_url": "https://cannadreams.nyc/menu" }
// The venue id and api key are picked up by loading that page once in the
// browser and watching the first API request it makes (cached per site for
// the run). To skip the browser, give them directly:
//   { "menu_url": "...", "venue": "55e6bc0c93d44d8a", "api_key": "..." }
import { cleanDescription, extractEffects, normCategory, num, PRODUCT_FIELDS } from '../lib/product.mjs'

const API = process.env.DISPENSE_API || 'https://api.dispenseapp.com'
const PAGE = 50 // products per request
const CALL_GAP_MS = 400 // pause between API calls
const CATEGORIES = new Set(['flower', 'edibles', 'pre-rolls', 'vaporizers', 'concentrates', 'tinctures', 'topicals'])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// One API call with polite retries: 429/5xx back off 2s, 4s, 8s then give up.
async function call(path, creds, ctx) {
  const url = `${API}${path}`
  const headers = {
    accept: 'application/json',
    'api-key': creds.api_key,
    'x-url': creds.menu_url,
    'x-pathname': path.split('?')[0],
    origin: creds.origin,
    referer: creds.menu_url,
  }
  if (creds.prospect_token) headers['x-prospect-token'] = creds.prospect_token
  for (let attempt = 0; ; attempt++) {
    await sleep(CALL_GAP_MS)
    // The browser's request client (same cookies/UA as the page) when we have
    // one; plain fetch otherwise.
    const res = ctx.page ? await ctx.page.request.get(url, { headers, timeout: 30000 }) : await fetch(url, { headers })
    // Playwright's response has status() / ok(); fetch's has plain fields.
    const status = typeof res.status === 'function' ? res.status() : res.status
    const ok = typeof res.ok === 'function' ? res.ok() : res.ok
    if (ok) return await res.json()
    const retry = status === 429 || status >= 500
    if (!retry || attempt >= 3) throw new Error(`${status} GET ${path}`)
    await sleep(2000 * 2 ** attempt)
  }
}

// Load the menu page once and capture the venue id + api key from the first
// API request it makes. Cached per site for the run.
const credsCache = new Map()
async function discover(ctx, store) {
  const cfg = store.config || {}
  if (!cfg.menu_url) throw new Error(`no menu_url for ${store.slug} in stores.config.json`)
  const origin = new URL(cfg.menu_url).origin
  if (cfg.venue && cfg.api_key) return { ...cfg, origin }
  if (credsCache.has(cfg.menu_url)) return credsCache.get(cfg.menu_url)
  if (!ctx.page) throw new Error('needs the browser to find the venue id and api key (or set them in stores.config.json)')
  const found = ctx.page.waitForRequest((r) => /api\.dispenseapp\.com\/v1\/venues\/[0-9a-f]+\//.test(r.url()), { timeout: 30000 })
  await ctx.page.goto(cfg.menu_url, { waitUntil: 'domcontentloaded' })
  const req = await found
  const h = req.headers()
  const venue = req.url().match(/\/v1\/venues\/([0-9a-f]+)\//)[1]
  const creds = { menu_url: cfg.menu_url, origin, venue: cfg.venue || venue, api_key: h['api-key'], prospect_token: h['x-prospect-token'] }
  if (!creds.api_key) throw new Error('menu page made an API call without an api-key header')
  credsCache.set(cfg.menu_url, creds)
  return creds
}

// Find the category list inside the venue's product-filters response: any
// key named like "categor…" whose value is a list of { id, name }.
function findCategories(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return null
  for (const [k, v] of Object.entries(node)) {
    if (/categor/i.test(k) && Array.isArray(v) && v.length && v.every((x) => x && (x.id || x._id) && x.name)) return v
  }
  for (const v of Object.values(node)) {
    const r = findCategories(v, depth + 1)
    if (r) return r
  }
  return null
}

const titleCase = (s) => (s ? String(s).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : null)

// Potency lives in `labs` ({ thc: 22.4, thcContentUnit: '%', cbd, … }), and
// in the POS sync blob as "labs.thc" / "labs.thcContentUnit". Only a
// percentage maps to thc_pct/cbd_pct; mg (edibles) is skipped, as for Dutchie.
function labPct(prod, which) {
  const labs = prod.labs && typeof prod.labs === 'object' ? prod.labs : null
  let v = labs?.[which]
  let unit = labs?.[`${which}ContentUnit`]
  if (v == null) {
    try {
      const sync = typeof prod.posLastSyncData === 'string' ? JSON.parse(prod.posLastSyncData) : prod.posLastSyncData
      v = sync?.[`labs.${which}`]
      unit = sync?.[`labs.${which}ContentUnit`]
    } catch {
      /* not json */
    }
  }
  if (unit && String(unit).trim() !== '%' && !/^percent/i.test(String(unit))) return null
  const n = num(v)
  return n != null && n > 0 && n <= 100 ? n : null
}

function firstImage(prod) {
  const cands = [prod.image, prod.imageUrl, prod.images?.[0]?.fileUrl, prod.images?.[0]?.url, prod.images?.[0]]
  for (const c of cands) if (typeof c === 'string' && c.startsWith('http')) return c
  // The POS sync blob carries the images when the product itself doesn't.
  try {
    const sync = typeof prod.posLastSyncData === 'string' ? JSON.parse(prod.posLastSyncData) : prod.posLastSyncData
    const u = sync?.images?.[0]?.fileUrl || sync?.images?.[0]?.url
    if (typeof u === 'string' && u.startsWith('http')) return u
  } catch {
    /* not json */
  }
  return null
}

export function mapProduct(prod, storeId, cfg = {}) {
  const category = normCategory(prod.productCategoryName || prod.subType || prod.cannabisComplianceType, null)
  if (!CATEGORIES.has(category)) return null // accessories, apparel, …
  if (prod.deleted || prod.enable === false) return null
  if (typeof prod.quantity === 'number' && prod.quantity <= 0) return null

  const tiers = Array.isArray(prod.tiers) ? prod.tiers : []
  let variants = tiers
    .map((t) => ({ weight: t.weightFormatted || null, price: num(t.price) }))
    .filter((v) => v.price != null || v.weight)
  if (!variants.length) variants = [{ weight: prod.weightFormatted || prod.size || null, price: num(prod.priceWithDiscounts ?? prod.price) }]
  // A product-level discount applies to a single-tier product.
  const disc = num(prod.priceWithDiscounts)
  if (variants.length === 1 && disc != null && disc > 0 && variants[0].price != null && disc < variants[0].price) variants[0].price = disc
  const prices = variants.map((v) => v.price).filter((p) => typeof p === 'number' && p > 0)

  const thc = labPct(prod, 'thc')
  const cbd = labPct(prod, 'cbd')

  return {
    store_id: storeId,
    external_id: String(prod.id || prod._id),
    name: prod.name || null,
    brand: prod.brand?.name || null,
    description: cleanDescription(prod.description),
    brand_description: cleanDescription(prod.brand?.description),
    effects: extractEffects(prod.effects),
    category,
    strain_type: titleCase(prod.cannabisType),
    thc_pct: thc,
    cbd_pct: cbd,
    variants,
    price_min: prices.length ? Math.min(...prices) : null,
    // A site whose product pages don't resolve (SOFACLUB) links to its menu.
    url: cfg.link === 'menu' ? cfg.menu_url : typeof prod.productUrl === 'string' ? prod.productUrl : null,
    image_url: firstImage(prod),
    in_stock: true,
    last_seen: new Date().toISOString(),
  }
}

// Store coords/city (and a street address when it has a number) from the
// venue record. The venue name is an SEO string ("… | Cannabis Dispensary
// Manhattan [NYC] (Rec)"), so it is not used — store names are set by hand.
function venueMeta(v) {
  const meta = {}
  const o = v?.data ?? v
  if (!o || typeof o !== 'object') return meta
  const a = o.address && typeof o.address === 'object' ? o.address : o
  const street = a.address1 || a.street || a.line1 || (typeof o.address === 'string' ? o.address : null)
  // Needs a house number: "9th Avenue" alone is not an address.
  if (street && /^\d+[a-z]?\s+\S/i.test(String(street).trim()) && !/^\d+(st|nd|rd|th)\b/i.test(String(street).trim())) meta.address = [street, a.city, a.state, a.zip || a.postalCode].filter(Boolean).join(', ')
  if (typeof a.city === 'string') meta.city = a.city.trim()
  const lat = o.latitude ?? o.lat ?? o.location?.latitude ?? o.location?.lat ?? o.location?.coordinates?.[1]
  const lng = o.longitude ?? o.lng ?? o.location?.longitude ?? o.location?.lng ?? o.location?.coordinates?.[0]
  if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0) Object.assign(meta, { lat, lng })
  return meta
}

export default {
  name: 'dispense',
  enabled: true, // dry run on cannadreams: 865 products, potency mapped
  needsBrowser: (store) => !(store.config?.venue && store.config?.api_key),
  fields: PRODUCT_FIELDS,

  async scrape(ctx, store) {
    const creds = await discover(ctx, store)
    const base = `/v1/venues/${creds.venue}`
    const filters = await call(`${base}/product-filters`, creds, ctx)
    const cats = findCategories(filters)
    // Category by category (the endpoint the site itself uses), else the whole
    // venue in one list.
    const lists = cats
      ? cats.map((c) => ({ label: c.name, path: `${base}/product-categories/${c.id || c._id}/products` }))
      : [{ label: 'all', path: `${base}/products` }]
    if (!cats) console.log('    (no category list in product-filters — paging the whole venue)')
    const seen = new Map()
    let sample = null
    for (const { label, path } of lists) {
      let kept = 0
      for (let skip = 0; ; skip += PAGE) {
        const res = await call(`${path}?skip=${skip}&limit=${PAGE}&orderPickUpType=IN_STORE`, creds, ctx)
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
        for (const p of items) {
          const row = mapProduct(p, store.id, store.config)
          if (!row) continue
          if (!sample) sample = p
          if (!seen.has(row.external_id)) {
            seen.set(row.external_id, row)
            kept++
          }
        }
        if (items.length < PAGE) break
      }
      console.log(`    ${label}: +${kept}`)
    }
    let meta = {}
    try {
      meta = venueMeta(await call(base, creds, ctx))
    } catch (e) {
      console.log(`    (venue info not read: ${e.message.slice(0, 60)})`)
    }
    return { products: [...seen.values()], meta, sample }
  },
}
