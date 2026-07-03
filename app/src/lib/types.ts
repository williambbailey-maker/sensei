export type Variant = { weight: string | null; price: number | null; special_price?: number | null }

export type StoreLite = { name: string | null; borough: string | null; slug: string }

export type Product = {
  id: string
  external_id: string
  name: string | null
  clean_name: string | null
  brand: string | null
  clean_brand: string | null
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

export type Filters = {
  vibes: Vibe[]
  format: Format | null
  strain: 'Indica' | 'Sativa' | 'Hybrid' | null
  experience: 'beginner' | 'casual' | 'experienced' | null
  priceCeiling: number | null
  priceBand: '$' | '$$' | '$$$' | null
  text: string
}

export const EMPTY_FILTERS: Filters = {
  vibes: [],
  format: null,
  strain: null,
  experience: null,
  priceCeiling: null,
  priceBand: null,
  text: '',
}

export function hasStructuredFilter(f: Filters): boolean {
  return (
    f.vibes.length > 0 ||
    f.format !== null ||
    f.strain !== null ||
    f.experience !== null ||
    f.priceCeiling !== null ||
    f.priceBand !== null
  )
}

export function isActive(f: Filters): boolean {
  return hasStructuredFilter(f) || f.text.trim().length > 0
}
