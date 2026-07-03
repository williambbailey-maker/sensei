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
const CATEGORIES = ['edibles', 'flower', 'pre-rolls', 'vaporizers']

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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
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
  m = allText.match(/\$(\d+\.?\d*)/)
  if (m) price = `$${m[1]}`

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
  const m = String(x).match(/[\d.]+/)
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
        await sleep(5000)
        for (let i = 0; i < 5; i++) {
          await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
          await sleep(2000)
        }
        const els = await page.$$('[data-testid*="product"], .product-card, [class*="Product"]')
        if (els.length === 0) break
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
        await sleep(3000)
      } catch (err) {
        console.log(`    error ${url}: ${err.message}`)
        break
      }
    }
  }
  return raw
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
  if (STORE_LIMIT) stores = stores.slice(0, STORE_LIMIT)
  console.log(`Active stores: ${stores.length}${HEADLESS ? ' (headless)' : ''}`)

  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: HEADLESS })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

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
          headers: { Prefer: 'resolution=merge-duplicates' },
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
