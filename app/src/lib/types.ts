// `was` is the regular price, present only when `price` is a sale price.
export type Variant = { weight: string | null; price: number | null; was?: number | null; special_price?: number | null }

export type StoreLite = {
  id?: string
  name: string | null
  borough: string | null
  neighborhood: string | null
  slug: string
  lat: number | null
  lng: number | null
  address?: string | null
  // The shop's own menu page (the cart's "Order at" link).
  menu_url?: string | null
}

export type LatLng = { lat: number; lng: number }

export type Product = {
  id: string
  external_id: string
  name: string | null
  clean_name: string | null
  brand: string | null
  clean_brand: string | null
  description: string | null
  brand_description: string | null
  effects: string[] | null
  category: string | null
  strain_type: string | null
  thc_pct: number | null
  cbd_pct: number | null
  variants: Variant[]
  price_min: number | null
  // The cheapest size's regular price when it is marked down; on_sale when any size is.
  price_was: number | null
  on_sale: boolean
  url: string | null
  image_url: string | null
  vibes: string[] | null
  experience_level: string | null
  potency_tier: string | null
  price_band: string | null
  in_stock: boolean
  store: StoreLite | null
}

// A dummy cart: locked to one store; the end goal is handing this off to a
// real Dutchie order. Prices are menu minimums; exact totals happen at Dutchie.
export type CartItem = { product: Product; qty: number }
export type Cart = { store: StoreLite; items: CartItem[] }

// A row of the deals board (the live_deals view). kind 'sale' rows are
// picked from sale prices after every scrape: title is the product, description
// its brand, and the prices are today's. 'manual' rows are typed by hand.
export type Deal = {
  id: string
  title: string
  description: string | null
  url: string | null
  featured: boolean
  sort: number
  kind: 'sale' | 'manual'
  product_id: string | null
  price: number | null
  price_was: number | null
  pct: number | null
  image_url: string | null
  store: { name: string | null; borough: string | null } | null
}

export type Vibe =
  | 'relax'
  | 'sleep'
  | 'social'
  | 'creative'
  | 'focus'
  | 'energize'
  | 'body-high'
  | 'balance'

// The four journey formats plus the three smaller categories that only arrive
// via deep links from the SEO pages (/?category=concentrates etc.).
export type Format =
  | 'flower'
  | 'pre-rolls'
  | 'vaporizers'
  | 'edibles'
  | 'concentrates'
  | 'tinctures'
  | 'topicals'

export type Strain = 'Indica' | 'Sativa' | 'Hybrid'

// How the result list is ordered. 'match' = the vibe/relevance score;
// the rest are objective, user-driven sorts.
export type SortKey = 'match' | 'price-asc' | 'price-desc' | 'potency' | 'distance' | 'discount'

export type Filters = {
  vibes: Vibe[]
  format: Format | null
  strain: Strain | null
  experience: 'beginner' | 'casual' | 'experienced' | null
  priceCeiling: number | null
  priceBand: '$' | '$$' | '$$$' | null
  // Minimum THC potency (percent). Products without a % potency are excluded
  // when this is set.
  thcMin: number | null
  // Only items with a sale price.
  onSale: boolean
  // "Quantity" — a pack-size bucket key (see SIZES in labels); matched against
  // a product's variant weights normalized to grams.
  size: string | null
  // Location — the primary qualifier. Either borough (+ optional
  // neighborhood), or the user's coordinates with a mile radius.
  borough: string | null
  neighborhood: string | null
  userLoc: LatLng | null
  radiusMiles: number | null
  // Exact brand (case-insensitive) and single store (slug). Set by deep links
  // from the SEO pages — "Find Ruby Farms nearby", "Browse Qube" — and cleared
  // with a chip like any other filter.
  brand: string | null
  store: string | null
  storeName: string | null
  sort: SortKey
  text: string
}

export const EMPTY_FILTERS: Filters = {
  vibes: [],
  format: null,
  strain: null,
  experience: null,
  priceCeiling: null,
  priceBand: null,
  thcMin: null,
  onSale: false,
  size: null,
  borough: null,
  neighborhood: null,
  userLoc: null,
  radiusMiles: null,
  brand: null,
  store: null,
  storeName: null,
  sort: 'match',
  text: '',
}

// The location half of a filter set — carried across every action so "where
// you are" persists from the first tap onward.
export function locationOf(f: Filters): Partial<Filters> {
  return {
    borough: f.borough,
    neighborhood: f.neighborhood,
    userLoc: f.userLoc,
    radiusMiles: f.radiusMiles,
  }
}

export function hasLocation(f: Filters): boolean {
  return f.borough !== null || f.neighborhood !== null || f.userLoc !== null
}

// A "structured" filter narrows results. Sort order is presentation, not a
// filter, so it's deliberately excluded here.
export function hasStructuredFilter(f: Filters): boolean {
  return (
    f.vibes.length > 0 ||
    f.format !== null ||
    f.strain !== null ||
    f.experience !== null ||
    f.priceCeiling !== null ||
    f.priceBand !== null ||
    f.thcMin !== null ||
    f.onSale ||
    f.size !== null ||
    f.borough !== null ||
    f.neighborhood !== null ||
    f.userLoc !== null ||
    f.brand !== null ||
    f.store !== null
  )
}

// Build a filter set from the page's query string. The SEO pages deep-link
// into the app with ?brand=, ?store=, ?neighborhood= and ?category=; any of
// them present means "skip the journey and show results". Null when none are.
export function filtersFromQuery(search: string, stores: StoreLite[]): Filters | null {
  const q = new URLSearchParams(search)
  const brand = (q.get('brand') ?? '').trim() || null
  const store = (q.get('store') ?? '').trim() || null
  const neighborhood = (q.get('neighborhood') ?? '').trim() || null
  const category = (q.get('category') ?? '').trim().toLowerCase() || null
  if (!brand && !store && !neighborhood && !category) return null

  const f: Filters = { ...EMPTY_FILTERS, brand }
  const formats: Format[] = ['flower', 'pre-rolls', 'vaporizers', 'edibles', 'concentrates', 'tinctures', 'topicals']
  if (category && (formats as string[]).includes(category)) f.format = category as Format
  if (store) {
    const s = stores.find((x) => x.slug === store)
    // Unknown slug: ignore it rather than scoping to nothing.
    if (s) {
      f.store = s.slug
      f.storeName = s.name
      f.borough = s.borough
      f.neighborhood = s.neighborhood
    }
  } else if (neighborhood) {
    const s = stores.find((x) => x.neighborhood?.toLowerCase() === neighborhood.toLowerCase())
    if (s) {
      f.neighborhood = s.neighborhood
      f.borough = s.borough
    }
  }
  // Brand and store pages promise "cheapest first" more than a vibe match.
  if (f.brand || f.store) f.sort = 'price-asc'
  return f
}

export function isActive(f: Filters): boolean {
  return hasStructuredFilter(f) || f.text.trim().length > 0
}
