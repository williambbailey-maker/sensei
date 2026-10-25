// Blaze / Tymber storefronts (ecom-api.blaze.me) — JSON:API products with
// prices in cents, potency with units, and a real store_url per product.
// The site identifies its store with x-store / x-group headers; those are
// copied from the menu page's own filters request, then the product list is
// read from inside the page.
//
// The list is GET /api/v1/products/?limit&offset&order (v2 is tried first
// and 404s today; kept in case it appears).
//
// Config (stores.config.json): { "menu_url": "https://altocanna.nyc/menu" }
import { cleanDescription, extractEffects, normCategory, num, PRODUCT_FIELDS, variant, priceFields } from '../lib/product.mjs'
import { captureRequest, pageFetchRetry, pickStoreMeta } from '../lib/browser.mjs'

const PAGE = 50
const CALL_GAP_MS = 500
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const titleCase = (s) => (s ? String(s).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : null)

const cents = (v) => {
  const n = num(v && typeof v === 'object' ? v.amount : v)
  return n != null ? Math.round(n) / 100 : null
}

// Potency: `thc` / `cbd` are { units, amount }; `potency` has { thc, cbd,
// units }. Only a percentage maps; mg (edibles) is skipped. `composition`
// carries no units, so it is not used.
function pct(a, key) {
  const isPct = (u) => !u || String(u).trim() === '%' || /^percent/i.test(String(u))
  const own = a[key]
  if (own && typeof own === 'object' && own.amount != null) {
    if (!isPct(own.units)) return null
    const n = num(own.amount)
    return n != null && n > 0 && n <= 100 ? n : null
  }
  const p = a.potency
  if (!p || typeof p !== 'object') return null
  if (!isPct(p.units)) return null
  const n = num(p[key] ?? p[`max_${key}`])
  return n != null && n > 0 && n <= 100 ? n : null
}

// Related records (brand, category) come either nested under the item's
// relationships or in the response's `included` list.
function related(item, name, included) {
  const rel = item.relationships?.[name]?.data
  if (!rel) return null
  if (rel.attributes) return rel.attributes
  const hit = (included || []).find((x) => x.type === rel.type && String(x.id) === String(rel.id))
  return hit?.attributes ?? null
}

export function mapProduct(item, storeId, included) {
  const a = item.attributes ?? item
  if (a.is_deleted || a.hide_from_menu || a.is_active === false || a.in_stock === false) return null
  if (typeof a.pos_inventory === 'number' && a.pos_inventory <= 0) return null
  const cat = related(item, 'category', included)
  const category = normCategory(cat?.name || cat?.slug, null)
  if (!['flower', 'edibles', 'pre-rolls', 'vaporizers', 'concentrates', 'tinctures', 'topicals'].includes(category)) return null
  const id = a.id ?? item.id
  if (!id) return null

  const variants = []
  for (const p of [...(a.weight_prices || []), ...(a.unit_prices || [])]) {
    const price = cents(p.price)
    const disc = cents(p.discount_price)
    if (price == null && disc == null) continue
    variants.push(variant(p.display_name || p.weight || p.name || null, price, disc))
  }
  if (!variants.length && a.unit_price) variants.push(variant(a.size?.display_text || null, cents(a.unit_price), cents(a.discount_price)))
  const brand = related(item, 'brand', included)
  const effects = a.blaze_enrichment?.effects
  const strain = a.flower_type || a.strain
  return {
    store_id: storeId,
    external_id: String(id),
    name: a.name || null,
    brand: brand?.name || a.brand_name || null,
    description: cleanDescription(a.description),
    brand_description: cleanDescription(brand?.description),
    effects: extractEffects([...(effects?.primary || []), ...(effects?.secondary || [])]),
    category,
    strain_type: strain && !/^(n\/a|none)$/i.test(strain) ? titleCase(strain) : null,
    thc_pct: pct(a, 'thc'),
    cbd_pct: pct(a, 'cbd'),
    variants,
    ...priceFields(variants),
    url: typeof a.store_url === 'string' ? a.store_url : null,
    image_url: typeof a.main_image === 'string' ? a.main_image : null,
    in_stock: true,
    last_seen: new Date().toISOString(),
  }
}

export default {
  name: 'blaze',
  enabled: true, // dry run on alto: 629 products via /api/v1/products/
  needsBrowser: true,
  fields: PRODUCT_FIELDS,

  async scrape({ page }, store) {
    const menuUrl = store.config?.menu_url
    if (!menuUrl) throw new Error(`no menu_url for ${store.slug} in stores.config.json`)
    const cap = await captureRequest(page, menuUrl, /ecom-api\.blaze\.me\/api\/v2\/products\/filters/)
    const base = cap.url.split('/api/v2/')[0]
    const headers = { 'x-store': cap.headers['x-store'], 'x-group': cap.headers['x-group'], 'x-app-mode': cap.headers['x-app-mode'] || 'default', accept: 'application/json' }
    // Candidate listings, first that answers wins.
    const candidates = [`${base}/api/v2/products/`, `${base}/api/v1/products/`]
    let listUrl = null
    const seen = new Map()
    let sample = null
    for (let offset = 0; ; offset += PAGE) {
      let res = null
      for (const c of listUrl ? [listUrl] : candidates) {
        try {
          res = await pageFetchRetry(page, `${c}?limit=${PAGE}&offset=${offset}&order=-inserted_at&delivery_type=pickup`, { headers })
          if (!listUrl) {
            listUrl = c
            console.log(`    listing: ${c.replace(base, '')}`)
          }
          break
        } catch (e) {
          if (listUrl) throw e
          console.log(`    (${c.replace(base, '')} -> ${e.message.slice(0, 40)})`)
        }
      }
      if (!res) throw new Error('no product listing endpoint answered')
      const items = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.objects) ? res.data.objects : []
      let added = 0
      for (const it of items) {
        const row = mapProduct(it, store.id, res.included)
        if (!row) continue
        if (!sample) sample = it
        if (!seen.has(row.external_id)) {
          seen.set(row.external_id, row)
          added++
        }
      }
      console.log(`    offset ${offset}: ${items.length} items, +${added}`)
      if (items.length < PAGE || added === 0) break
      await sleep(CALL_GAP_MS)
    }
    let meta = {}
    try {
      const s = await pageFetchRetry(page, `${base}/api/v1/store/`, { headers })
      meta = pickStoreMeta(s?.data?.attributes ?? s?.data ?? s)
    } catch (e) {
      console.log(`    (store info not read: ${e.message.slice(0, 60)})`)
    }
    return { products: [...seen.values()], meta, sample }
  },
}
