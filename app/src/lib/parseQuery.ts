import type { Filters, Format, SortKey, Strain } from './types'

// Turn a plain-English sentence into structured filters, using the app's known
// vocabulary (3 strains, the product types, 3 boroughs + data-driven
// neighborhoods, price / THC / size). Everything is matched locally — the
// sentence never leaves the browser. Unrecognized words become a free-text
// query so brand/product names ("stiiizy", "runtz") still narrow the results.
//
// Examples it handles:
//   "sativa pre-rolls under $10 in manhattan"
//   "cheapest indica eighths in williamsburg"
//   "high-thc vapes brooklyn"
//   "stiiizy gummies"

type NeighborhoodIndex = {
  // lowercase neighborhood name -> its canonical name
  canon: Record<string, string>
  // lowercase neighborhood name -> its borough
  borough: Record<string, string>
}

export function buildNeighborhoodIndex(
  neighborhoodsByBorough: Record<string, string[]>,
): NeighborhoodIndex {
  const canon: Record<string, string> = {}
  const borough: Record<string, string> = {}
  for (const [b, hoods] of Object.entries(neighborhoodsByBorough)) {
    for (const n of hoods) {
      canon[n.toLowerCase()] = n
      borough[n.toLowerCase()] = b
    }
  }
  return { canon, borough }
}

// Product-type synonyms → category key. Multi-word / hyphenated forms are
// matched with flexible whitespace so "pre roll", "pre-roll", "prerolls" all hit.
const FORMAT_PATTERNS: [RegExp, Format][] = [
  [/\bpre[-\s]?rolls?\b/, 'pre-rolls'],
  [/\bjoints?\b/, 'pre-rolls'],
  [/\bvapes?\b/, 'vaporizers'],
  [/\bvaporizers?\b/, 'vaporizers'],
  [/\bcarts?\b/, 'vaporizers'],
  [/\bcartridges?\b/, 'vaporizers'],
  [/\bdisposables?\b/, 'vaporizers'],
  [/\bedibles?\b/, 'edibles'],
  [/\bgummies\b/, 'edibles'],
  [/\bgummy\b/, 'edibles'],
  [/\bchocolates?\b/, 'edibles'],
  [/\bflowers?\b/, 'flower'],
  [/\bbuds?\b/, 'flower'],
]

const STRAIN_PATTERNS: [RegExp, Strain][] = [
  [/\bindicas?\b/, 'Indica'],
  [/\bsativas?\b/, 'Sativa'],
  [/\bhybrids?\b/, 'Hybrid'],
]

const BOROUGH_PATTERNS: [RegExp, string][] = [
  [/\bmanhattan\b/, 'Manhattan'],
  [/\bbrooklyn\b/, 'Brooklyn'],
  [/\bbk\b/, 'Brooklyn'],
  [/\bqueens\b/, 'Queens'],
]

// Pack sizes → SIZES key. Ordered so "half ounce" / "quarter ounce" resolve to
// the fraction, not "ounce".
const SIZE_PATTERNS: [RegExp, string][] = [
  [/\bhalf\b|\b14\s*g\b|\b1\/2\b/, 'half'],
  [/\bquarters?\b|\b7\s*g\b|\b1\/4\b/, 'quarter'],
  [/\beighths?\b|\b3\.5\s*g\b|\b1\/8\b/, 'eighth'],
  [/\bounces?\b|\boz\b|\bzips?\b|\b28\s*g\b/, 'ounce'],
  [/\b1\s*g\b|\bgram\b/, '1g'],
]

const STOPWORDS = new Set([
  'find', 'me', 'show', 'get', 'want', 'looking', 'for', 'a', 'an', 'the',
  'some', 'any', 'with', 'that', 'are', 'is', 'in', 'near', 'around', 'at',
  'of', 'to', 'and', 'or', 'please', 'i', 'im', 'need', 'id', 'like',
  'something', 'good', 'best', 'top', 'my', 'under', 'below', 'less', 'than',
  'cheaper', 'max', 'up', 'or', 'thc', 'high', 'strong', 'potent', 'strongest',
  'cheapest', 'cheap', 'budget', 'high-thc', 'nyc', 'weed', 'cannabis',
  // size words — consumed as a size filter; never leak into free text
  'ounce', 'ounces', 'oz', 'zip', 'zips', 'gram', 'grams', 'eighth', 'eighths',
  'quarter', 'quarters', 'half',
])

export function parseQuery(
  raw: string,
  neighborhoods: NeighborhoodIndex,
): Partial<Filters> {
  const out: Partial<Filters> = {}
  // Work on a padded, lowercased copy; matched spans are blanked out so they
  // aren't re-read as free text later.
  let rem = ` ${raw.toLowerCase()} `

  const take = (re: RegExp) => {
    const m = rem.match(re)
    if (!m) return null
    rem = rem.replace(re, ' ')
    return m
  }

  // Strain
  for (const [re, val] of STRAIN_PATTERNS) if (take(re)) { out.strain = val; break }
  // Product type
  for (const [re, val] of FORMAT_PATTERNS) if (take(re)) { out.format = val; break }

  // Neighborhoods first (longer, more specific than boroughs), longest name
  // first so "east village" wins over any shorter contained token.
  const hoodNames = Object.keys(neighborhoods.canon).sort((a, b) => b.length - a.length)
  for (const name of hoodNames) {
    if (rem.includes(` ${name} `) || rem.includes(`${name}`)) {
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
      if (take(re)) {
        out.neighborhood = neighborhoods.canon[name]
        out.borough = neighborhoods.borough[name]
        break
      }
    }
  }
  // Borough (only if a neighborhood didn't already set one)
  if (!out.borough) {
    for (const [re, val] of BOROUGH_PATTERNS) if (take(re)) { out.borough = val; break }
  }

  // Price ceiling: "under $10", "$10 or less", "below 25", etc.
  const priceA = take(/(?:under|below|less than|cheaper than|max|up to|within)\s*\$?\s*(\d+(?:\.\d+)?)/)
  const priceB = priceA ? null : take(/\$?\s*(\d+(?:\.\d+)?)\s*(?:or less|or under|and under|max)/)
  const price = priceA ?? priceB
  if (price) out.priceCeiling = Number(price[1])

  // Minimum THC: an explicit "20%" (with or without "thc"), else "high thc".
  const thc = take(/(\d+)\s*%/)
  if (thc) out.thcMin = Number(thc[1])
  else if (/\bhigh[-\s]?thc\b|\bpotent\b|\bstrong\b/.test(rem)) out.thcMin = 20

  // Pack size
  for (const [re, val] of SIZE_PATTERNS) if (take(re)) { out.size = val; break }

  // Sort intent
  let sort: SortKey | null = null
  if (/\bcheapest\b|\bcheap\b|\bbudget\b/.test(rem)) sort = 'price-asc'
  if (/\bstrongest\b|\bmost potent\b|\bhighest thc\b/.test(rem)) sort = 'potency'
  if (sort) out.sort = sort

  // Whatever is left (minus stopwords and bare numbers) is a free-text query —
  // this is what catches brand and product names.
  const leftover = rem
    .replace(/[$%]/g, ' ')
    .split(/[^a-z0-9']+/i)
    .filter((w) => w && !STOPWORDS.has(w) && !/^\d+$/.test(w))
  const text = leftover.join(' ').trim()
  if (text.length >= 2) out.text = text

  return out
}
