import type { Format, SortKey, Strain, Vibe } from './types'

export const VIBES: { key: Vibe; label: string; emoji: string }[] = [
  { key: 'relax', label: 'Relax', emoji: '🛋️' },
  { key: 'sleep', label: 'Sleep', emoji: '🌙' },
  { key: 'social', label: 'Social', emoji: '🥂' },
  { key: 'creative', label: 'Creative', emoji: '🎨' },
  { key: 'focus', label: 'Focus', emoji: '🎯' },
  { key: 'energize', label: 'Energize', emoji: '⚡' },
  { key: 'body-high', label: 'Body high', emoji: '🌊' },
  { key: 'balance', label: 'Balance', emoji: '☯️' },
]

export const FORMATS: { key: Format; label: string; emoji: string }[] = [
  { key: 'flower', label: 'Flower', emoji: '🌸' },
  { key: 'pre-rolls', label: 'Pre-rolls', emoji: '🚬' },
  { key: 'vaporizers', label: 'Vapes', emoji: '💨' },
  { key: 'edibles', label: 'Edibles', emoji: '🍬' },
]

export const BUDGETS: { label: string; ceiling: number | null; band: '$' | '$$' | '$$$' | null }[] = [
  { label: 'Under $25', ceiling: 25, band: null },
  { label: 'Under $50', ceiling: 50, band: null },
  { label: 'Under $100', ceiling: 100, band: null },
  { label: 'No limit', ceiling: null, band: null },
]

export const STRAINS: Strain[] = ['Indica', 'Sativa', 'Hybrid']

// Boroughs offered in the pickers. Bronx and Staten Island are parked until
// they have stocked stores. Neighborhood lists are data-driven.
export const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens']

export const RADII = [1, 2, 5, 10]

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'match', label: 'Best match' },
  { key: 'distance', label: 'Nearest first' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
  { key: 'potency', label: 'Potency: high to low' },
]

export const vibeLabel = (v: string) => VIBES.find((x) => x.key === v)?.label ?? v
export const formatLabel = (f: string) => FORMATS.find((x) => x.key === f)?.label ?? f
export const sortLabel = (s: string) => SORTS.find((x) => x.key === s)?.label ?? s

// Many stores have no display name yet (only a slug). Turn a slug into a
// readable label as a fallback until the scraper backfills real store names.
export function prettyStore(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bNyc\b/g, 'NYC')
    .replace(/\bNy\b/g, 'NY')
    .replace(/\bLes\b/g, 'LES')
    .replace(/\bLlc\b/g, 'LLC')
}
