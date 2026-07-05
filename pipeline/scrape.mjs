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
// Run:
//   cp .env.example .env   # paste your service_role key into .env
//   npm run scrape
//
// Options: HEADLESS=1 hide browser · STORE_LIMIT=3 first N stores ·
//          STORE=<slug> one store · SLOW=1 cautious pacing · DEBUG_API=1 dump feed shape.

// Load config from a permanent, code-independent location: ~/.sensei/.env .
// This is the recommended home for your keys — it's separate from the code, so
// re-downloading / updating the script never touches it. Values here take
// precedence. A local ./.env (via --env-file) still works as a fallback.
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      // Don't clobber a value already set in the environment (standard dotenv
      // behavior) — lets `STORE_LIMIT=0 npm run scrape` override the file.
      if (process.env[m[1]] === undefined) process.env[m[1]] = v
    }
  } catch {
    /* file not present — fine */
  }
}
loadEnvFile(join(homedir(), '.sensei', '.env'))

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

async function scrapeStore(page, storeId, slug) {
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
  let stores = await sb('stores?active=eq.true&select=id,slug')
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

  let ok = 0
  let failed = 0
  let seen = 0
  for (let i = 0; i < stores.length; i++) {
    const { id, slug } = stores[i]
    console.log(`\n[${i + 1}/${stores.length}] ${slug}`)
    try {
      const list = await scrapeStore(page, id, slug)
      if (list.length) {
        await sb('products?on_conflict=store_id,external_id', {
          method: 'POST',
          service: true,
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: list,
        })
      }
      await sb(`products?store_id=eq.${id}&last_seen=lt.${runStart}&in_stock=eq.true`, {
        method: 'PATCH',
        service: true,
        body: { in_stock: false },
      })
      ok++
      seen += list.length
      console.log(`  -> ${list.length} products upserted`)
    } catch (err) {
      failed++
      console.log(`  FAILED ${slug}: ${err.message}`)
    }
  }

  await browser.close()
  await sb('pipeline_runs', {
    method: 'POST',
    service: true,
    body: { stores_ok: ok, stores_failed: failed, products_seen: seen, notes: 'local node scrape (api feed)' },
  })
  console.log(`\nDone: ${ok} ok, ${failed} failed, ${seen} products.`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
