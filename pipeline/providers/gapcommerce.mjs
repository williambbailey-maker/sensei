// GapCommerce — the store's site searches its menu through an
// Elasticsearch-style API: POST search-<id>.gapcommerceapi.com/product/search
// with a per-store x-api-key. The menu page is loaded once, that request is
// copied, and replayed from inside the page with the category filter dropped
// and from/size paging. Products are hits[]._source; sizes of one product are
// its "siblings" inner hits (collapsed by catalogParentId).
//
// Field names below are read from the first dry run's raw sample; anything
// not found stays null.
//
// Config (stores.config.json): { "menu_url": "https://blissandlex.com/shop" }
import { cleanDescription, extractEffects, normCategory, num, PRODUCT_FIELDS, variant, priceFields } from '../lib/product.mjs'
import { captureRequest, pageFetchRetry } from '../lib/browser.mjs'

const PAGE = 100
const CALL_GAP_MS = 500
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const titleCase = (s) => (s ? String(s).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : null)
const CATS = ['flower', 'edibles', 'pre-rolls', 'vaporizers', 'concentrates', 'tinctures', 'topicals']

// labResults: [{ type: 'THC', amount: { minValue, maxValue }, amountType: 'PERCENTAGE' }]
function lab(src, type) {
  const list = src.productData?.labResults ?? src.labResults
  if (!Array.isArray(list)) return null
  const hit = list.find((l) => String(l.type).toUpperCase() === type)
  if (!hit || String(hit.amountType || '').toUpperCase() !== 'PERCENTAGE') return null
  const n = num(hit.amount?.maxValue ?? hit.amount?.minValue ?? hit.amount)
  return n != null && n > 0 && n <= 100 ? n : null
}

// Keep the site's own filters (in stock, not hidden, price range) but drop
// the category clause so one search covers the whole menu.
function wholeMenuQuery(q) {
  const must = q?.bool?.must
  if (!Array.isArray(must)) return q
  return { bool: { ...q.bool, must: must.filter((m) => !JSON.stringify(m).includes('category')) } }
}

export function mapProduct(hit, storeId, menuUrl, scale) {
  const s = hit._source ?? hit
  const category = normCategory(s.category || s.categoryName || s.productData?.category, null)
  if (!CATS.includes(category)) return null
  if (s.isHideFromMenu === true || s.isAboveThreshold === false) return null
  const id = s.id ?? hit._id
  if (!id) return null
  const sibs = (hit.inner_hits?.siblings?.hits?.hits ?? []).map((h) => h._source ?? h)
  const sizes = sibs.length ? sibs : [s]
  const variants = sizes
    .map((v) => variant(v.amount != null ? String(v.amount) : null, num(v.customMinPrice ?? v.price), num(v.customSalePrice)))
    .filter((v) => v.price != null)
    .map((v) => ({ ...v, price: Math.round((v.price / scale) * 100) / 100, ...(v.was != null ? { was: Math.round((v.was / scale) * 100) / 100 } : {}) }))
  const strain = s.strainType ?? s.productData?.strainType ?? s.strain
  const img = s.imageUrl ?? s.image ?? s.images?.[0]?.url ?? s.images?.[0] ?? s.productData?.images?.[0]?.url
  return {
    store_id: storeId,
    external_id: String(id),
    name: s.menuTitle || s.name || null,
    brand: s.brandName ?? s.brand?.name ?? (typeof s.brand === 'string' ? s.brand : null),
    description: cleanDescription(s.description ?? s.productData?.description),
    brand_description: null,
    effects: extractEffects(s.effects ?? s.productData?.effects),
    category,
    strain_type: strain && !/^(n\/a|none)$/i.test(strain) ? titleCase(strain) : null,
    thc_pct: lab(s, 'THC'),
    cbd_pct: lab(s, 'CBD'),
    variants,
    ...priceFields(variants),
    // Unconfirmed: product pages are usually <site>/product/<slug>.
    url: s.slug ? `${new URL(menuUrl).origin}/product/${s.slug}` : null,
    image_url: typeof img === 'string' && img.startsWith('http') ? img : null,
    in_stock: true,
    last_seen: new Date().toISOString(),
  }
}

export default {
  name: 'gapcommerce',
  enabled: false, // switch on after a dry run on one store looks right
  needsBrowser: true,
  fields: PRODUCT_FIELDS.filter((f) => !['url', 'brand_description', 'effects', 'strain_type'].includes(f)),

  async scrape({ page }, store) {
    const menuUrl = store.config?.menu_url
    if (!menuUrl) throw new Error(`no menu_url for ${store.slug} in stores.config.json`)
    const cap = await captureRequest(page, menuUrl, /gapcommerceapi\.com\/product\/search/)
    if (!cap.body || typeof cap.body !== 'object') throw new Error('product/search request had no JSON body')
    let query = wholeMenuQuery(cap.body.query)
    let size = PAGE
    const hits = []
    for (let from = 0; ; from += size) {
      let res
      try {
        res = await pageFetchRetry(page, cap.url, { method: 'POST', headers: cap.headers, body: { ...cap.body, query, from, size } })
      } catch (e) {
        if (!/^400/.test(e.message) || from > 0) throw e
        // Rejected: try the site's own query untouched, then its own page size.
        const tryBody = (b) => pageFetchRetry(page, cap.url, { method: 'POST', headers: cap.headers, body: b }).then((r) => r, () => null)
        res = await tryBody({ ...cap.body, from: 0, size })
        if (res) {
          query = cap.body.query
          console.log('    (full-menu query rejected; using the site\'s own query)')
        } else {
          res = await tryBody({ ...cap.body, from: 0 })
          if (!res) throw e
          query = cap.body.query
          size = cap.body.size || 20
          console.log(`    (only the site's own search accepted; paging ${size} at a time)`)
        }
      }
      const page_ = res?.hits?.hits ?? []
      hits.push(...page_)
      console.log(`    from ${from}: ${page_.length} hits`)
      if (page_.length < size) break
      await sleep(CALL_GAP_MS)
    }
    // Prices come either in dollars or in cents; a menu whose top price is
    // over 3000 is in cents.
    const top = Math.max(0, ...hits.map((h) => num((h._source ?? h).customMinPrice) ?? 0))
    const scale = top > 3000 ? 100 : 1
    if (scale === 100) console.log('    (prices are in cents)')
    const seen = new Map()
    let sample = null
    for (const h of hits) {
      const row = mapProduct(h, store.id, menuUrl, scale)
      if (!row) continue
      if (!sample) sample = h
      if (!seen.has(row.external_id)) seen.set(row.external_id, row)
    }
    return { products: [...seen.values()], meta: {}, sample }
  },
}
