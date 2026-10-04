// Shared helpers + the handful of constants the templates key off. Keeping the
// Sensei app URL and deep-link builders here means every "primary action" on
// every page routes back into the Sensei product, not out to a store menu.

import data from '../data/seo.json'
import coords from '../data/coords.json'

// slug -> [lat, lng] for the map island on neighborhood/brand pages.
export const COORDS = coords as Record<string, [number, number]>
export function pointsFor(stores: { slug: string; name: string }[]) {
  return stores
    .map((s) => ({ s, c: COORDS[s.slug] }))
    .filter((x) => x.c)
    .map((x) => ({ lat: x.c![0], lng: x.c![1], name: x.s.name }))
}

export type Product = {
  name: string
  brand?: string | null
  category?: string | null
  strain_type?: string | null
  thc_pct?: number | null
  price_min?: number | null
  image_url?: string | null
  url?: string | null
}

export const SEO = data as any

// The live Sensei app (the discovery tool). Set this to the real app origin
// before launch — every primary CTA deep-links here so a cold Google visitor
// lands back inside Sensei instead of bouncing to a dispensary menu.
export const SENSEI_APP = 'https://sensei.nyc/app'

export const slugify = (s: string) =>
  String(s).toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// Price like "$14" or "$14.69" (trailing .00 trimmed).
export function money(n?: number | null): string {
  if (n == null || !(n > 0)) return '—'
  const r = Math.round(n * 100) / 100
  return '$' + (Number.isInteger(r) ? String(r) : r.toFixed(2))
}

export const CATEGORY_LABELS: Record<string, string> = {
  flower: 'Flower',
  'pre-rolls': 'Pre-Rolls',
  vaporizers: 'Vapes',
  edibles: 'Edibles',
  concentrates: 'Concentrates',
  tinctures: 'Tinctures',
  topicals: 'Topicals',
}
export const categoryLabel = (c: string) => CATEGORY_LABELS[c] ?? c

// THC% is only meaningful for inhalables/flower in this data; edibles carry mg
// in the name and some rows store junk values, so gate the badge.
export function showThc(p: Product): boolean {
  const c = p.category ?? ''
  const ok = c === 'flower' || c === 'pre-rolls' || c === 'vaporizers' || c === 'concentrates'
  return ok && typeof p.thc_pct === 'number' && p.thc_pct! > 0 && p.thc_pct! <= 100
}

// Deep links into the Sensei app — the primary action on each page type.
export const appSearch = (q: string) => `${SENSEI_APP}?q=${encodeURIComponent(q)}`
export const appProduct = (p: Product) =>
  appSearch([p.brand, p.name].filter(Boolean).join(' '))
export const appBrand = (brand: string) => `${SENSEI_APP}?brand=${encodeURIComponent(brand)}`
export const appNeighborhood = (hood: string, category?: string) =>
  `${SENSEI_APP}?neighborhood=${encodeURIComponent(hood)}${category ? `&category=${encodeURIComponent(category)}` : ''}`
export const appCategory = (category: string, extra?: string) =>
  `${SENSEI_APP}?category=${encodeURIComponent(category)}${extra ? `&${extra}` : ''}`
export const appDispensary = (slug: string) => `${SENSEI_APP}?store=${encodeURIComponent(slug)}`

// Pretty borough/neighborhood path helpers.
export const dispensaryPath = (slug: string) => `/dispensaries/${slug}`
export const neighborhoodPath = (slug: string) => `/neighborhoods/${slug}`
export const brandPath = (slug: string) => `/brands/${slug}`
export const categoryPath = (slug: string) => `/nyc/${slug}`
