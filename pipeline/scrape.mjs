// Local Dutchie scraper — RUN THIS ON YOUR OWN COMPUTER, not in the cloud.
//
// Why local: Dutchie is behind Cloudflare, which blocks datacenter IPs (cloud
// servers) but trusts residential IPs like your home internet. A real browser
// from your Mac gets through.
//
// How it reads data: it loads each store's category pages in a real browser
// (to pass Cloudflare) and captures the STRUCTURED PRODUCT FEED the page fetches
// (Dutchie's GraphQL) — exact prices, every pack size, strain, potency — instead
// of scraping the rendered HTML (which varies per store template). Writes to
// Supabase.
//
// Setup (once), from this folder:
//   npm install
//   cp .env.example .env   # then paste your service_role key into .env
// Run (scrapes every active store):
//   npm run scrape
//
// Your key is read from a plain .env in this folder (via --env-file in the npm
// script). Nothing else to configure.
//
// Options: HEADLESS=1 hide browser · STORE_LIMIT=3 first N stores (testing) ·
//          STORE=<slug> one store · SLOW=1 cautious pacing · DEBUG_API=1 dump feed shape.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dywrisybvcorpfhbwgtg.supabase.co'
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5d3Jpc3lidmNvcnBmaGJ3Z3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDEyMzcsImV4cCI6MjA5NTg3NzIzN30.FgI4VqSYuInl2RDOzeNB4BLVTkYI-PaB7up0JTXmcnw'
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const HEADLESS = /^(1|true|yes)$/i.test(process.env.HEADLESS || '')
const STORE_LIMIT = parseInt(process.env.STORE_LIMIT || '0', 10)
const STORE = (process.env.STORE || '').trim()
const CATEGORIES = ['flower', 'edibles', 'pre-rolls', 'vaporizers', 'concentrates', 'tinctures', 'topicals']
const SLOW = /^(1|true|yes)$/i.test(process.env.SLOW || '')
const T = SLOW
  ? { load: 4000, scrollWait: 1500, scrolls: 4, betweenPages: 2000 }
  : { load: 1200, scrollWait: 350, scrolls: 2, betweenPages: 250 }
// A "full" page returns ~100 products; fewer means it's the last page, so we
// can stop without fetching an empty next page.
const FULL_PAGE = 90

// --- Block 2: pipeline health ------------------------------------------------
// Email alerts via Resend (optional — logs to console when unset). Config lives
// in .env next to the Supabase key. ALERT_EMAIL_FROM must be on a Resend-verified
// domain; the default onboarding sender only delivers to your own Resend account.
const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim()
const ALERT_TO = (process.env.ALERT_EMAIL_TO || '').trim()
const ALERT_FROM = (process.env.ALERT_EMAIL_FROM || 'Sensei Pipeline <onboarding@resend.dev>').trim()
const DROP_GUARD = 0.3 // skip the destructive out-of-stock sweep if products_seen falls >30%
const STALE_DAYS = 3 // a store with no product update in this many days is "stale"
const MATCH_TARGET = 90 // match-rate target (% of in-stock rows with clean_brand)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function sb(path, { method = 'GET', headers = {}, body, service = false } = {}) {
  const key = service ? SERVICE : ANON
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  // Writes come back with an empty body — parse only when there's text.
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

// Exact row count via PostgREST's Content-Range header (Prefer: count=exact).
async function sbCount(path) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}${sep}select=id`, {
    method: 'HEAD',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: 'count=exact', Range: '0-0' },
  })
  const total = (res.headers.get('content-range') || '').split('/')[1]
  return total && total !== '*' ? parseInt(total, 10) : 0
}

// Email an alert via Resend. Always logs to the console; emails too when
// RESEND_API_KEY + ALERT_EMAIL_TO are set. Never throws — a broken alert must
// not fail the scrape.
async function sendAlert(subject, body) {
  console.warn(`\n⚠ ALERT: ${subject}\n${body}`)
  if (!RESEND_API_KEY || !ALERT_TO) return
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: ALERT_FROM,
        to: ALERT_TO.split(',').map((s) => s.trim()).filter(Boolean),
        subject: `[Sensei] ${subject}`,
        text: body,
      }),
    })
    console.warn(res.ok ? '  (alert email sent)' : `  (alert email failed: ${res.status} ${(await res.text()).slice(0, 140)})`)
  } catch (e) {
    console.warn(`  (alert email error: ${e.message.slice(0, 120)})`)
  }
}

const num = (x) => {
  if (x === null || x === undefined) return null
  const m = String(x).replace(/,/g, '').match(/-?[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

// --- Parse a Dutchie GraphQL product object into a Supabase row -------------
function normCategory(type, fallback) {
  const t = String(type || '').toLowerCase()
  if (t.includes('pre-roll') || t.includes('preroll') || t.includes('pre roll')) return 'pre-rolls'
  if (t.includes('vap')) return 'vaporizers'
  if (t.includes('edible')) return 'edibles'
  if (t.includes('flower')) return 'flower'
  if (t.includes('concentrate')) return 'concentrates'
  if (t.includes('tincture')) return 'tinctures'
  if (t.includes('topical')) return 'topicals'
  return fallback || (type ? t : null)
}

// Only a percentage potency maps to thc_pct/cbd_pct; mg (edibles) is skipped.
function potencyPct(content) {
  if (!content) return null
  const unit = String(content.unit || '').toUpperCase()
  if (unit && !unit.startsWith('PERCENT')) return null
  if (!Array.isArray(content.range)) return null
  const vals = content.range.filter((v) => typeof v === 'number')
  return vals.length ? Math.max(...vals) : null
}

// Dutchie product descriptions often carry light HTML entities/tags. Strip to
// clean, single-spaced text and cap the length so rows stay lean.
function cleanDescription(raw) {
  if (!raw || typeof raw !== 'string') return null
  const text = raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h\d)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&rsquo;|&apos;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  return text.length > 1500 ? text.slice(0, 1497).trimEnd() + '…' : text
}

// Dutchie's `effects` come as an array of strings or small objects; normalize
// to a deduped list of effect names.
function extractEffects(raw) {
  if (!Array.isArray(raw)) return null
  const out = []
  for (const e of raw) {
    let v = null
    if (typeof e === 'string') v = e
    else if (e && typeof e === 'object') v = e.name || e.effect || e.displayName || e.label || null
    if (v && typeof v === 'string') {
      const s = v.trim()
      if (s && !out.includes(s)) out.push(s)
    }
  }
  return out.length ? out.slice(0, 8) : null
}

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

// City names from Dutchie -> borough, only used when we don't know it yet.
const CITY_BOROUGH = {
  'new york': 'Manhattan',
  manhattan: 'Manhattan',
  brooklyn: 'Brooklyn',
  williamsburg: 'Brooklyn',
  queens: 'Queens',
  astoria: 'Queens',
  'long island city': 'Queens',
  flushing: 'Queens',
  jamaica: 'Queens',
  bronx: 'Bronx',
  'staten island': 'Staten Island',
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

async function main() {
  if (!SERVICE) {
    console.error(
      '\nERROR: SUPABASE_SERVICE_ROLE_KEY is not set.\n' +
        'Get it from Supabase dashboard -> Project Settings -> API -> service_role,\n' +
        'then put it in a .env file (cp .env.example .env) and re-run.\n',
    )
    process.exit(1)
  }
  // Fail fast if the service key is rejected — otherwise we'd scrape everything
  // and then 401 on every write.
  try {
    await sb('pipeline_runs?select=id&limit=1', { service: true })
  } catch (e) {
    console.error(
      `\nERROR: your SUPABASE_SERVICE_ROLE_KEY was rejected by Supabase.\n${e.message.slice(0, 140)}\n\n` +
        'Open .env and make sure the value is the *service_role* key (not anon),\n' +
        'copied whole from Supabase -> Project Settings -> API -> service_role.\n',
    )
    process.exit(1)
  }

  const runStart = new Date().toISOString()
  let stores = await sb('stores?active=eq.true&select=id,slug,borough,address,lat')
  if (STORE) stores = stores.filter((s) => s.slug === STORE)
  if (STORE_LIMIT) stores = stores.slice(0, STORE_LIMIT)
  console.log(`Active stores: ${stores.length}${HEADLESS ? ' (headless)' : ''}`)

  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: HEADLESS })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

  if (process.env.DEBUG_API) {
    await debugApi(page, stores[0])
    await browser.close()
    return
  }

  // INFO_ONLY=1 — refresh store addresses/coordinates from /info pages
  // without scraping any menus. A few seconds per store.
  if (/^(1|true|yes)$/i.test(process.env.INFO_ONLY || '')) {
    console.log('Address-only refresh (no menus)…')
    let updated = 0
    for (let i = 0; i < stores.length; i++) {
      const { id, slug, borough, address, lat } = stores[i]
      if (address && lat != null) continue
      const meta = {}
      console.log(`[${i + 1}/${stores.length}] ${slug}`)
      await fetchStoreInfo(page, slug, meta)
      const patch = {}
      if (meta.name) patch.name = meta.name
      if (meta.address) patch.address = meta.address
      if (meta.lat != null) {
        patch.lat = meta.lat
        patch.lng = meta.lng
      }
      if (!borough && meta.city && CITY_BOROUGH[meta.city.toLowerCase()]) {
        patch.borough = CITY_BOROUGH[meta.city.toLowerCase()]
      }
      if (Object.keys(patch).length) {
        await sb(`stores?id=eq.${id}`, { method: 'PATCH', service: true, body: patch }).catch(
          () => {},
        )
        updated++
        console.log(`  ${patch.address ?? patch.name ?? 'updated'}`)
      } else {
        console.log('  nothing captured')
      }
    }
    await browser.close()
    console.log(`\nAddress refresh done: ${updated} stores updated.`)
    return
  }

  let ok = 0
  let failed = 0
  let seen = 0
  // Stores that returned products this run — only these get the out-of-stock
  // sweep, so a store that failed or returned nothing keeps its inventory.
  const sweepStoreIds = []
  for (let i = 0; i < stores.length; i++) {
    const { id, slug, borough, address, lat } = stores[i]
    console.log(`\n[${i + 1}/${stores.length}] ${slug}`)
    try {
      const meta = {}
      // Visit the store's info page once if we still lack its address/coords.
      if (!address || lat == null) await fetchStoreInfo(page, slug, meta)
      const list = await scrapeStore(page, id, slug, meta)
      if (list.length) {
        await sb('products?on_conflict=store_id,external_id', {
          method: 'POST',
          service: true,
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: list,
        })
        // The out-of-stock sweep is deferred to a single gated step after the
        // loop (see the 30% drop guard), so a systemic failure can't nuke the
        // live menu store-by-store before we notice.
        sweepStoreIds.push(id)
      }
      // Backfill the store's real name/address/coordinates from the feed.
      // Curated fields (neighborhood) are never touched; borough only fills
      // in when it's still unknown.
      const patch = {}
      if (meta.name) patch.name = meta.name
      if (meta.address) patch.address = meta.address
      if (meta.lat != null) {
        patch.lat = meta.lat
        patch.lng = meta.lng
      }
      if (!borough && meta.city && CITY_BOROUGH[meta.city.toLowerCase()]) {
        patch.borough = CITY_BOROUGH[meta.city.toLowerCase()]
      }
      if (Object.keys(patch).length) {
        await sb(`stores?id=eq.${id}`, { method: 'PATCH', service: true, body: patch }).catch(
          () => {},
        )
        console.log(`  store info: ${[patch.name, patch.borough, patch.lat != null ? 'coords' : null].filter(Boolean).join(' · ') || 'updated'}`)
      }
      ok++
      seen += list.length
      console.log(`  -> ${list.length} products upserted`)
    } catch (err) {
      failed++
      console.log(`  FAILED ${slug}: ${err.message}`)
    }
  }

  await browser.close()

  // --- 30% drop guard: protect the live snapshot ---------------------------
  // The out-of-stock sweep flips unseen items to sold out. If this run saw far
  // fewer products than the last good run, something broke (a block, a feed
  // change) — skip the sweep and keep the last snapshot rather than emptying
  // the menu.
  let prevSeen = null
  try {
    const prev = await sb('pipeline_runs?select=products_seen&order=ran_at.desc&limit=1', { service: true })
    if (prev && prev.length) prevSeen = prev[0].products_seen
  } catch {
    /* first run — no prior to compare against */
  }
  const notes = []
  let swept = false
  const guardTripped = prevSeen != null && prevSeen > 0 && seen < prevSeen * (1 - DROP_GUARD)
  if (guardTripped) {
    notes.push(`GUARD: seen ${seen} vs last ${prevSeen} (>${DROP_GUARD * 100}% drop) — sweep skipped, snapshot kept`)
  } else if (sweepStoreIds.length) {
    for (let i = 0; i < sweepStoreIds.length; i += 50) {
      const ids = sweepStoreIds.slice(i, i + 50).join(',')
      await sb(`products?store_id=in.(${ids})&last_seen=lt.${runStart}&in_stock=eq.true`, {
        method: 'PATCH',
        service: true,
        body: { in_stock: false },
      })
    }
    swept = true
  }

  // --- match rate + stale stores -------------------------------------------
  // Match rate = in-stock rows with clean_brand (normalized), target ≥90%.
  let matched = 0
  let inStock = 0
  let matchRate = null
  let staleSlugs = []
  try {
    inStock = await sbCount('products?in_stock=eq.true')
    matched = await sbCount('products?in_stock=eq.true&clean_brand=not.is.null')
    matchRate = inStock ? Math.round((matched / inStock) * 1000) / 10 : null
  } catch (e) {
    notes.push(`match-rate query failed: ${e.message.slice(0, 80)}`)
  }
  try {
    const cutoff = new Date(Date.now() - STALE_DAYS * 864e5).toISOString()
    const recent = await sb(`products?last_seen=gte.${cutoff}&select=store_id`, { service: true })
    const fresh = new Set((recent || []).map((r) => r.store_id))
    const active = await sb('stores?active=eq.true&select=slug,id', { service: true })
    staleSlugs = (active || []).filter((s) => !fresh.has(s.id)).map((s) => s.slug)
  } catch (e) {
    notes.push(`stale-store query failed: ${e.message.slice(0, 80)}`)
  }
  if (matchRate != null) notes.push(`match ${matchRate}% (${matched}/${inStock})`)
  if (staleSlugs.length) notes.push(`stale(${staleSlugs.length}): ${staleSlugs.slice(0, 10).join(', ')}${staleSlugs.length > 10 ? '…' : ''}`)
  notes.push(swept ? 'sweep applied' : guardTripped ? 'sweep skipped' : 'no sweep')

  await sb('pipeline_runs', {
    method: 'POST',
    service: true,
    body: {
      stores_ok: ok,
      stores_failed: failed,
      products_seen: seen,
      products_tagged: matched, // in-stock rows with clean_brand (the match count)
      notes: `local node scrape · ${notes.join(' · ')}`,
    },
  })
  console.log(`\nDone: ${ok} ok, ${failed} failed, ${seen} products · ${notes.join(' · ')}`)

  // --- alerts --------------------------------------------------------------
  if (guardTripped) {
    await sendAlert(
      'Scrape guard tripped — snapshot kept',
      `products_seen=${seen} vs last ${prevSeen} (>${DROP_GUARD * 100}% drop). The out-of-stock sweep was skipped to protect the live menu. Check for a Cloudflare block or a Dutchie feed change, then re-run.`,
    )
  } else if (ok === 0 || seen === 0) {
    await sendAlert(
      'Scrape returned zero changes',
      `${ok} stores ok, ${failed} failed, ${seen} products seen. Nothing was captured — likely a block or feed change.`,
    )
  } else if (failed > ok) {
    await sendAlert(
      'Scrape: majority of stores failed',
      `${failed} failed vs ${ok} ok, ${seen} products seen. Inventory may be partial.`,
    )
  }
  if (matchRate != null && matchRate < MATCH_TARGET) {
    await sendAlert(
      'Match rate below target',
      `Match rate ${matchRate}% (${matched}/${inStock}) is under the ${MATCH_TARGET}% target — normalization may be lagging.`,
    )
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(async (e) => {
    console.error(e)
    await sendAlert('Scrape crashed', String((e && e.stack) || e).slice(0, 1500))
    process.exit(1)
  })
}
