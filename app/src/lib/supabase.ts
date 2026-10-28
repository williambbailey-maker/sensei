import { createClient } from '@supabase/supabase-js'
import { haversineMiles } from './geo'
import type { Deal, Filters, Product, StoreLite } from './types'

// The anon key is public by design (it ships in the client bundle and only has
// RLS-limited read/insert rights). Env vars win; the fallbacks let the app run
// out of the box against the current project.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://dywrisybvcorpfhbwgtg.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5d3Jpc3lidmNvcnBmaGJ3Z3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDEyMzcsImV4cCI6MjA5NTg3NzIzN30.FgI4VqSYuInl2RDOzeNB4BLVTkYI-PaB7up0JTXmcnw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const PRODUCT_COLS =
  'id,external_id,name,clean_name,brand,clean_brand,description,brand_description,effects,category,strain_type,thc_pct,cbd_pct,variants,price_min,price_was,on_sale,url,image_url,vibes,experience_level,potency_tier,price_band,in_stock,store:stores(name,borough,neighborhood,slug,lat,lng,address,menu_url)'

// PostgREST caps each response at 1000 rows. We used to page through the whole
// ~37k-row in-stock catalog (~26 MB) on load, and the results screen showed
// "Nothing matched" until it arrived — fast tappers reached results before
// the data did. Now we ask the server for only what a filter set can match.
const PRODUCT_PAGE = 1000
// Hard cap on rows pulled for one result set. Results shows at most 240 and
// the client re-ranks whatever comes back, so a few thousand is plenty.
const MAX_ROWS = 3000
// "Closest to you" with no radius: draw from the nearest few stores rather
// than the whole city.
const NEAREST_STORES = 20

// Products for one filter set. Mirrors the hard filters in rankProducts
// (format, strain, price, THC, location); the soft ones (size, text, vibes,
// experience) and the final ranking still run on the client.
export async function fetchProductsFor(f: Filters, stores: StoreLite[]): Promise<Product[]> {
  const storeIds = scopeStores(f, stores)
  if (storeIds && storeIds.length === 0) return []

  const build = (from: number, withCount: boolean) => {
    let q = supabase
      .from('products')
      .select(PRODUCT_COLS, withCount ? { count: 'exact' as const } : undefined)
      .eq('in_stock', true)
    if (f.format) q = q.eq('category', f.format)
    if (f.onSale || f.sort === 'discount') q = q.eq('on_sale', true)
    if (f.strain) q = q.eq('strain_type', f.strain)
    if (f.priceCeiling != null) q = q.lte('price_min', f.priceCeiling)
    if (f.priceBand) q = q.eq('price_band', f.priceBand)
    if (f.thcMin != null) q = q.gte('thc_pct', f.thcMin)
    if (f.brand) {
      // Brand names differ in case between the raw and normalized columns
      // ("ayrloom" vs "Ayrloom"); ilike with no wildcard is a case-insensitive
      // equality. Escape the few characters PostgREST treats specially.
      const v = f.brand.replace(/[%_\\]/g, '\\$&').replace(/[,()"]/g, ' ').trim()
      q = q.or(`clean_brand.ilike."${v}",brand.ilike."${v}"`)
    }
    if (storeIds) q = q.in('store_id', storeIds)
    // Server order approximates the client's default tiebreak (cheapest first)
    // so a capped result set keeps the most relevant rows.
    if (f.sort === 'price-desc') q = q.order('price_min', { ascending: false, nullsFirst: false })
    else if (f.sort === 'potency') q = q.order('thc_pct', { ascending: false, nullsFirst: false })
    else q = q.order('price_min', { ascending: true, nullsFirst: false })
    q = q.order('id', { ascending: true })
    return q.range(from, from + PRODUCT_PAGE - 1)
  }

  const first = await build(0, true)
  if (first.error) throw first.error
  const rows = (first.data ?? []) as unknown as Product[]
  const total = Math.min(first.count ?? rows.length, MAX_ROWS)
  const pages = Math.ceil(total / PRODUCT_PAGE)
  if (pages <= 1) return rows

  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      build((i + 1) * PRODUCT_PAGE, false).then((r) => {
        if (r.error) throw r.error
        return (r.data ?? []) as unknown as Product[]
      }),
    ),
  )
  return rows.concat(...rest)
}

// The site's headline numbers, computed in the database (site_stats) from
// one definition used everywhere, the SEO pages included: a shop is an
// active store with at least one item in stock; neighborhoods are those with
// such a shop; items are in-stock products at those shops.
export type SiteStats = { shops: number; neighborhoods: number; in_stock: number }
export async function fetchSiteStats(): Promise<SiteStats> {
  const { data, error } = await supabase.rpc('site_stats')
  if (error) throw error
  return data as SiteStats
}

// Which stores a filter set can draw from: a neighborhood, a borough, the
// stores inside the radius, or the nearest few when sorting by distance.
// null = no location scoping at all.
function scopeStores(f: Filters, stores: StoreLite[]): string[] | null {
  const withId = stores.filter((s): s is StoreLite & { id: string } => !!s.id)
  if (f.store) return withId.filter((s) => s.slug === f.store).map((s) => s.id)
  if (f.neighborhood) return withId.filter((s) => s.neighborhood === f.neighborhood).map((s) => s.id)
  if (f.borough) return withId.filter((s) => s.borough === f.borough).map((s) => s.id)
  if (f.userLoc) {
    const loc = f.userLoc
    const near = withId
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({ id: s.id, mi: haversineMiles(loc, { lat: s.lat!, lng: s.lng! }) }))
      .sort((a, b) => a.mi - b.mi)
    const picked =
      f.radiusMiles != null ? near.filter((s) => s.mi <= f.radiusMiles!) : near.slice(0, NEAREST_STORES)
    return picked.map((s) => s.id)
  }
  return null
}

// The stores table is tiny and drives the location UI (borough ->
// neighborhood chips) — independent of whichever product rows we sampled.
export async function fetchStores(): Promise<StoreLite[]> {
  const { data, error } = await supabase
    // live_stores = active stores with at least one item in stock, so the
    // journey and filters never offer a shop with nothing to show.
    .from('live_stores')
    .select('id,slug,name,borough,neighborhood,lat,lng,menu_url')
  if (error) throw error
  return (data ?? []) as unknown as StoreLite[]
}

// The deals in pick order (refresh_deals' round-robin across type × borough).
// The home only needs the first few.
export async function fetchDeals(limit = 12): Promise<Deal[]> {
  const { data, error } = await supabase
    .from('live_deals')
    .select('id,title,description,url,featured,sort,kind,product_id,price,price_was,pct,image_url,store_name,store_borough,store_slug')
    .order('featured', { ascending: false })
    .order('sort', { ascending: true })
    .limit(limit)
  if (error) throw error
  type Row = Omit<Deal, 'store'> & { store_name: string | null; store_borough: string | null; store_slug: string | null }
  return ((data ?? []) as unknown as Row[]).map(({ store_name, store_borough, store_slug, ...d }) => ({
    ...d,
    store: store_name || store_borough ? { name: store_name, borough: store_borough, slug: store_slug } : null,
  }))
}

// Every picked deal as a full product row (for the deals page and the product
// detail), at today's prices, in pick order. Same rule as live_deals: still
// in stock and still marked down.
export async function fetchDealProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_COLS},deals!inner(sort)`)
    .eq('deals.kind', 'sale')
    .eq('in_stock', true)
    .eq('on_sale', true)
  if (error) throw error
  type Row = Product & { deals: { sort: number }[] }
  return ((data ?? []) as unknown as Row[])
    .filter((p) => p.price_was != null && p.price_min != null && p.price_was > p.price_min)
    .map(({ deals, ...p }) => ({ ...p, deal_rank: deals[0]?.sort ?? 1e9 }))
    .sort((a, b) => a.deal_rank - b.deal_rank)
}

// A handful of products by id (the home's top deals, so a tap opens the detail).
export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('products').select(PRODUCT_COLS).in('id', ids)
  if (error) throw error
  return (data ?? []) as unknown as Product[]
}

export async function addSubscriber(email: string, source: string): Promise<void> {
  const { error } = await supabase.from('subscribers').insert({ email, source })
  // Unique-violation (already subscribed) is a friendly no-op.
  if (error && error.code !== '23505') throw error
}
