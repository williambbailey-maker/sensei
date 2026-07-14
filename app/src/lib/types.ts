export type Variant = { weight: string | null; price: number | null; special_price?: number | null }

export type StoreLite = {
  name: string | null
  borough: string | null
  neighborhood: string | null
  slug: string
  lat: number | null
  lng: number | null
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
  category: string | null
  strain_type: string | null
  thc_pct: number | null
  cbd_pct: number | null
  variants: Variant[]
  price_min: number | null
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

export type Deal = {
  id: string
  title: string
  description: string | null
  url: string | null
  featured: boolean
  sort: number
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

export type Format = 'flower' | 'pre-rolls' | 'vaporizers' | 'edibles'

export type Strain = 'Indica' | 'Sativa' | 'Hybrid'

// How the result list is ordered. 'match' = the vibe/relevance score;
// the rest are objective, user-driven sorts.
export type SortKey = 'match' | 'price-asc' | 'price-desc' | 'potency' | 'distance'

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
  // "Quantity" — a pack-size bucket key (see SIZES in labels); matched against
  // a product's variant weights normalized to grams.
  size: string | null
  // Location — the primary qualifier. Either borough (+ optional
  // neighborhood), or the user's coordinates with a mile radius.
  borough: string | null
  neighborhood: string | null
  userLoc: LatLng | null
  radiusMiles: number | null
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
  size: null,
  borough: null,
  neighborhood: null,
  userLoc: null,
  radiusMiles: null,
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
    f.size !== null ||
    f.borough !== null ||
    f.neighborhood !== null ||
    f.userLoc !== null
  )
}

export function isActive(f: Filters): boolean {
  return hasStructuredFilter(f) || f.text.trim().length > 0
}
