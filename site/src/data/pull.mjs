// Regenerate src/data/seo.json from LIVE Supabase.
//
// Run this from an UNBLOCKED network (your own machine) — the cloud build
// sandbox blocks outbound Supabase, which is why the committed seo.json is a
// snapshot. Reads are via the public anon key (RLS: public read), so no secret
// is needed. Connection details mirror pipeline/scrape.mjs.
//
//   node src/data/pull.mjs
//
// It selects the same samples the templates expect: 3 dispensaries, 2
// neighborhoods, 2 brands (stocked at 3+ stores), and the pre-rolls category.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dywrisybvcorpfhbwgtg.supabase.co'
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5d3Jpc3lidmNvcnBmaGJ3Z3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDEyMzcsImV4cCI6MjA5NTg3NzIzN30.FgI4VqSYuInl2RDOzeNB4BLVTkYI-PaB7up0JTXmcnw'

const DISPENSARY_SLUGS = ['qube-manhattan', 'brooklyn-bourne', 'terp-bros-astoria']
const NEIGHBORHOODS = ['Midtown', 'Williamsburg']
const BRANDS = ['ayrloom', 'STIIIZY']
const CATEGORY = 'pre-rolls'

const slugify = (s) =>
  String(s).toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  })
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// The template only needs a handful of fields per product.
const pickProduct = (p) => ({
  name: p.clean_name || p.name,
  brand: p.brand,
  category: p.category,
  strain_type: p.strain_type,
  thc_pct: p.thc_pct,
  price_min: p.price_min,
  image_url: p.image_url,
  url: p.url,
})

async function main() {
  const stores = await rest('stores?active=eq.true&select=id,slug,name,address,borough,neighborhood,lat,lng')
  const byId = Object.fromEntries(stores.map((s) => [s.id, s]))
  const bySlug = Object.fromEntries(stores.map((s) => [s.slug, s]))
  const allProducts = await rest(
    'products?in_stock=eq.true&select=store_id,clean_name,name,brand,category,strain_type,thc_pct,price_min,image_url,url',
  )
  const prices = (rows) => rows.map((r) => r.price_min).filter((n) => typeof n === 'number' && n > 0)
  const counts = (rows, key) =>
    rows.reduce((m, r) => (r[key] ? ((m[r[key]] = (m[r[key]] || 0) + 1), m) : m), {})

  const dispensaries = DISPENSARY_SLUGS.map((slug) => {
    const s = bySlug[slug]
    const rows = allProducts.filter((p) => p.store_id === s.id)
    const brands = counts(rows, 'brand')
    return {
      slug: s.slug, name: s.name, neighborhood: s.neighborhood, borough: s.borough,
      address: s.address, lat: s.lat, lng: s.lng,
      in_stock: rows.length, brands: Object.keys(brands).length,
      min_price: Math.min(...prices(rows)),
      categories: counts(rows, 'category'),
      top_brands: Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([brand, n]) => ({ brand, n })),
      featured: rows.filter((p) => p.price_min > 0 && p.image_url)
        .sort((a, b) => (b.thc_pct || 0) - (a.thc_pct || 0)).slice(0, 6).map(pickProduct),
    }
  })

  const neighborhoods = NEIGHBORHOODS.map((hood) => {
    const hoodStores = stores.filter((s) => s.neighborhood === hood)
    const ids = new Set(hoodStores.map((s) => s.id))
    const rows = allProducts.filter((p) => ids.has(p.store_id))
    const seenBrand = new Set()
    return {
      slug: slugify(hood), neighborhood: hood, borough: hoodStores[0]?.borough,
      stores: hoodStores.length, in_stock: rows.length,
      categories: counts(rows, 'category'),
      stores_list: hoodStores.map((s) => ({
        slug: s.slug, name: s.name, address: s.address,
        in_stock: rows.filter((p) => p.store_id === s.id).length,
      })).sort((a, b) => b.in_stock - a.in_stock),
      featured: rows.filter((p) => p.price_min > 0 && p.image_url && !seenBrand.has(p.brand) && seenBrand.add(p.brand))
        .slice(0, 6).map(pickProduct),
    }
  })

  const brands = BRANDS.map((brand) => {
    const rows = allProducts.filter((p) => p.brand === brand)
    const storeIds = [...new Set(rows.map((p) => p.store_id))]
    const seen = new Set()
    return {
      slug: slugify(brand), brand,
      stores: storeIds.length, in_stock: rows.length,
      min_price: Math.min(...prices(rows)),
      avg_price: Math.round(prices(rows).reduce((a, b) => a + b, 0) / prices(rows).length),
      categories: counts(rows, 'category'),
      stores_list: storeIds.map((id) => {
        const r = rows.filter((p) => p.store_id === id)
        const s = byId[id]
        return { slug: s.slug, name: s.name, neighborhood: s.neighborhood, borough: s.borough, n: r.length, min_price: Math.min(...prices(r)) }
      }).sort((a, b) => b.n - a.n).slice(0, 10),
      featured: rows.filter((p) => p.price_min > 0 && p.image_url && !seen.has(p.name) && seen.add(p.name)).slice(0, 6).map(pickProduct),
    }
  })

  const catRows = allProducts.filter((p) => p.category === CATEGORY)
  const hoodCount = {}
  for (const p of catRows) {
    const h = byId[p.store_id]?.neighborhood
    if (h) hoodCount[h] = (hoodCount[h] || 0) + 1
  }
  const brandCount = counts(catRows, 'brand')
  const seenCat = new Set()
  const categories = {
    [CATEGORY]: {
      slug: CATEGORY, label: 'Pre-Rolls',
      in_stock: catRows.length,
      stores: new Set(catRows.map((p) => p.store_id)).size,
      brands: Object.keys(brandCount).length,
      min_price: Math.min(...prices(catRows)),
      avg_price: Math.round(prices(catRows).reduce((a, b) => a + b, 0) / prices(catRows).length),
      strains: {
        sativa: catRows.filter((p) => p.strain_type === 'Sativa').length,
        indica: catRows.filter((p) => p.strain_type === 'Indica').length,
        hybrid: catRows.filter((p) => p.strain_type === 'Hybrid').length,
      },
      top_brands: Object.entries(brandCount).sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([brand, n]) => ({ brand, n })),
      neighborhoods: Object.entries(hoodCount).sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([neighborhood, n]) => ({ slug: slugify(neighborhood), neighborhood, n })),
      featured: catRows.filter((p) => p.price_min > 0 && p.image_url && p.thc_pct >= 10 && p.thc_pct <= 45 && !seenCat.has(p.name) && seenCat.add(p.name)).slice(0, 6).map(pickProduct),
    },
  }

  const out = { generatedAt: new Date().toISOString().slice(0, 10), source: 'Supabase live (anon read) via pull.mjs', dispensaries, neighborhoods, brands, categories }
  const path = fileURLToPath(new URL('./seo.json', import.meta.url))
  writeFileSync(path, JSON.stringify(out, null, 2) + '\n')
  console.log(`Wrote ${path}: ${dispensaries.length} dispensaries, ${neighborhoods.length} neighborhoods, ${brands.length} brands, 1 category.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
