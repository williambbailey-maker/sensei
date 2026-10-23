import type { Filters, Format, SortKey, Strain, Vibe } from './types'

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
const EXTRA_FORMAT_LABELS: Record<string, string> = {
  concentrates: 'Concentrates',
  tinctures: 'Tinctures',
  topicals: 'Topicals',
}
export const formatLabel = (f: string) =>
  FORMATS.find((x) => x.key === f)?.label ?? EXTRA_FORMAT_LABELS[f] ?? f
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

// Display-clean a product title. Menus write names many ways: "Lobotomy",
// "FLAMER | Lobotomy | Indica | Pre-Roll", "5 Boro - Fuel Pump - 3.5g",
// "Nyce | Alien Mints | Live Hash Rosin AIO | 1g". The card already shows the
// brand, strain type, category and size, so drop those from the title and
// keep the product's own name: the brand (wherever it sits, or as a prefix),
// pipe-separated parts that are only a strain type, a bare category word or a
// size, and number-bearing terms (dosages, ratios, counts). Falls back to the
// raw name if stripping leaves nothing.
const STRAIN =
  /^(true\s+)?(indica|sativa|hybrid|balanced)([- /](dominant|dom|hybrid|indica|sativa))?$|^(cbd|thc|thcv|cbn|cbg|cbc)([\s:/+&-]*(cbd|thc|thcv|cbn|cbg|cbc))*$/i
const CATEGORY_WORD =
  /^(flower|whole flower|indoor flower|pre-?rolls?|pre rolls?|joints?|blunts?|vapes?|vape pens?|cartridges?|carts?|aio|vape aio|all[- ]in[- ]one|disposables?|pods?|edibles?|gummies|gummy|chocolates?|beverages?|drinks?|concentrates?|tinctures?|topicals?|capsules?|tablets?|accessories|eighth|quarter|half[- ]ounce|ounce|single|singles|jar)$/i
const squash = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '')

// Sizes, doses, counts, ratios and potencies, but not numbers that are part
// of a product's name ("Afternoon Delight #4", "RZ-11", "GG4").
function stripNumbers(x: string): string {
  return x
    .replace(/\((?:[ISH](?:\/[ISH])?)\)/gi, ' ')
    .replace(/\(?\b\d+(?:\.\d+)?\s*(?:x\s*\d+(?:\.\d+)?\s*)?-?\s*(?:mg|g|gram|grams|gr|oz|ml|pk|pks|pack|packs|ct|cts|count|counts|pc|pcs|piece|pieces|servings?)\b\)?/gi, ' ')
    .replace(/(^|[\s(])\.\d+\s*(?:mg|g)\b\)?/gi, ' ')
    .replace(/\b\d+(?:\.\d+)?(?:\s*:\s*\d+(?:\.\d+)?)+\b/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s?%/g, ' ')
    .replace(/\(\s*\d+\s*x\s*\)|\(\s*\)|\(\s*x\s*\)/gi, ' ')
    .replace(/[()[\]]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–·,&|:.]+|[\s\-–·,&|:.]+$/g, '')
    .trim()
    .replace(/(\s+\d+)?\s+x$/i, '')
    .replace(/\s+[ISH]$/, '')
    .trim()
}

export function cleanTitle(raw: string, brand?: string | null): string {
  const b = squash(brand ?? '')
  // "Jetty" for Jetty Extracts, "Dank" for Dank By Definition, "Packs" for
  // Packs Los Angeles: a part that is the brand or the start of it.
  const isBrand = (x: string) => {
    const q = squash(x)
    return !!b && !!q && (q === b || q === b.replace(/s$/, '') || (q.length >= 4 && b.startsWith(q)))
  }
  const parts = raw.split('|').map((x) => x.trim()).filter(Boolean)
  const kept = parts
    .filter((x) => !isBrand(x))
    .map((x) => {
      // "5 Boro - Fuel Pump" / "Ruby Farms Doobies": drop a leading brand.
      if (!b) return x
      const words = x.split(/\s+/)
      for (let i = 1; i < words.length; i++) {
        const head = squash(words.slice(0, i).join(' '))
        if (head === b) return words.slice(i).join(' ').replace(/^[-–:]\s*/, '') || x
        if (head.length >= b.length) break
      }
      return x
    })
    .map(stripNumbers)
    .filter((x) => x.replace(/[^a-z0-9]/gi, '').length >= 2 && !STRAIN.test(x) && !CATEGORY_WORD.test(x))
  const out = kept.join(' · ')
  return out || stripNumbers(parts[0] ?? raw) || raw.trim() || raw
}

// What a journey step was set to, as a short trail label: the place, the
// product type, the strain, the size or the budget, or "Any …" when skipped.
export function stepValue(step: number, f: Filters): string {
  if (step === 0) return f.neighborhood ?? f.borough ?? (f.userLoc ? 'Near me' : 'All of NYC')
  if (step === 1) return FORMATS.find((x) => x.key === f.format)?.label ?? 'Any type'
  if (step === 2) return f.strain ?? 'Any strain'
  if (step === 3) return f.size ? sizeLabel(f.size).split(' · ')[0] : 'Any size'
  return BUDGETS.find((b) => b.ceiling === f.priceCeiling)?.label ?? 'Any price'
}
