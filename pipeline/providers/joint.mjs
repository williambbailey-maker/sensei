// Joint Commerce (WordPress) — the store's site searches its menu through an
// Elasticsearch proxy on the same domain:
// POST <site>/wp-json/joint-ecommerce/v1/products/<index>/_search.
// The store page is loaded once, that request is copied, and replayed from
// inside the page as a plain paged query (no aggregations, no category
// filter). Products are hits[]._source.
//
// Fields (from a Dazed sample): name, brandName, brandDescription, category
// (FLOWER/EDIBLES/…), strainType, effects, primaryImage, urlFragment,
// variants [{ option, price, specialPrice, quantity }], potencies
// [{ type: 'THC', rangeHigh, unit: '%' | 'mg' }], jointId, isDeleted.
//
// Config (stores.config.json):
//   { "menu_url": "https://dazed.fun/stores/dazed-cannabis-dispensary-union-square-nyc-ny/" }
import { cleanDescription, dropCounter, extractEffects, normCategory, num, PRODUCT_FIELDS } from '../lib/product.mjs'
import { captureRequest, pageFetchRetry } from '../lib/browser.mjs'

const PAGE = 100
const CALL_GAP_MS = 500
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const titleCase = (s) => (s ? String(s).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : null)
const CATS = ['flower', 'edibles', 'pre-rolls', 'vaporizers', 'concentrates', 'tinctures', 'topicals']

// potencies: [{ type: 'THC', rangeLow, rangeHigh, unit }] — percent only.
function potency(s, type) {
  const list = Array.isArray(s.potencies) ? s.potencies : []
  const hit = list.find((p) => String(p.type).toUpperCase() === type)
  if (!hit || String(hit.unit || '').trim() !== '%') return null
  const n = num(hit.rangeHigh ?? hit.rangeLow ?? hit.displayValue)
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

export function mapProduct(hit, storeId, menuUrl, drops) {
  const s = hit._source ?? hit
  const category = normCategory(s.category || s.posCategory, null)
  if (!CATS.includes(category)) {
    drops?.add(`category "${s.category || s.posCategory}"`)
    return null
  }
  if (s.isDeleted || s.deletedAt) {
    drops?.add('deleted')
    return null
  }
  const id = s.jointId ?? s.globalProductId ?? s.posId ?? hit._id
  if (!id) {
    drops?.add('no id')
    return null
  }
  const variants = (Array.isArray(s.variants) ? s.variants : [])
    .filter((v) => !(typeof num(v.quantity) === 'number' && num(v.quantity) <= 0))
    .map((v) => {
      const base = num(v.price)
      const sale = num(v.specialPrice)
      return { weight: v.option != null ? String(v.option) : null, price: sale && sale > 0 && base && sale < base ? sale : base }
    })
    .filter((v) => v.price != null)
  if (!variants.length) {
    drops?.add('no priced size in stock')
    return null
  }
  const prices = variants.map((v) => v.price).filter((p) => p > 0)
  const strain = s.strainType
  const img = s.primaryImage ?? (Array.isArray(s.images) ? s.images[0] : null)
  return {
    store_id: storeId,
    external_id: String(id),
    name: s.name ?? null,
    brand: s.brandName ?? null,
    description: cleanDescription(s.description ?? s.descriptionHtml),
    brand_description: cleanDescription(s.brandDescription),
    effects: extractEffects(s.effects),
    category,
    strain_type: strain && !/^(n\/a|none)$/i.test(strain) ? titleCase(strain) : null,
    thc_pct: potency(s, 'THC'),
    cbd_pct: potency(s, 'CBD'),
    variants,
    price_min: prices.length ? Math.min(...prices) : null,
    // Unconfirmed: the store page plus /product/<urlFragment>.
    url: s.urlFragment ? `${menuUrl.replace(/\/$/, '')}/product/${s.urlFragment}` : null,
    image_url: typeof img === 'string' && img.startsWith('http') ? img : null,
    in_stock: true,
    last_seen: new Date().toISOString(),
  }
}

export default {
  name: 'joint',
  enabled: false, // switch on after a dry run on one store looks right
  needsBrowser: true,
  fields: PRODUCT_FIELDS.filter((f) => f !== 'url'),

  async scrape({ page }, store) {
    const menuUrl = store.config?.menu_url
    if (!menuUrl) throw new Error(`no menu_url for ${store.slug} in stores.config.json`)
    const cap = await captureRequest(page, menuUrl, /joint-ecommerce\/v1\/products\/[^/]+\/_search/)
    if (!cap.body || typeof cap.body !== 'object') throw new Error('_search request had no JSON body')
    const query = wholeMenuQuery(cap.body.query)
    const seen = new Map()
    const drops = dropCounter()
    let sample = null
    for (let from = 0; ; from += PAGE) {
      const res = await pageFetchRetry(page, cap.url, { method: 'POST', headers: cap.headers, body: { query, from, size: PAGE } })
      const hits = res?.hits?.hits ?? []
      let added = 0
      for (const h of hits) {
        const row = mapProduct(h, store.id, menuUrl, drops)
        if (!row) continue
        if (!sample) sample = h._source ?? h
        if (!seen.has(row.external_id)) {
          seen.set(row.external_id, row)
          added++
        } else drops.add('duplicate id')
      }
      console.log(`    from ${from}: ${hits.length} hits, +${added}${drops.report() ? ` · ${drops.report()}` : ''}`)
      if (hits.length < PAGE || added === 0) break
      await sleep(CALL_GAP_MS)
    }
    return { products: [...seen.values()], meta: {}, sample }
  },
}
