// Jane (iheartjane.com) — the embedded menu lists products through Jane's
// search service: POST dmerch.iheartjane.com/v2/multi with a store_id and a
// "menu_inline_table" placement. The menu page is loaded once, that request
// is copied, and replayed page by page from inside the page. Store details
// come from api.iheartjane.com/v1/stores/<id>.
//
// Config (stores.config.json): { "menu_url": "https://menu.kushklub.com/nyc" }
import { cleanDescription, dropCounter, extractEffects, normCategory, num, PRODUCT_FIELDS } from '../lib/product.mjs'
import { captureRequest, pageFetchRetry, pickStoreMeta } from '../lib/browser.mjs'

const PAGE = 100
const CALL_GAP_MS = 500
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const titleCase = (s) => (s ? String(s).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : null)

// Jane prices one field per weight: price_each, price_gram, price_eighth_ounce…
const WEIGHTS = [
  ['each', 'each'],
  ['half_gram', '0.5g'],
  ['gram', '1g'],
  ['two_gram', '2g'],
  ['eighth_ounce', '1/8oz'],
  ['quarter_ounce', '1/4oz'],
  ['half_ounce', '1/2oz'],
  ['ounce', '1oz'],
]

function pct(v) {
  const n = num(v)
  return n != null && n > 0 && n <= 100 ? n : null
}

export function mapProduct(p, storeId, menuUrl, drops) {
  const a = p.search_attributes ?? p
  const category = normCategory(a.kind || a.custom_product_type, null)
  if (!['flower', 'edibles', 'pre-rolls', 'vaporizers', 'concentrates', 'tinctures', 'topicals'].includes(category)) {
    drops?.add(`category "${a.kind || a.custom_product_type}"`)
    return null
  }
  if (a.at_visible_store === false) {
    drops?.add('not visible at store')
    return null
  }
  const id = a.product_id ?? p.product_id ?? a.objectID
  if (!id) {
    drops?.add('no id')
    return null
  }
  const variants = []
  for (const [key, label] of WEIGHTS) {
    const price = num(a[`price_${key}`])
    if (price == null || price <= 0) continue
    const disc = num(a[`discounted_price_${key}`])
    variants.push({ weight: key === 'each' ? a.amount || null : label, price: disc && disc > 0 && disc < price ? disc : price })
  }
  const prices = variants.map((v) => v.price).filter((p) => p > 0)
  const strain = a.category // Jane's "category" is the strain type (hybrid/indica/sativa/cbd)
  const pot = Array.isArray(a.inventory_potencies) ? a.inventory_potencies[0] : null
  return {
    store_id: storeId,
    external_id: String(id),
    name: a.name || null,
    brand: a.brand || null,
    description: cleanDescription(a.description),
    brand_description: null, // not in Jane's search index
    effects: extractEffects([...(a.feelings ?? []), ...(a.effects ?? [])]),
    category,
    strain_type: strain && !/^(n\/a|none)$/i.test(strain) ? titleCase(strain) : null,
    thc_pct: pct(a.percent_thc ?? pot?.thc_potency),
    cbd_pct: pct(a.percent_cbd ?? pot?.cbd_potency),
    variants,
    price_min: prices.length ? Math.min(...prices) : null,
    // Jane menus link products as <menu>/menu/products/<id>/<name-slug> (checked).
    url: `${menuUrl.replace(/\/$/, '')}/menu/products/${id}/${slugify(a.name)}`,
    image_url: Array.isArray(a.image_urls) && typeof a.image_urls[0] === 'string' ? a.image_urls[0] : null,
    in_stock: true,
    last_seen: new Date().toISOString(),
  }
}

export default {
  name: 'jane',
  enabled: false, // switch on after a dry run on one store looks right
  needsBrowser: true,
  fields: PRODUCT_FIELDS.filter((f) => f !== 'brand_description'),

  async scrape({ page }, store) {
    const menuUrl = store.config?.menu_url
    if (!menuUrl) throw new Error(`no menu_url for ${store.slug} in stores.config.json`)
    // The menu's own list request (not the top-row carousel).
    const cap = await captureRequest(page, menuUrl, (r) => /dmerch\.iheartjane\.com\/v2\/multi/.test(r.url()) && /menu_inline_table/.test(r.postData() || ''), { timeout: 30000 })
    const body = cap.body
    const table = body.placements.find((pl) => pl.placement === 'menu_inline_table')
    const storeIdJane = body.store_id
    const seen = new Map()
    const drops = dropCounter()
    let sample = null
    for (let pageNum = 0; ; pageNum++) {
      // Same request, but the whole menu (no special filter), 100 at a time.
      const placement = { ...table, search_filter: '', page_size: PAGE, page: pageNum, disable_ads: true }
      const res = await pageFetchRetry(page, cap.url, { method: 'POST', headers: cap.headers, body: { ...body, placements: [placement] } })
      const items = res?.placements?.[0]?.products ?? []
      let added = 0
      for (const p of items) {
        const row = mapProduct(p, store.id, menuUrl, drops)
        if (!row) continue
        if (!sample) sample = p.search_attributes ?? p
        if (!seen.has(row.external_id)) {
          seen.set(row.external_id, row)
          added++
        } else drops.add('duplicate id')
      }
      console.log(`    page ${pageNum + 1}: ${items.length} items, +${added}${drops.report() ? ` · ${drops.report()}` : ''}`)
      if (items.length < PAGE || added === 0) break
      await sleep(CALL_GAP_MS)
    }
    let meta = {}
    try {
      const s = await pageFetchRetry(page, `https://api.iheartjane.com/v1/stores/${storeIdJane}`)
      meta = pickStoreMeta(s?.store ?? s)
    } catch (e) {
      console.log(`    (store info not read: ${e.message.slice(0, 60)})`)
    }
    return { products: [...seen.values()], meta, sample }
  },
}
