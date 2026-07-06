import { createClient } from '@supabase/supabase-js'
import type { Deal, Product, StoreLite } from './types'

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
  'id,external_id,name,clean_name,brand,clean_brand,category,strain_type,thc_pct,cbd_pct,variants,price_min,url,image_url,vibes,experience_level,potency_tier,price_band,in_stock,store:stores(name,borough,neighborhood,slug,lat,lng)'

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLS)
    .eq('in_stock', true)
    .limit(5000)
  if (error) throw error
  return (data ?? []) as unknown as Product[]
}

// The stores table is tiny and drives the location UI (borough ->
// neighborhood chips) — independent of whichever product rows we sampled.
export async function fetchStores(): Promise<StoreLite[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('slug,name,borough,neighborhood,lat,lng')
    .eq('active', true)
  if (error) throw error
  return (data ?? []) as unknown as StoreLite[]
}

export async function fetchDeals(): Promise<Deal[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('id,title,description,url,featured,sort,store:stores(name,borough)')
    .order('featured', { ascending: false })
    .order('sort', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as Deal[]
}

export async function addSubscriber(email: string, source: string): Promise<void> {
  const { error } = await supabase.from('subscribers').insert({ email, source })
  // Unique-violation (already subscribed) is a friendly no-op.
  if (error && error.code !== '23505') throw error
}
