// Local menu scraper — RUN THIS ON YOUR OWN COMPUTER, not in the cloud.
//
// Why local: Dutchie is behind Cloudflare, which blocks datacenter IPs (cloud
// servers) but trusts residential IPs like your home internet. A real browser
// from your Mac gets through.
//
// How it's organized: this file is the runner — it reads the store list from
// Supabase, hands each store to the module for its menu platform (the
// `provider` column; modules live in providers/), upserts what comes back, then
// runs the out-of-stock sweep, normalization, health checks and alerts. Each
// module returns rows in the same `products` shape.
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
//          STORE=<slug> one store · SLOW=1 cautious pacing · DEBUG_API=1 dump feed shape ·
//          DRY_RUN=1 print normalized products, write nothing (PROVIDER=<name>
//          to try a STORE slug that isn't in the stores table yet).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { PROVIDERS } from './providers/index.mjs'
import { fieldCoverage, PRODUCT_FIELDS } from './lib/product.mjs'
export { mapApiProduct } from './providers/dutchie.mjs'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dywrisybvcorpfhbwgtg.supabase.co'
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5d3Jpc3lidmNvcnBmaGJ3Z3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDEyMzcsImV4cCI6MjA5NTg3NzIzN30.FgI4VqSYuInl2RDOzeNB4BLVTkYI-PaB7up0JTXmcnw'
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const HEADLESS = /^(1|true|yes)$/i.test(process.env.HEADLESS || '')
const STORE_LIMIT = parseInt(process.env.STORE_LIMIT || '0', 10)
const STORE = (process.env.STORE || '').trim()
const DRY_RUN = /^(1|true|yes)$/i.test(process.env.DRY_RUN || '')
const PROVIDER = (process.env.PROVIDER || '').trim()
const DRY_RUN_SHOW = parseInt(process.env.DRY_RUN_SHOW || '3', 10)
// A test run (one store / first N) is marked in pipeline_runs.notes so the
// drop guard never uses it as the baseline for a full run.
const TEST_RUN = STORE ? `STORE=${STORE}` : STORE_LIMIT ? `STORE_LIMIT=${STORE_LIMIT}` : ''
// Pause between stores (random, so requests don't land on a fixed beat).
const STORE_GAP_MS = [3000, 6000]

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

// City names from a menu feed -> borough, only used when we don't know it yet.
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

// Store name/address/coords seen in a menu feed -> a `stores` patch. Curated
// fields (neighborhood) are never touched; borough only fills in when unknown.
function storePatch(store, meta) {
  const patch = {}
  if (meta.name) patch.name = meta.name
  if (meta.address) patch.address = meta.address
  if (meta.lat != null) {
    patch.lat = meta.lat
    patch.lng = meta.lng
  }
  if (!store.borough && meta.city && CITY_BOROUGH[meta.city.toLowerCase()]) {
    patch.borough = CITY_BOROUGH[meta.city.toLowerCase()]
  }
  return patch
}

// Per-store platform details (stores.config.json, keyed by slug).
function loadStoreConfig() {
  try {
    return JSON.parse(readFileSync(new URL('./stores.config.json', import.meta.url), 'utf8')).stores || {}
  } catch (e) {
    console.warn(`(stores.config.json not read: ${e.message.slice(0, 80)})`)
    return {}
  }
}

// The stores to scrape. DRY_RUN with STORE also finds inactive stores, and with
// PROVIDER set it can try a slug that isn't in the table yet.
async function loadStores() {
  const cols = 'select=id,slug,provider,borough,address,lat'
  let stores
  if (DRY_RUN && STORE) {
    stores = await sb(`stores?slug=eq.${encodeURIComponent(STORE)}&${cols}`)
    if (!stores.length) {
      if (!PROVIDER) throw new Error(`No store "${STORE}" in the stores table. Add PROVIDER=<name> to dry-run it anyway.`)
      stores = [{ id: null, slug: STORE, provider: PROVIDER, borough: null, address: null, lat: null }]
    } else if (PROVIDER) {
      stores = stores.map((s) => ({ ...s, provider: PROVIDER }))
    }
  } else {
    stores = await sb(`stores?active=eq.true&${cols}`)
    if (STORE) stores = stores.filter((s) => s.slug === STORE)
    if (STORE_LIMIT) stores = stores.slice(0, STORE_LIMIT)
  }
  const config = loadStoreConfig()
  return stores.map((s) => ({ ...s, config: config[s.slug] || {} }))
}

// In-stock external_ids Supabase currently has for a store (read-only, paged
// past the API's 1000-row cap). Lets a dry run show how it compares to live.
async function liveIds(storeId) {
  const ids = new Set()
  for (let from = 0; ; from += 1000) {
    const rows = await sb(`products?store_id=eq.${storeId}&in_stock=eq.true&select=external_id&order=external_id`, {
      headers: { Range: `${from}-${from + 999}` },
    })
    for (const r of rows) ids.add(r.external_id)
    if (rows.length < 1000) return ids
  }
}

// DRY_RUN output for one store: field coverage, a few sample rows, the diff
// against what's live, and the full list saved to logs/ for a closer look.
async function dryRunReport(store, provider, products, meta) {
  const cov = fieldCoverage(products)
  console.log(`\n  ${products.length} products (nothing written)`)
  console.log('  field coverage (% of products with a value):')
  for (const f of PRODUCT_FIELDS) {
    const note = provider.fields.includes(f) ? '' : '   ← not provided by this platform (left null)'
    console.log(`    ${f.padEnd(18)} ${String(cov[f]).padStart(3)}%${note}`)
  }
  const patch = storePatch(store, meta)
  if (Object.keys(patch).length) console.log(`  would update store: ${JSON.stringify(patch)}`)
  if (store.id) {
    try {
      const live = await liveIds(store.id)
      const scraped = new Set(products.map((p) => p.external_id))
      const both = [...scraped].filter((id) => live.has(id)).length
      console.log(
        `  vs live: ${both} of ${scraped.size} scraped are already in stock in Supabase · ` +
          `${scraped.size - both} new · ${live.size - both} live items not seen (would be swept)`,
      )
    } catch (e) {
      console.log(`  vs live: could not read current products (${e.message.slice(0, 80)})`)
    }
  }
  for (const p of products.slice(0, DRY_RUN_SHOW)) console.log(JSON.stringify(p, null, 2))
  mkdirSync(new URL('./logs/', import.meta.url), { recursive: true })
  const file = new URL(`./logs/dry-run-${store.slug}-${Date.now()}.json`, import.meta.url)
  writeFileSync(file, JSON.stringify({ store: store.slug, provider: provider.name, coverage: cov, meta, products }, null, 2))
  console.log(`  full list: ${file.pathname}`)
}

// The last run worth comparing against: not a test run, and it covered at
// least half as many stores as this one. A 1-store test row would otherwise
// make every following full run look like a jump and switch the guard off.
async function guardBaseline(attempted) {
  try {
    const rows = await sb('pipeline_runs?select=products_seen,stores_ok,stores_failed,notes&order=ran_at.desc&limit=20', {
      service: true,
    })
    const prev = (rows || []).find(
      (r) => !/test run/.test(r.notes || '') && (r.stores_ok || 0) + (r.stores_failed || 0) >= attempted * 0.5,
    )
    return prev ? prev.products_seen : null
  } catch {
    return null // first run — no prior to compare against
  }
}

let runId = null // pipeline_runs row of this run, once written
let runNotes = '' // its notes so far, so a crash can add to them

async function main() {
  if (!SERVICE && !DRY_RUN) {
    console.error(
      '\nERROR: SUPABASE_SERVICE_ROLE_KEY is not set.\n' +
        'Get it from Supabase dashboard -> Project Settings -> API -> service_role,\n' +
        'then put it in a .env file (cp .env.example .env) and re-run.\n',
    )
    process.exit(1)
  }
  // Fail fast if the service key is rejected — otherwise we'd scrape everything
  // and then 401 on every write.
  if (!DRY_RUN) {
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
  }

  const runStart = new Date().toISOString()
  const all = await loadStores()
  // Stores whose platform has no module yet (or isn't switched on) are skipped,
  // not failed. A dry run tries disabled modules so they can be tested first.
  const stores = []
  const skipped = {}
  for (const s of all) {
    const p = PROVIDERS[s.provider]
    if (p && (p.enabled || DRY_RUN)) stores.push(s)
    else skipped[s.provider] = (skipped[s.provider] || 0) + 1
  }
  const skippedNote = Object.entries(skipped)
    .map(([p, n]) => `${n} ${p}`)
    .join(', ')
  console.log(
    `Active stores: ${stores.length}${skippedNote ? ` (skipped, no enabled module: ${skippedNote})` : ''}` +
      `${HEADLESS ? ' (headless)' : ''}${DRY_RUN ? ' · DRY RUN — nothing is written' : ''}`,
  )
  if (DRY_RUN && !STORE && !STORE_LIMIT) console.log('(tip: DRY_RUN is meant for one store — add STORE=<slug>)')

  let browser = null
  const ctx = {}
  if (stores.some((s) => PROVIDERS[s.provider].needsBrowser)) {
    const { chromium } = await import('playwright')
    browser = await chromium.launch({ headless: HEADLESS })
    ctx.page = await browser.newPage()
    ctx.page.setDefaultTimeout(60000)
  }

  if (process.env.DEBUG_API) {
    const s = stores.find((x) => PROVIDERS[x.provider].debug)
    if (s) await PROVIDERS[s.provider].debug(ctx, s)
    else console.log('No store with a debug-capable module.')
    await browser?.close()
    return
  }

  // INFO_ONLY=1 — refresh store addresses/coordinates without scraping any
  // menus. A few seconds per store.
  if (/^(1|true|yes)$/i.test(process.env.INFO_ONLY || '')) {
    console.log('Address-only refresh (no menus)…')
    let updated = 0
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i]
      const provider = PROVIDERS[store.provider]
      if ((store.address && store.lat != null) || !provider.info) continue
      console.log(`[${i + 1}/${stores.length}] ${store.slug}`)
      const patch = storePatch(store, await provider.info(ctx, store))
      if (Object.keys(patch).length) {
        if (!DRY_RUN) {
          await sb(`stores?id=eq.${store.id}`, { method: 'PATCH', service: true, body: patch }).catch(() => {})
        }
        updated++
        console.log(`  ${patch.address ?? patch.name ?? 'updated'}`)
      } else {
        console.log('  nothing captured')
      }
    }
    await browser?.close()
    console.log(`\nAddress refresh done: ${updated} stores ${DRY_RUN ? 'would be ' : ''}updated.`)
    return
  }

  let ok = 0
  let empty = 0
  let failed = 0
  let seen = 0
  const byProvider = {} // provider -> { ok, empty, failed }
  // Stores that returned products this run — only these get the out-of-stock
  // sweep, so a store that failed or returned nothing keeps its inventory.
  const sweepStoreIds = []
  for (let i = 0; i < stores.length; i++) {
    const store = stores[i]
    const provider = PROVIDERS[store.provider]
    const tally = (byProvider[provider.name] ||= { ok: 0, empty: 0, failed: 0 })
    console.log(`\n[${i + 1}/${stores.length}] ${store.slug}${provider.name === 'dutchie' ? '' : ` (${provider.name})`}`)
    try {
      const { products: list, meta } = await provider.scrape(ctx, store)
      if (DRY_RUN) {
        await dryRunReport(store, provider, list, meta)
      } else {
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
          sweepStoreIds.push(store.id)
        }
        // Backfill the store's real name/address/coordinates from the feed.
        const patch = storePatch(store, meta)
        if (Object.keys(patch).length) {
          await sb(`stores?id=eq.${store.id}`, { method: 'PATCH', service: true, body: patch }).catch(() => {})
          console.log(`  store info: ${[patch.name, patch.borough, patch.lat != null ? 'coords' : null].filter(Boolean).join(' · ') || 'updated'}`)
        }
        console.log(`  -> ${list.length} products upserted`)
      }
      // A store that returns nothing is a failure too (blocked, moved, or
      // closed) — it just doesn't throw. Its inventory is left as is.
      if (list.length) {
        ok++
        tally.ok++
      } else {
        empty++
        tally.empty++
        console.log(`  EMPTY ${store.slug}: no products returned`)
      }
      seen += list.length
    } catch (err) {
      failed++
      tally.failed++
      console.log(`  FAILED ${store.slug}: ${err.message}`)
    }
    if (i < stores.length - 1) await sleep(STORE_GAP_MS[0] + Math.random() * (STORE_GAP_MS[1] - STORE_GAP_MS[0]))
  }

  await browser?.close()

  const tallies = Object.entries(byProvider)
    .map(([p, t]) => `${p} ${t.ok} ok/${t.empty} empty/${t.failed} failed`)
    .join(' · ')
  if (DRY_RUN) {
    console.log(`\nDry run done: ${tallies || 'no stores'} · ${seen} products · nothing written.`)
    return
  }

  // --- record the run before the heavy steps ------------------------------
  // Written now (and finished at the end) so a run that dies during the sweep
  // or normalize still leaves its counts in pipeline_runs.
  const attempted = ok + empty + failed
  const prevSeen = await guardBaseline(attempted)
  const label = `local node scrape${TEST_RUN ? ` · test run (${TEST_RUN})` : ''}`
  const head = [tallies, skippedNote ? `skipped ${skippedNote}` : null].filter(Boolean)
  const runRow = { stores_ok: ok, stores_failed: empty + failed, products_seen: seen }
  try {
    const rows = await sb('pipeline_runs', {
      method: 'POST',
      service: true,
      headers: { Prefer: 'return=representation' },
      body: { ...runRow, notes: `${label} · ${[...head, 'finishing (sweep/normalize not done)'].join(' · ')}` },
    })
    runNotes = `${label} · ${head.join(' · ')}`
    runId = rows?.[0]?.id ?? null
  } catch (e) {
    console.warn(`(could not write the run row yet: ${e.message.slice(0, 120)})`)
  }

  // --- 30% drop guard: protect the live snapshot ---------------------------
  // The out-of-stock sweep flips unseen items to sold out. If this run saw far
  // fewer products than the last good run, something broke (a block, a feed
  // change) — skip the sweep and keep the last snapshot rather than emptying
  // the menu.
  const notes = [...head]
  let swept = false
  const guardTripped = prevSeen != null && prevSeen > 0 && seen < prevSeen * (1 - DROP_GUARD)
  if (guardTripped) {
    notes.push(`GUARD: seen ${seen} vs last ${prevSeen} (>${DROP_GUARD * 100}% drop) — sweep skipped, snapshot kept`)
  } else if (sweepStoreIds.length) {
    // One database call (sweep_out_of_stock, supabase/pipeline_functions.sql)
    // with its own 2-minute timeout: a plain PATCH hits the API's 8s limit
    // when a backlog of sold-out items builds up after missed nights. A
    // failure is recorded and alerted, never a crash, so the run still logs.
    try {
      const n = await sb('rpc/sweep_out_of_stock', {
        method: 'POST',
        service: true,
        body: { store_ids: sweepStoreIds, before: runStart },
      })
      notes.push(`swept ${n ?? 0} sold out`)
      swept = true
    } catch (e) {
      notes.push(`sweep failed: ${e.message.slice(-120)}`)
      await sendAlert('Scrape: out-of-stock sweep failed', e.message.slice(-1500))
    }
  }

  // --- normalize new products ----------------------------------------------
  // Populate clean_brand / clean_name / potency_tier / price_band /
  // experience_level for anything new this run (deterministic, runs in the DB
  // via the normalize_products() function). Runs before the match-rate check so
  // the number reflects fresh data.
  try {
    await sb('rpc/normalize_products', { method: 'POST', service: true, body: {} })
  } catch (e) {
    notes.push(`normalize failed: ${e.message.slice(0, 80)}`)
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
    // Computed in the database: listing every recent product row through the
    // API is capped at 1000 rows, which marked healthy stores as stale.
    const rows = await sb('rpc/stale_store_slugs', { method: 'POST', service: true, body: { days: STALE_DAYS } })
    staleSlugs = (rows || []).map((r) => (typeof r === 'string' ? r : r.stale_store_slugs))
  } catch (e) {
    notes.push(`stale-store query failed: ${e.message.slice(0, 80)}`)
  }
  if (matchRate != null) notes.push(`match ${matchRate}% (${matched}/${inStock})`)
  if (staleSlugs.length) notes.push(`stale(${staleSlugs.length}): ${staleSlugs.slice(0, 10).join(', ')}${staleSlugs.length > 10 ? '…' : ''}`)
  notes.push(swept ? 'sweep applied' : guardTripped ? 'sweep skipped' : 'no sweep')

  const final = {
    ...runRow,
    products_tagged: matched, // in-stock rows with clean_brand (the match count)
    notes: `${label} · ${notes.join(' · ')}`,
  }
  if (runId) await sb(`pipeline_runs?id=eq.${runId}`, { method: 'PATCH', service: true, body: final })
  else await sb('pipeline_runs', { method: 'POST', service: true, body: final })
  console.log(`\nDone: ${ok} ok, ${empty} empty, ${failed} failed, ${seen} products · ${notes.join(' · ')}`)

  // --- alerts --------------------------------------------------------------
  if (guardTripped) {
    await sendAlert(
      'Scrape guard tripped — snapshot kept',
      `products_seen=${seen} vs last ${prevSeen} (>${DROP_GUARD * 100}% drop). The out-of-stock sweep was skipped to protect the live menu. Check for a Cloudflare block or a feed change, then re-run.`,
    )
  } else if (ok === 0 || seen === 0) {
    await sendAlert(
      'Scrape returned zero changes',
      `${ok} stores ok, ${empty} empty, ${failed} failed, ${seen} products seen. Nothing was captured — likely a block or feed change.`,
    )
  } else if (empty + failed > ok) {
    await sendAlert(
      'Scrape: majority of stores failed',
      `${empty + failed} failed or empty vs ${ok} ok (${tallies}), ${seen} products seen. Inventory may be partial.`,
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
    // Mark this run's row so a crash after the scrape is visible in the table.
    if (runId) {
      await sb(`pipeline_runs?id=eq.${runId}`, {
        method: 'PATCH',
        service: true,
        body: { notes: `${runNotes} · CRASHED after scrape: ${String(e?.message || e).slice(0, 200)}` },
      }).catch(() => {})
    }
    await sendAlert('Scrape crashed', String((e && e.stack) || e).slice(0, 1500))
    process.exit(1)
  })
}
