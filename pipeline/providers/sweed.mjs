// Sweed (sweedpos.com) — the store's site lists its menu through
// POST web-ui-prime.sweedpos.com/_api/proxy/Products/GetProductList with a
// storeid header and { filters, page, pageSize, … }; the answer is
// { list, total, page, pageSize }. The menu page is loaded once, that
// request is copied, and replayed page by page from inside the page.
//
// Product field names are read from the first dry run's raw sample.
//
// Config (stores.config.json): { "menu_url": "https://freshlybaked.nyc/stores/midtown/shop/menu" }
import { cleanDescription, dropCounter, extractEffects, normCategory, num, PRODUCT_FIELDS } from '../lib/product.mjs'
import { captureRequest, pageFetchRetry } from '../lib/browser.mjs'

const PAGE = 100
const CALL_GAP_MS = 500
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const titleCase = (s) => (s ? String(s).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : null)
const CATS = ['flower', 'edibles', 'pre-rolls', 'vaporizers', 'concentrates', 'tinctures', 'topicals']
const nameOf = (x) => (x && typeof x === 'object' ? x.name ?? x.canonicalName ?? null : typeof x === 'string' ? x : null)

function pct(v) {
  const n = num(v)
  return n != null && n > 0 && n <= 100 ? n : null
}

export function mapProduct(p, storeId, menuUrl, drops) {
  const category = normCategory(nameOf(p.category) || nameOf(p.productCategory) || p.categoryName, null)
  if (!CATS.includes(category)) {
    drops?.add(`category "${nameOf(p.category) || nameOf(p.productCategory) || p.categoryName}"`)
    return null
  }
  if (p.isAvailable === false || p.inStock === false || (typeof p.quantity === 'number' && p.quantity <= 0)) {
    drops?.add('out of stock')
    return null
  }
  const id = p.id ?? p.productId ?? p.sku
  if (!id) {
    drops?.add('no id')
    return null
  }
  // Sizes: a variants list when there is one, else the product's own price.
  const list = Array.isArray(p.variants) ? p.variants : Array.isArray(p.options) ? p.options : []
  let variants = list
    .map((v) => {
      const base = num(v.price ?? v.regularPrice)
      const sale = num(v.salePrice ?? v.promoPrice ?? v.discountPrice)
      return { weight: nameOf(v.weight) ?? v.name ?? v.size ?? null, price: sale && sale > 0 && base && sale < base ? sale : base }
    })
    .filter((v) => v.price != null)
  if (!variants.length) {
    const base = num(p.price ?? p.regularPrice)
    const sale = num(p.salePrice ?? p.promoPrice ?? p.discountPrice)
    const price = sale && sale > 0 && base && sale < base ? sale : base
    if (price != null) variants = [{ weight: nameOf(p.weight) ?? p.size ?? null, price }]
  }
  const prices = variants.map((v) => v.price).filter((x) => x > 0)
  const strain = nameOf(p.strain?.type) ?? nameOf(p.strainType) ?? nameOf(p.strain?.category)
  const img = p.imageUrl ?? p.image ?? p.images?.[0]?.url ?? p.images?.[0]
  const brand = nameOf(p.brand) ?? p.brandName
  return {
    store_id: storeId,
    external_id: String(id),
    name: p.name ?? null,
    brand: brand ?? null,
    description: cleanDescription(p.description),
    brand_description: cleanDescription(p.brand?.description),
    effects: extractEffects(p.effects ?? p.strain?.effects),
    category,
    strain_type: strain && !/^(n\/a|none)$/i.test(strain) ? titleCase(strain) : null,
    thc_pct: pct(p.thc ?? p.thcPercent ?? p.strain?.thc ?? p.potency?.thc),
    cbd_pct: pct(p.cbd ?? p.cbdPercent ?? p.strain?.cbd ?? p.potency?.cbd),
    variants,
    price_min: prices.length ? Math.min(...prices) : null,
    // Unconfirmed: the menu plus /product/<slug-or-id>.
    url: `${menuUrl.replace(/\/$/, '')}/product/${p.slug ?? p.canonicalName ?? id}`,
    image_url: typeof img === 'string' && img.startsWith('http') ? img : null,
    in_stock: true,
    last_seen: new Date().toISOString(),
  }
}

export default {
  name: 'sweed',
  enabled: false, // switch on after a dry run on one store looks right
  needsBrowser: true,
  fields: PRODUCT_FIELDS.filter((f) => !['url', 'brand_description', 'effects', 'thc_pct', 'cbd_pct', 'strain_type'].includes(f)),

  async scrape({ page }, store) {
    const menuUrl = store.config?.menu_url
    if (!menuUrl) throw new Error(`no menu_url for ${store.slug} in stores.config.json`)
    const cap = await captureRequest(page, menuUrl, /sweedpos\.com\/_api\/proxy\/Products\/GetProductList/)
    const seen = new Map()
    const drops = dropCounter()
    let sample = null
    let size = PAGE
    for (let pageNum = 1; ; pageNum++) {
      const res = await pageFetchRetry(page, cap.url, { method: 'POST', headers: cap.headers, body: { ...cap.body, filters: {}, searchTerm: '', page: pageNum, pageSize: size } })
      const items = Array.isArray(res?.list) ? res.list : []
      if (pageNum === 1 && res?.pageSize && res.pageSize < size) size = res.pageSize // the API capped it
      let added = 0
      for (const p of items) {
        const row = mapProduct(p, store.id, menuUrl, drops)
        if (!row) continue
        if (!sample) sample = p
        if (!seen.has(row.external_id)) {
          seen.set(row.external_id, row)
          added++
        } else drops.add('duplicate id')
      }
      console.log(`    page ${pageNum}: ${items.length} of ${res?.total ?? '?'}, +${added}${drops.report() ? ` · ${drops.report()}` : ''}`)
      if (items.length < size || added === 0) break
      await sleep(CALL_GAP_MS)
    }
    return { products: [...seen.values()], meta: {}, sample }
  },
}
