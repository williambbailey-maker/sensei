// Normalize products — triggers the deterministic normalize_products() function
// in Supabase (clean_brand, clean_name, potency_tier, price_band,
// experience_level). The nightly scrape calls this automatically; run it by
// hand to re-normalize on demand:
//
//   npm run normalize          # incremental — only rows missing a field
//   FULL=1 npm run normalize   # full refresh — re-normalize everything
//
// Logic lives in the database function (see supabase/normalize_products.sql),
// so this is just the trigger. Needs the same service_role key as the scraper.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dywrisybvcorpfhbwgtg.supabase.co'
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const FULL = /^(1|true|yes)$/i.test(process.env.FULL || '')

if (!SERVICE) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is not set (see .env).')
  process.exit(1)
}

const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/normalize_products`, {
  method: 'POST',
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ full_refresh: FULL }),
})
if (!res.ok) {
  console.error(`normalize failed: ${res.status} ${(await res.text()).slice(0, 300)}`)
  process.exit(1)
}

// Report the resulting match rate.
const q = await fetch(
  `${SUPABASE_URL}/rest/v1/products?in_stock=eq.true&clean_brand=not.is.null&select=id`,
  { method: 'HEAD', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: 'count=exact', Range: '0-0' } },
)
const matched = (q.headers.get('content-range') || '').split('/')[1] || '?'
console.log(`Normalized (${FULL ? 'full' : 'incremental'}). In-stock rows with clean_brand: ${matched}.`)
