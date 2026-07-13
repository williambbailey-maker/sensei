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

// Minimum-THC filter thresholds (percent). Applied as "this % or higher".
export const THC_MINS = [15, 20, 25, 30]

// "Quantity" (pack size) buckets, matched against a product's variant weights
// normalized to grams. Ranges are midpoint-based around the standard retail
// sizes, so 1/8oz and 3.5g both land in the eighth. max is exclusive.
export const SIZES: { key: string; label: string; min: number; max: number }[] = [
  { key: '1g', label: '1g', min: 0, max: 1.5 },
  { key: 'eighth', label: 'Eighth · 3.5g', min: 1.5, max: 5.25 },
  { key: 'quarter', label: 'Quarter · 7g', min: 5.25, max: 10.5 },
  { key: 'half', label: 'Half · 14g', min: 10.5, max: 21 },
  { key: 'ounce', label: 'Ounce · 28g', min: 21, max: Infinity },
]

export const sizeLabel = (key: string) => SIZES.find((s) => s.key === key)?.label ?? key

// Normalize a Dutchie variant weight string to grams. Handles g, mg, oz and
// fractional ounces (1/8oz, 1/4oz). Returns null when unparseable.
export function weightToGrams(w: string | null | undefined): number | null {
  if (!w) return null
  const s = String(w).toLowerCase().trim()
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)\s*oz/)
  if (frac) return (Number(frac[1]) / Number(frac[2])) * 28.3495
  const oz = s.match(/([\d.]+)\s*oz/)
  if (oz) return Number(oz[1]) * 28.3495
  const mg = s.match(/([\d.]+)\s*mg/)
  if (mg) return Number(mg[1]) / 1000
  const g = s.match(/([\d.]+)\s*g/)
  if (g) return Number(g[1])
  const n = s.match(/[\d.]+/)
  return n ? Number(n[0]) : null
}

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

// Display-clean a product title: keep only what comes before '|' (the brand
// usually follows it) and drop number-bearing terms — dosages (100mg, 3.5g),
// ratios (2:1), counts (10-pack, 20 Pack) — plus a unit word a count was
// qualifying. Falls back to the raw name if stripping leaves nothing.
export function cleanTitle(raw: string): string {
  const base = raw.split('|')[0]
  let s = base
    .replace(/\(?\b\d[\w:.%/-]*\)?(\s+(packs?|pks?|cts?|counts?|pcs?|pieces?|servings?))?/gi, ' ')
    .replace(/[()[\]]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–·,&]+|[\s\-–·,&]+$/g, '')
    .trim()
  return s || base.trim() || raw
}
