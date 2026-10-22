// Joint Commerce (WordPress) — the store's site searches its menu through an
// Elasticsearch proxy on the same domain:
// POST <site>/wp-json/joint-ecommerce/v1/products/<index>/_search.
// The store page is loaded once, that request is copied, and replayed from
// inside the page as a plain paged query (no aggregations, no category
// filter). Products are hits[]._source.
//
// Field names below are read from the first dry run's raw sample; anything
// not found stays null.
//
// Config (stores.config.json):
//   { "menu_url": "https://dazed.fun/stores/dazed-cannabis-dispensary-union-square-nyc-ny/" }
import { cleanDescription, extractEffects, normCategory, num, PRODUCT_FIELDS } from '../lib/product.mjs'
import { captureRequest, pageFetchRetry } from '../lib/browser.mjs'

const PAGE = 100
const CALL_GAP_MS = 500
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const titleCase = (s) => (s ? String(s).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : null)
const CATS = ['flower', 'edibles', 'pre-rolls', 'vaporizers', 'concentrates', 'tinctures', 'topicals']

function pct(v) {
  const n = num(v)
  return n != null && n > 0 && n <= 100 ? n : null
}

// Their query keeps a store filter (which location) that we must keep, and
// a category/brand filter that we must drop. Keep every clause that doesn't
// mention category or brand.
function wholeMenuQuery(q) {
  if (!q?.bool) return q ?? { match_all: {} }
  const keep = (clauses) => (Array.isArray(clauses) ? clauses.filter((c) => !/categor|brandName/i.test(JSON.stringify(c))) : clauses)
  return { bool: { ...q.bool, must: keep(q.bool.must), filter: keep(q.bool.filter), should: keep(q.bool.should) } }
}

export function mapProduct(hit, storeId, menuUrl) {
  const s = hit._source ?? hit
  const category = normCategory(s.category || s.categoryName || s.productType, null)
  if (!CATS.includes(category)) return null
  if (s.inStock === false || s.isHidden === true || (typeof s.quantity === 'number' && s.quantity <= 0)) return null
  const id = s.posId ?? s.id ?? s.productId ?? hit._id
  if (!id) return null
  const base = num(s.price ?? s.regularPrice ?? s.unitPrice)
  const sale = num(s.salePrice ?? s.discountedPrice ?? s.specialPrice)
  const price = sale && sale > 0 && base && sale < base ? sale : base
  const weight = s.weight ?? s.size ?? s.unitOfMeasure ?? null
  const variants = price != null ? [{ weight: weight != null ? String(weight) : null, price }] : []
  const strain = s.strainType ?? s.strain ?? s.classification
  const img = s.imageUrl ?? s.image ?? s.images?.[0]?.url ?? s.images?.[0] ?? s.thumbnail
  const slug = s.slug ?? s.permalink ?? s.url
  return {
    store_id: storeId,
    external_id: String(id),
    name: s.name ?? s.productName ?? s.title ?? null,
    brand: s.brandName ?? s.brand?.name ?? (typeof s.brand === 'string' ? s.brand : null),
    description: cleanDescription(s.description),
    brand_description: null,
    effects: extractEffects(s.effects),
    category,
    strain_type: strain && !/^(n\/a|none)$/i.test(strain) ? titleCase(strain) : null,
    thc_pct: pct(s.thcPercent ?? s.thc ?? s.thcContent ?? s.labResults?.thc),
    cbd_pct: pct(s.cbdPercent ?? s.cbd ?? s.cbdContent ?? s.labResults?.cbd),
    variants,
    price_min: price != null && price > 0 ? price : null,
    url: typeof slug === 'string' && slug.startsWith('http') ? slug : slug ? `${menuUrl.replace(/\/$/, '')}/product/${slug}` : null,
    image_url: typeof img === 'string' && img.startsWith('http') ? img : null,
    in_stock: true,
    last_seen: new Date().toISOString(),
  }
}

export default {
  name: 'joint',
  enabled: false, // switch on after a dry run on one store looks right
  needsBrowser: true,
  fields: PRODUCT_FIELDS.filter((f) => !['url', 'brand_description', 'effects', 'strain_type', 'thc_pct', 'cbd_pct'].includes(f)),

  async scrape({ page }, store) {
    const menuUrl = store.config?.menu_url
    if (!menuUrl) throw new Error(`no menu_url for ${store.slug} in stores.config.json`)
    const cap = await captureRequest(page, menuUrl, /joint-ecommerce\/v1\/products\/[^/]+\/_search/)
    if (!cap.body || typeof cap.body !== 'object') throw new Error('_search request had no JSON body')
    const query = wholeMenuQuery(cap.body.query)
    const seen = new Map()
    let sample = null
    for (let from = 0; ; from += PAGE) {
      const res = await pageFetchRetry(page, cap.url, { method: 'POST', headers: cap.headers, body: { query, from, size: PAGE } })
      const hits = res?.hits?.hits ?? []
      let added = 0
      for (const h of hits) {
        const row = mapProduct(h, store.id, menuUrl)
        if (!row) continue
        if (!sample) sample = h._source ?? h
        if (!seen.has(row.external_id)) {
          seen.set(row.external_id, row)
          added++
        }
      }
      console.log(`    from ${from}: ${hits.length} hits, +${added}`)
      if (hits.length < PAGE || added === 0) break
      await sleep(CALL_GAP_MS)
    }
    return { products: [...seen.values()], meta: {}, sample }
  },
}
