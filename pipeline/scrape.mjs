// Local Dutchie scraper — RUN THIS ON YOUR OWN COMPUTER, not in the cloud.
//
// Why local: Dutchie is behind Cloudflare, which blocks datacenter IPs (cloud
// servers) but trusts residential IPs like your home internet. A visible browser
// from your Mac gets through. This is a faithful port of the proven Python
// script to Node, so there's only one toolchain to install.
//
// Setup (once), from this folder:
//   npm install                     # installs Playwright + downloads Chromium
// Run:
//   export SUPABASE_SERVICE_ROLE_KEY="...service role key from Supabase dashboard..."
//   npm run scrape
//
// Options: HEADLESS=1 to hide the browser; STORE_LIMIT=3 for a quick test.

import crypto from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dywrisybvcorpfhbwgtg.supabase.co'
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5d3Jpc3lidmNvcnBmaGJ3Z3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDEyMzcsImV4cCI6MjA5NTg3NzIzN30.FgI4VqSYuInl2RDOzeNB4BLVTkYI-PaB7up0JTXmcnw'
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const HEADLESS = /^(1|true|yes)$/i.test(process.env.HEADLESS || '')
const STORE_LIMIT = parseInt(process.env.STORE_LIMIT || '0', 10)
const STORE = (process.env.STORE || '').trim() // scrape/debug a single slug
const CATEGORIES = ['edibles', 'flower', 'pre-rolls', 'vaporizers']
const PRODUCT_SEL = '[data-testid*="product"], .product-card, [class*="Product"]'
// SLOW=1 restores the original cautious pacing if a run gets flaky/blocked.
const SLOW = /^(1|true|yes)$/i.test(process.env.SLOW || '')
const T = SLOW
  ? { load: 5000, scrollWait: 2000, scrolls: 5, betweenPages: 3000 }
  : { load: 2200, scrollWait: 800, scrolls: 8, betweenPages: 1000 }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function sb(path, { method = 'GET', headers = {}, body, service = false } = {}) {
  const key = service ? SERVICE : ANON
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  // Writes (POST/PATCH) come back with an empty body, so parse only when there
  // is text — parsing "" as JSON was throwing "Unexpected end of JSON input".
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

// --- Extraction: faithful port of the proven Python DOM scrape --------------
const QTY_PATTERNS = [
  /Add\s+([\d.]+\s*(?:g|oz|mg|ml|pc|pcs|pack|ct|count)?)\s+to\s+cart/i,
  /\b([\d.]+\s*(?:g|oz|mg|ml|pc|pcs|pack|ct|count))\b/i,
  /\b([\d.]+\s*x\s*[\d.]+\s*(?:g|oz|mg|ml)?)\b/i,
  /\(([\d.]+\s*(?:g|oz|mg|ml|pc|pcs|pack|ct|count)?)\)/i,
  /[-|]\s*([\d.]+\s*(?:g|oz|mg|ml|pc|pcs|pack|ct|count)?)\s*(?:$|[-|])/i,
  /\b([\d.]+)\s*each\b/i,
  /cart.*?([\d.]+\s*(?:g|oz|mg|ml|pc|pcs)?)/i,
]

async function extract(el, category) {
  const allText = (await el.innerText()).trim()
  const lines = allText.split('\n').map((l) => l.trim()).filter(Boolean)

  let name = lines[0] || ''
  let brand = ''
  let strain = ''
  let thc = ''
  let cbd = ''
  let price = ''
  let quantity = ''

  for (const line of lines.slice(1, 4)) {
    if (['$', 'THC:', 'CBD:', 'Add', 'cart', 'Indica', 'Sativa', 'Hybrid'].some((x) => line.includes(x)))
      continue
    if (line.length < 50 && !/\d+\.?\d*\s*mg/.test(line)) {
      brand = line
      break
    }
  }
  const brandEl = await el.$('[class*="brand"], [class*="Brand"], [data-testid*="brand"]')
  if (brandEl) {
    const bt = (await brandEl.innerText()).trim()
    if (bt && bt.length < 50) brand = bt
  }

  if (category !== 'edibles') {
    for (const line of lines) {
      const s = ['Indica', 'Sativa', 'Hybrid'].find((x) => line.includes(x))
      if (s) {
        strain = s
        break
      }
    }
  }

  let m = allText.match(/THC[:\s]*([\d.]+)\s*%?/i)
  if (m) thc = m[1]
  m = allText.match(/CBD[:\s]*([\d.]+)\s*%?/i)
  if (m) cbd = m[1]
  // Price: pull from the card's active-price element (accurate — this is the
  // current/sale price). Fall back to the first $ in the text only if missing.
  const priceEl = await el.$('[class*="ActivePrice"], [class*="card-price"]')
  if (priceEl) {
    const pm = (await priceEl.innerText()).match(/([\d,]+\.?\d*)/)
    if (pm) price = `$${pm[1].replace(/,/g, '')}`
  }
  if (!price) {
    m = allText.match(/\$(\d+\.?\d*)/)
    if (m) price = `$${m[1]}`
  }

  let found = false
  for (const pat of QTY_PATTERNS) {
    const qm = allText.match(pat)
    if (qm) {
      const q = qm[1].trim()
      const num = parseFloat((q.match(/[\d.]+/) || ['0'])[0])
      if (!/^\d+\.?\d*$/.test(q) || num > 1000) {
        if (/mg|g|oz|ml/i.test(q)) {
          quantity = q
          found = true
          break
        }
      } else if (num <= 100) {
        quantity = q
        found = true
        break
      }
    }
  }
  if (!found) {
    const qtyEls = await el.$$('[class*="quantity"], [class*="Quantity"], [class*="weight"], [class*="Weight"], button')
    for (const qe of qtyEls) {
      const t = (await qe.innerText()).trim()
      for (const pat of QTY_PATTERNS.slice(0, 4)) {
        const qm = t.match(pat)
        if (qm) {
          quantity = qm[1].trim()
          found = true
          break
        }
      }
      if (found) break
    }
  }

  if (category === 'edibles') {
    if (thc) quantity = thc.endsWith('mg') ? thc : `${thc}mg`
    thc = ''
    if (!quantity) {
      for (const pat of [/([\d.]+\s*mg)/i, /([\d.]+mg\s*(?:THC|CBD)?)/i, /Total\s*(?:THC)?\s*[:\s]*([\d.]+\s*mg)/i]) {
        const mm = allText.match(pat)
        if (mm) {
          quantity = mm[1].trim()
          break
        }
      }
    }
  }

  let url = ''
  const link = (await el.$('a[href*="/product/"]')) || (await el.$('a'))
  if (link) {
    const href = await link.getAttribute('href')
    if (href) url = href.startsWith('/') ? `https://dutchie.com${href}` : href
  }

  let image = ''
  const img = await el.$('img')
  if (img) {
    image =
      (await img.getAttribute('src')) ||
      (await img.getAttribute('srcset'))?.split(',')[0].trim().split(' ')[0] ||
      (await img.getAttribute('data-src')) ||
      ''
  }

  return { name, brand, strain, thc, cbd, price, quantity, url, image, category }
}

// --- Map a scraped card to a Supabase products row --------------------------
const num = (x) => {
  if (!x) return null
  const m = String(x).replace(/,/g, '').match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

export function toRow(storeId, p) {
  const m = (p.url || '').match(/\/product\/([^/?#]+)/)
  const externalId =
    m?.[1] ||
    crypto.createHash('md5').update(`${storeId}|${p.name}|${p.brand}|${p.quantity}`).digest('hex').slice(0, 16)
  const price = num(p.price)
  return {
    store_id: storeId,
    external_id: externalId,
    name: p.name || null,
    brand: p.brand || null,
    category: p.category || null,
    strain_type: p.strain || null,
    thc_pct: num(p.thc),
    cbd_pct: num(p.cbd),
    variants: [{ weight: p.quantity || null, price }],
    price_min: price,
    url: p.url || null,
    image_url: p.image || null,
    in_stock: true,
    last_seen: new Date().toISOString(),
  }
}

async function scrapeStore(page, slug) {
  const base = `https://dutchie.com/dispensary/${slug}/products`
  const raw = []
  for (const category of CATEGORIES) {
    let pageNum = 1
    while (true) {
      const url = pageNum === 1 ? `${base}/${category}` : `${base}/${category}?page=${pageNum}`
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        await sleep(T.load)
        // Scroll to trigger lazy-loading, but stop as soon as the count stops
        // growing — much faster than a fixed number of scrolls.
        let prev = -1
        for (let i = 0; i < T.scrolls; i++) {
          const c = await page.$$eval(PRODUCT_SEL, (els) => els.length).catch(() => 0)
          if (c === prev) break
          prev = c
          await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
          await sleep(T.scrollWait)
        }
        const els = await page.$$(PRODUCT_SEL)
        if (els.length === 0) break
        // DEBUG_CARD=1: dump how the first few cards lay out price/text so the
        // price parser can target the right element. Prints once, then exits.
        if (process.env.DEBUG_CARD) {
          for (const el of els.slice(0, 3)) {
            console.log('\n===== CARD innerText =====')
            console.log((await el.innerText()).slice(0, 400))
            const priceLeaves = await el.$$eval('*', (nodes) =>
              nodes
                .filter((n) => n.children.length === 0 && /\$\s?\d/.test(n.textContent || ''))
                .slice(0, 8)
                .map((n) => `[${n.tagName} .${String(n.className).slice(0, 40)}] ${n.textContent.trim().slice(0, 24)}`),
            )
            console.log('  $-leaves:', JSON.stringify(priceLeaves, null, 0))
          }
          process.exit(0)
        }
        let count = 0
        for (const el of els) {
          const data = await extract(el, category)
          if (data.name) {
            raw.push(data)
            count++
          }
        }
        console.log(`    ${category} p${pageNum}: ${count}`)
        if (count < 10) break
        pageNum++
        await sleep(T.betweenPages)
      } catch (err) {
        console.log(`    error ${url}: ${err.message}`)
        break
      }
    }
  }
  return raw
}

// Recursively find arrays of product-like objects in a GraphQL JSON response.
function findProductArrays(node, out, depth = 0) {
  if (!node || depth > 14) return
  if (Array.isArray(node)) {
    if (
      node.length > 0 &&
      node.every(
        (x) =>
          x &&
          typeof x === 'object' &&
          ('Prices' in x || 'Options' in x || x.__typename === 'Product'),
      )
    ) {
      out.push(node)
    }
    for (const v of node) findProductArrays(v, out, depth + 1)
  } else if (typeof node === 'object') {
    for (const k of Object.keys(node)) findProductArrays(node[k], out, depth + 1)
  }
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
  if (!arrays.length) {
    console.log('No product arrays found in the graphql responses.')
    return
  }
  arrays.sort((a, b) => b.length - a.length)
  const products = arrays[0]
  const p = products[0]
  console.log(`\nLargest product array: ${products.length} items`)
  console.log('PRODUCT KEYS:', Object.keys(p).join(', '))
  console.log('\nSAMPLE PRODUCT (first ~2KB):')
  console.log(JSON.stringify(p, null, 1).slice(0, 2000))
}

async function main() {
  if (!SERVICE) {
    console.error(
      '\nERROR: SUPABASE_SERVICE_ROLE_KEY is not set.\n' +
        'Get it from Supabase dashboard -> Project Settings -> API -> service_role,\n' +
        'then run:  export SUPABASE_SERVICE_ROLE_KEY="the-key"  and re-run.\n',
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

  // DEBUG_API=1: capture the structured product feed the page loads (Dutchie's
  // own API) for the first store and dump its shape, so the parser can read
  // exact prices/variants from JSON instead of fragile per-store HTML.
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
      const raw = await scrapeStore(page, slug)
      // dedup by external_id so the upsert batch is clean
      const rows = new Map()
      for (const r of raw) {
        const row = toRow(id, r)
        rows.set(row.external_id, row)
      }
      const list = [...rows.values()]
      if (list.length) {
        await sb('products?on_conflict=store_id,external_id', {
          method: 'POST',
          service: true,
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: list,
        })
      }
      // anything not seen this run at this store is now out of stock
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
    body: { stores_ok: ok, stores_failed: failed, products_seen: seen, notes: 'local node scrape' },
  })
  console.log(`\nDone: ${ok} ok, ${failed} failed, ${seen} products.`)
}

// Only run when executed directly (lets tests import toRow).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
