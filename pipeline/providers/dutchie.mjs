// Dutchie — loads each store's category pages in a real browser (to pass
// Cloudflare) and captures the STRUCTURED PRODUCT FEED the page fetches
// (Dutchie's GraphQL) — exact prices, every pack size, strain, potency —
// instead of scraping the rendered HTML (which varies per store template).
//
// store.slug is the Dutchie cName (dutchie.com/dispensary/<slug>).
import { cleanDescription, extractEffects, normCategory, num, potencyPct, PRODUCT_FIELDS } from '../lib/product.mjs'

const CATEGORIES = ['flower', 'edibles', 'pre-rolls', 'vaporizers', 'concentrates', 'tinctures', 'topicals']
const SLOW = /^(1|true|yes)$/i.test(process.env.SLOW || '')
const T = SLOW
  ? { load: 4000, scrollWait: 1500, scrolls: 4, betweenPages: 2000 }
  : { load: 1200, scrollWait: 350, scrolls: 2, betweenPages: 250 }
// A "full" page returns ~100 products; fewer means it's the last page, so we
// can stop without fetching an empty next page.
const FULL_PAGE = 90

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --- Parse a Dutchie GraphQL product object into a Supabase row -------------
export function mapApiProduct(prod, storeId, slug, fallbackCat) {
  const options = Array.isArray(prod.Options) ? prod.Options : []
  const rec = Array.isArray(prod.recPrices) && prod.recPrices.length
    ? prod.recPrices
    : Array.isArray(prod.Prices)
      ? prod.Prices
      : []
  const special = Array.isArray(prod.recSpecialPrices) ? prod.recSpecialPrices : []
  const variants = []
  const n = Math.max(options.length, rec.length)
  for (let i = 0; i < n; i++) {
    const base = num(rec[i])
    const sp = num(special[i])
    const price = sp && sp > 0 ? sp : base
    if (price != null || options[i] != null) variants.push({ weight: options[i] ?? null, price: price ?? null })
  }
  const prices = variants.map((v) => v.price).filter((p) => typeof p === 'number' && p > 0)
  const priceMin = prices.length ? Math.min(...prices) : null

  const cName = prod.cName || prod.id || prod._id
  const brandName = prod.brandName || prod.brand?.name || null
  const image =
    prod.Image ||
    (Array.isArray(prod.images) && prod.images[0] ? prod.images[0].url || prod.images[0] : null) ||
    null
  const strain = prod.strainType && prod.strainType !== 'N/A' ? prod.strainType : null

  return {
    store_id: storeId,
    external_id: String(cName),
    name: prod.Name || null,
    brand: brandName,
    // Product-level description isn't in Dutchie's menu feed; the brand blurb is.
    description: cleanDescription(prod.Description ?? prod.description),
    brand_description: cleanDescription(prod.brand?.description),
    effects: extractEffects(prod.effects),
    category: normCategory(prod.type, fallbackCat),
    strain_type: strain,
    thc_pct: potencyPct(prod.THCContent) ?? num(prod.THC),
    cbd_pct: potencyPct(prod.CBDContent) ?? num(prod.CBD),
    variants,
    price_min: priceMin,
    url: cName ? `https://dutchie.com/dispensary/${slug}/product/${cName}` : null,
    image_url: image,
    in_stock: true,
    last_seen: new Date().toISOString(),
  }
}

// Pull {lat,lng} out of the many shapes Dutchie uses for coordinates.
function pickCoords(o) {
  if (!o || typeof o !== 'object') return null
  // GeoJSON: { coordinates: [lng, lat] }
  if (Array.isArray(o.coordinates) && o.coordinates.length === 2) {
    const [lng, lat] = o.coordinates
    if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0) return { lat, lng }
  }
  const lat = o.lt ?? o.lat ?? o.latitude
  const lng = o.ln ?? o.lng ?? o.longitude
  if (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat !== 0 &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  ) {
    return { lat, lng }
  }
  return null
}

// Some payloads only carry coordinates inside a Google Maps link.
function coordsFromMapsUrl(url) {
  if (typeof url !== 'string') return null
  const m = url.match(/[@=](-?\d{2}\.\d+),(-?\d{2,3}\.\d+)/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (lat !== 0 && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
  return null
}

// Recursively look for the dispensary object in a GraphQL response — it
// carries the store's real name, street address, and coordinates. Shapes vary,
// so match defensively: a name plus an address or location.
function findDispensaryMeta(node, out, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 14 || out.done) return
  if (Array.isArray(node)) {
    for (const v of node) findDispensaryMeta(v, out, depth + 1)
    return
  }
  const looksDispensary =
    node.__typename === 'Dispensary' ||
    (typeof node.name === 'string' &&
      node.name.length < 80 &&
      (node.address1 || node.address || node.location || node.googleMapsUrl))
  if (looksDispensary) {
    const coords =
      pickCoords(node.location) ?? pickCoords(node) ?? coordsFromMapsUrl(node.googleMapsUrl)
    if (typeof node.name === 'string' && node.name && !out.name) out.name = node.name.trim()
    if (coords && out.lat == null) {
      out.lat = coords.lat
      out.lng = coords.lng
    }
    const street = typeof node.address1 === 'string' ? node.address1 : typeof node.address === 'string' ? node.address : null
    if (street && !out.address) {
      out.address = [street, node.city, node.state, node.zip].filter(Boolean).join(', ')
    }
    if (typeof node.city === 'string' && !out.city) out.city = node.city.trim()
    if (out.name && out.lat != null && out.address) out.done = true
  }
  for (const k of Object.keys(node)) findDispensaryMeta(node[k], out, depth + 1)
}

// Dutchie keeps the full address + coordinates on the store's /info page
// (embedded page data + its own GraphQL calls) rather than in the menu feed.
// One quick visit per store that still lacks an address fills the gap.
async function fetchStoreInfo(page, slug, meta) {
  const handler = async (r) => {
    if (!/graphql/i.test(r.url())) return
    try {
      findDispensaryMeta(await r.json(), meta)
    } catch {
      /* not json */
    }
  }
  page.on('response', handler)
  try {
    await page.goto(`https://dutchie.com/dispensary/${slug}/info`, {
      waitUntil: 'domcontentloaded',
    })
    await sleep(2500)
    const nd = await page
      .evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent || null)
      .catch(() => null)
    if (nd) {
      try {
        findDispensaryMeta(JSON.parse(nd), meta)
      } catch {
        /* unparseable */
      }
    }
    if (process.env.DEBUG_STORE && !meta.address) {
      console.log(`    DEBUG ${slug}: info page yielded name=${meta.name ?? '-'} coords=${meta.lat ?? '-'} (no address)`)
    }
  } catch (err) {
    console.log(`    info page error: ${err.message.slice(0, 80)}`)
  }
  page.off('response', handler)
}

// Recursively find arrays of product-like objects in a GraphQL JSON response.
function findProductArrays(node, out, depth = 0) {
  if (!node || depth > 14) return
  if (Array.isArray(node)) {
    if (
      node.length > 0 &&
      node.every((x) => x && typeof x === 'object' && ('Prices' in x || 'Options' in x || x.__typename === 'Product'))
    ) {
      out.push(node)
    }
    for (const v of node) findProductArrays(v, out, depth + 1)
  } else if (typeof node === 'object') {
    for (const k of Object.keys(node)) findProductArrays(node[k], out, depth + 1)
  }
}

async function scrapeStore(page, storeId, slug, meta) {
  const base = `https://dutchie.com/dispensary/${slug}/products`
  const seen = new Map()
  for (const category of CATEGORIES) {
    let pageNum = 1
    while (true) {
      const captured = []
      const handler = async (r) => {
        if (!/graphql/i.test(r.url())) return
        try {
          const j = await r.json()
          const arrs = []
          findProductArrays(j, arrs)
          for (const a of arrs) captured.push(...a)
          if (!meta.done) findDispensaryMeta(j, meta)
        } catch {
          /* not json */
        }
      }
      page.on('response', handler)
      const url = pageNum === 1 ? `${base}/${category}` : `${base}/${category}?page=${pageNum}`
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        await sleep(T.load)
        for (let i = 0; i < T.scrolls; i++) {
          await page.evaluate('window.scrollTo(0, document.body.scrollHeight)').catch(() => {})
          await sleep(T.scrollWait)
        }
        await sleep(500)
      } catch (err) {
        page.off('response', handler)
        console.log(`    error ${url}: ${err.message}`)
        break
      }
      page.off('response', handler)

      const pageIds = new Set()
      let added = 0
      for (const prod of captured) {
        const row = mapApiProduct(prod, storeId, slug, category)
        if (!row.external_id || row.external_id === 'undefined') continue
        pageIds.add(row.external_id)
        if (!seen.has(row.external_id)) {
          seen.set(row.external_id, row)
          added++
        }
      }
      console.log(`    ${category} p${pageNum}: +${added}`)
      // Stop if this page wasn't full (last page) or added nothing new.
      if (pageIds.size < FULL_PAGE || added === 0) break
      pageNum++
      await sleep(T.betweenPages)
    }
  }
  return [...seen.values()]
}

async function debugApi(page, store) {
  const responses = []
  page.on('response', async (r) => {
    if (!/graphql/i.test(r.url())) return
    try {
      responses.push(await r.json())
    } catch {
      /* not json */
    }
  })
  const url = `https://dutchie.com/dispensary/${store.slug}/products/flower`
  console.log(`Loading ${url} …`)
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await sleep(8000)
  console.log(`Captured ${responses.length} graphql responses.`)
  const arrays = []
  for (const j of responses) findProductArrays(j, arrays)
  if (!arrays.length) return console.log('No product arrays found.')
  arrays.sort((a, b) => b.length - a.length)
  const p = arrays[0][0]
  console.log(`\nLargest product array: ${arrays[0].length} items`)
  console.log('PRODUCT KEYS:', Object.keys(p).join(', '))
  console.log('\nSAMPLE PRODUCT (first ~2KB):')
  console.log(JSON.stringify(p, null, 1).slice(0, 2000))
  console.log('\nMAPPED ->', JSON.stringify(mapApiProduct(p, 'debug', store.slug, 'flower')))
}

export default {
  name: 'dutchie',
  enabled: true,
  needsBrowser: true,
  // Columns Dutchie's feed can fill (description is usually empty in it).
  fields: PRODUCT_FIELDS,

  // Menu for one store, plus any store name/address/coords seen on the way.
  async scrape({ page }, store) {
    const meta = {}
    // Visit the store's info page once if we still lack its address/coords.
    if (!store.address || store.lat == null) await fetchStoreInfo(page, store.slug, meta)
    const products = await scrapeStore(page, store.id, store.slug, meta)
    return { products, meta }
  },

  // Store name/address/coords only (INFO_ONLY=1).
  async info({ page }, store) {
    const meta = {}
    await fetchStoreInfo(page, store.slug, meta)
    return meta
  },

  debug: ({ page }, store) => debugApi(page, store),
}
