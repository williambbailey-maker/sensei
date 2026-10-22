// Carrot (getcarrot.io) — the store's site searches its menu with one
// Typesense-style call: POST api.nevada.getcarrot.io/api/v1/store/search-products
// ?locId=<n>. The API knows the store from the site making the call, so the
// menu page is loaded once, the site's own search request is copied, and it
// is replayed page by page from inside that page.
//
// Config (stores.config.json): { "menu_url": "https://carnegiehillcannabis.com/store/manhattan" }
import { cleanDescription, extractEffects, normCategory, num, PRODUCT_FIELDS } from '../lib/product.mjs'
import { captureRequest, pageFetchRetry, pickStoreMeta } from '../lib/browser.mjs'

const PAGE = 100 // Typesense allows up to 250 per page
const CALL_GAP_MS = 500
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const titleCase = (s) => (s ? String(s).toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : null)

function pct(v) {
  const n = num(v)
  return n != null && n > 0 && n <= 100 ? n : null
}

function firstImage(d) {
  const cands = [d.imageUrl, d.image, d.image_url, d.images?.[0]?.url, d.images?.[0], d.photo, d.thumbnail]
  for (const c of cands) if (typeof c === 'string' && c.startsWith('http')) return c
  return null
}

// Prices come as option1Price / option1Weight (… optionN), or a plain price.
function variantsOf(d) {
  const out = []
  for (let i = 1; i <= 12; i++) {
    const price = num(d[`option${i}Price`] ?? d[`option${i}SalePrice`])
    const weight = d[`option${i}Weight`] ?? d[`option${i}Name`] ?? d[`option${i}Label`] ?? d[`option${i}`] ?? null
    if (price == null && weight == null) continue
    const sale = num(d[`option${i}SalePrice`] ?? d[`option${i}DiscountPrice`])
    out.push({ weight: weight != null ? String(weight) : null, price: sale && sale > 0 && price && sale < price ? sale : price })
  }
  if (!out.length) {
    const price = num(d.salePrice ?? d.price)
    if (price != null) out.push({ weight: Array.isArray(d.weights) && d.weights.length === 1 ? String(d.weights[0]) : null, price })
  }
  return out
}

export function mapProduct(d, storeId, menuUrl) {
  const category = normCategory(d.masterCategoryName || d.carrotSubcategory || d.category, null)
  if (!['flower', 'edibles', 'pre-rolls', 'vaporizers', 'concentrates', 'tinctures', 'topicals'].includes(category)) return null
  if (d.inStock === false || d.outOfStock === true || (typeof d.quantity === 'number' && d.quantity <= 0)) return null
  const id = d.id ?? d.productId ?? d.slug
  if (!id) return null
  const variants = variantsOf(d)
  const prices = variants.map((v) => v.price).filter((p) => typeof p === 'number' && p > 0)
  const strain = d.strain || d.strainType
  return {
    store_id: storeId,
    external_id: String(id),
    name: d.name || null,
    brand: d.brand || null,
    description: cleanDescription(d.description),
    brand_description: null, // Carrot's search index has no brand blurb
    effects: extractEffects(d.effectTags ?? d.effects),
    category,
    strain_type: strain && !/^(n\/a|none)$/i.test(strain) ? titleCase(strain) : null,
    thc_pct: pct(d.thcPercent ?? d.thcPerc ?? d.thc ?? d.thcPercentage),
    cbd_pct: pct(d.cbdPercent ?? d.cbdPerc ?? d.cbd ?? d.cbdPercentage),
    variants,
    price_min: prices.length ? Math.min(...prices) : null,
    // Unconfirmed: Carrot storefronts link products as <menu>/product/<slug>.
    url: d.slug ? `${menuUrl.replace(/\/$/, '')}/product/${d.slug}` : null,
    image_url: firstImage(d),
    in_stock: true,
    last_seen: new Date().toISOString(),
  }
}

export default {
  name: 'carrot',
  enabled: false, // switch on after a dry run on one store looks right
  needsBrowser: true,
  // url and brand_description unconfirmed / not provided.
  fields: PRODUCT_FIELDS.filter((f) => !['url', 'brand_description'].includes(f)),

  async scrape({ page }, store) {
    const menuUrl = store.config?.menu_url
    if (!menuUrl) throw new Error(`no menu_url for ${store.slug} in stores.config.json`)
    const cap = await captureRequest(page, menuUrl, /getcarrot\.io\/api\/v1\/store\/search-products/)
    if (!cap.body?.searches?.length) throw new Error('search-products request had no searches body')
    const seen = new Map()
    let sample = null
    let perPage = PAGE
    for (let pageNum = 1; ; pageNum++) {
      // Same search the site makes, but every product, 100 at a time.
      const search = { ...cap.body.searches[0], q: '*', per_page: perPage, page: pageNum }
      let res
      try {
        res = await pageFetchRetry(page, cap.url, { method: 'POST', headers: cap.headers, body: { ...cap.body, searches: [search] } })
      } catch (e) {
        if (!/^403/.test(e.message) || pageNum > 1) throw e
        // Refused: find out whether the site's own request (unchanged) is
        // accepted, then a smaller page, so the cause is clear.
        const exact = await pageFetchRetry(page, cap.url, { method: 'POST', headers: cap.headers, body: cap.body }).then(() => 'accepted', (x) => x.message.slice(0, 30))
        const small = await pageFetchRetry(page, cap.url, { method: 'POST', headers: cap.headers, body: { ...cap.body, searches: [{ ...cap.body.searches[0], per_page: 50, page: 1 }] } }).then((r) => r, () => null)
        console.log(`    403 on the full-menu search · site's exact request: ${exact} · per_page 50: ${small ? 'accepted' : 'refused'}`)
        if (!small) throw e
        perPage = 50
        res = small
      }
      const hits = res?.results?.[0]?.hits ?? []
      let added = 0
      for (const h of hits) {
        const d = h.document ?? h
        const row = mapProduct(d, store.id, menuUrl)
        if (!row) continue
        if (!sample) sample = d
        if (!seen.has(row.external_id)) {
          seen.set(row.external_id, row)
          added++
        }
      }
      console.log(`    page ${pageNum}: ${hits.length} hits, +${added}`)
      if (hits.length < perPage || added === 0) break
      await sleep(CALL_GAP_MS)
    }
    let meta = {}
    try {
      const base = cap.url.split('/api/v1/')[0]
      const loc = await pageFetchRetry(page, `${base}/api/v1/store/locations`, { headers: cap.headers })
      const list = Array.isArray(loc) ? loc : loc?.data ?? loc?.locations ?? []
      meta = pickStoreMeta(Array.isArray(list) ? list[0] : list)
    } catch (e) {
      console.log(`    (location info not read: ${e.message.slice(0, 60)})`)
    }
    return { products: [...seen.values()], meta, sample }
  },
}
