// Discover NYC dispensaries on Dutchie and add them to the stores table.
// RUN THIS ON YOUR OWN COMPUTER (same reason as the scraper: residential IP).
//
// From this pipeline folder:
//   node discover.mjs
//
// It opens dutchie.com/dispensaries pretending to stand at several points in
// Manhattan, Brooklyn, and the Bronx, captures the dispensary lists the page
// loads (name, slug, address, coordinates), filters to those boroughs, and
// inserts any store not already in Supabase. Then run `npm run scrape` to
// pull the new stores' menus.
//
// Options: DEBUG_DISCOVER=1 dump a sample raw dispensary object.
import { readFileSync } from 'node:fs'

// Self-contained .env loader so this works with plain `node discover.mjs`.
try {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (m && process.env[m[1]] === undefined) {
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1)
      process.env[m[1]] = v
    }
  }
} catch {
  /* no local .env — env vars may be set another way */
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dywrisybvcorpfhbwgtg.supabase.co'
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const DEBUG = /^(1|true|yes)$/i.test(process.env.DEBUG_DISCOVER || '')

if (!SERVICE) {
  console.error('\nERROR: SUPABASE_SERVICE_ROLE_KEY is not set (put it in .env) — cannot write stores.\n')
  process.exit(1)
}

async function sb(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

// Standing points across the three requested boroughs — Dutchie's finder is
// radius-based, so several vantage points give full coverage.
const POINTS = [
  { label: 'Lower Manhattan', latitude: 40.72, longitude: -73.997 },
  { label: 'Midtown Manhattan', latitude: 40.758, longitude: -73.9855 },
  { label: 'Upper Manhattan / Harlem', latitude: 40.81, longitude: -73.945 },
  { label: 'Downtown Brooklyn', latitude: 40.693, longitude: -73.989 },
  { label: 'Williamsburg', latitude: 40.714, longitude: -73.957 },
  { label: 'Central Brooklyn', latitude: 40.65, longitude: -73.95 },
  { label: 'South Bronx', latitude: 40.817, longitude: -73.92 },
  { label: 'Central Bronx', latitude: 40.8448, longitude: -73.8648 },
]

const CITY_BOROUGH = {
  'new york': 'Manhattan',
  manhattan: 'Manhattan',
  brooklyn: 'Brooklyn',
  bronx: 'Bronx',
}

function pickCoords(o) {
  if (!o || typeof o !== 'object') return null
  const lat = o.lt ?? o.lat ?? o.latitude
  const lng = o.ln ?? o.lng ?? o.longitude
  if (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat !== 0 &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  )
    return { lat, lng }
  return null
}

// Recursively collect dispensary-like objects: slug + name + (address/location).
function findDispensaries(node, out, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 16) return
  if (Array.isArray(node)) {
    for (const v of node) findDispensaries(v, out, depth + 1)
    return
  }
  const slug = node.cName ?? node.slug
  if (
    typeof slug === 'string' &&
    slug &&
    typeof node.name === 'string' &&
    node.name &&
    (node.address1 || node.address || node.location || node.city)
  ) {
    out.set(slug, node)
  }
  for (const k of Object.keys(node)) findDispensaries(node[k], out, depth + 1)
}

async function main() {
  const existing = await sb('stores?select=slug')
  const existingSlugs = new Set(existing.map((s) => s.slug))
  console.log(`Existing stores in DB: ${existingSlugs.size}`)

  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: false })
  const found = new Map()

  for (const pt of POINTS) {
    const ctx = await browser.newContext({
      geolocation: { latitude: pt.latitude, longitude: pt.longitude },
      permissions: ['geolocation'],
      viewport: { width: 1280, height: 900 },
    })
    const page = await ctx.newPage()
    page.setDefaultTimeout(60000)
    const captured = new Map()
    page.on('response', async (r) => {
      if (!/graphql|dispensar/i.test(r.url())) return
      try {
        const j = await r.json()
        findDispensaries(j, captured)
      } catch {
        /* not json */
      }
    })
    try {
      await page.goto('https://dutchie.com/dispensaries', { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(6000)
      // Scroll the results so lazy pages load.
      for (let i = 0; i < 6; i++) {
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)').catch(() => {})
        await page.waitForTimeout(900)
      }
    } catch (err) {
      console.log(`  ${pt.label}: page error ${err.message.slice(0, 80)}`)
    }
    for (const [slug, d] of captured) if (!found.has(slug)) found.set(slug, d)
    console.log(`${pt.label}: ${captured.size} dispensaries seen (total unique: ${found.size})`)
    await ctx.close()
  }
  await browser.close()

  if (DEBUG && found.size) {
    const sample = found.values().next().value
    console.log('\nSAMPLE RAW OBJECT KEYS:', Object.keys(sample))
    console.log(JSON.stringify(sample, null, 2).slice(0, 1500))
  }

  // Filter to Brooklyn / Manhattan / Bronx, NY.
  const rows = []
  for (const [slug, d] of found) {
    if (existingSlugs.has(slug)) continue
    const state = (d.state ?? d.stateCode ?? '').toString().toUpperCase()
    if (state && state !== 'NY' && state !== 'NEW YORK') continue
    const city = (d.city ?? '').toString().trim().toLowerCase()
    const borough = CITY_BOROUGH[city]
    if (!borough) continue
    const coords = pickCoords(d.location) ?? pickCoords(d)
    rows.push({
      slug,
      provider: 'dutchie',
      name: d.name.trim(),
      address: [d.address1 ?? d.address, d.city, 'NY', d.zip].filter(Boolean).join(', '),
      borough,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      active: true,
    })
  }

  if (!rows.length) {
    console.log('\nNo new Brooklyn/Manhattan/Bronx stores found beyond what is already in the DB.')
    console.log('If that seems wrong, re-run with DEBUG_DISCOVER=1 and share the output.')
    return
  }

  console.log(`\nAdding ${rows.length} new stores:`)
  for (const r of rows) console.log(`  [${r.borough}] ${r.name}  (${r.slug})`)
  await sb('stores', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: rows,
  })
  console.log(`\nDone. Now run:  npm run scrape   to pull their menus.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
