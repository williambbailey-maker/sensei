// Refresh the deals — triggers refresh_deals() in Supabase, which picks the
// most noteworthy sale prices on the live menu (items marked down 20–75%,
// spread across product type and borough, at most 10 per shop) and writes
// them to the deals table. Every scrape runs this at the end; run it by hand
// to re-pick on demand, or to pick a different number:
//
//   npm run deals           # pick 300
//   N=100 npm run deals     # pick 100
//
// Logic lives in the database function (see supabase/deals.sql), so this is
// just the trigger. Needs the same service_role key as the scraper.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dywrisybvcorpfhbwgtg.supabase.co'
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const N = Number(process.env.N) > 0 ? Number(process.env.N) : 300

if (!SERVICE) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is not set (see .env).')
  process.exit(1)
}
const headers = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' }

const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/refresh_deals`, { method: 'POST', headers, body: JSON.stringify({ n: N }) })
if (!res.ok) {
  console.error(`deals refresh failed: ${res.status} ${(await res.text()).slice(0, 300)}`)
  process.exit(1)
}
const wrote = await res.json()

// Show the board as the site will.
const q = await fetch(
  `${SUPABASE_URL}/rest/v1/live_deals?select=title,description,store_name,price,price_was,pct,kind&order=featured.desc,sort.asc`,
  { headers },
)
const rows = q.ok ? await q.json() : []
console.log(`Deals: ${wrote} picked from sale prices${rows.length !== wrote ? `, ${rows.length} showing` : ''}. The first 12:`)
for (const r of rows.slice(0, 12)) {
  const price = r.price != null ? `$${r.price}` : ''
  const was = r.price_was != null ? ` (was $${r.price_was}, ${r.pct}% off)` : ''
  console.log(`  ${price}${was}  ${r.title}${r.description ? ` · ${r.description}` : ''}  — ${r.store_name ?? '?'}`)
}
if (!rows.length) console.log('  (nothing on sale yet — run the scraper first; it fills in sale prices)')
