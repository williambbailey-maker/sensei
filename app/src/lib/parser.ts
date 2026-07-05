import { EMPTY_FILTERS, type Filters, type Format, type Vibe } from './types'

// Deterministic client-side parse of the free-text box into filters.
// No runtime AI — just keyword/synonym maps.

const VIBE_SYNONYMS: Record<Vibe, string[]> = {
  relax: ['relax', 'chill', 'mellow', 'couch', 'calm', 'unwind', 'wind down', 'cozy', 'movie night'],
  sleep: ["can't sleep", 'cant sleep', 'insomnia', 'sleep', 'sleepy', 'bed', 'knock out', 'pass out', 'nighttime', 'night'],
  social: ['party', 'social', 'friends', 'hang', 'hangout', 'fun', 'giggly', 'talkative'],
  creative: ['creative', 'creativity', 'art', 'music', 'inspired', 'paint', 'write'],
  focus: ['focus', 'focused', 'work', 'productive', 'productivity', 'concentrate', 'study', 'clean'],
  energize: ['energy', 'energize', 'energized', 'wake', 'wake up', 'morning', 'uplift', 'uplifting', 'daytime', 'active'],
  'body-high': ['body', 'pain', 'ache', 'sore', 'relief', 'physical', 'body high'],
  balance: ['balance', 'balanced', 'even', 'middle', 'mild high'],
}

const FORMAT_SYNONYMS: Record<Format, string[]> = {
  edibles: ['gummies', 'gummy', 'edible', 'edibles', 'chocolate', 'candy', 'mints', 'drink'],
  'pre-rolls': ['pre roll', 'pre-roll', 'preroll', 'prerolls', 'pre rolls', 'joint', 'joints', 'doobie'],
  vaporizers: ['cart', 'carts', 'vape', 'vapes', 'pen', 'cartridge', 'disposable', 'vaporizer'],
  flower: ['flower', 'bud', 'buds', 'eighth', 'nug', 'nugs', 'ounce'],
}

const STRAIN_SYNONYMS: Record<'Indica' | 'Sativa' | 'Hybrid', string[]> = {
  Indica: ['indica'],
  Sativa: ['sativa'],
  Hybrid: ['hybrid'],
}

const BEGINNER = ['first time', 'firsttime', 'first-time', 'newbie', 'beginner', 'new to', 'never tried', 'lightweight', 'low tolerance', 'gentle']
const EXPERIENCED = ['experienced', 'heavy hitter', 'high tolerance', 'strongest', 'veteran', 'seasoned', 'knock me out']

const CHEAP = ['cheap', 'budget', 'affordable', 'deal', 'inexpensive']
const PREMIUM = ['premium', 'top shelf', 'top-shelf', 'best', 'luxury', 'high end', 'high-end', 'fancy']

const BOROUGH_SYNONYMS: Record<string, string[]> = {
  Manhattan: ['manhattan', 'soho', 'chelsea', 'east village', 'west village', 'les', 'lower east', 'midtown', 'harlem', 'nyc'],
  Brooklyn: ['brooklyn', 'williamsburg', 'bushwick', 'park slope', 'bk'],
  Queens: ['queens', 'astoria', 'flushing', 'long island city', 'lic'],
  Bronx: ['bronx'],
  'Staten Island': ['staten island', 'staten'],
}

function found(text: string, terms: string[]): boolean {
  return terms.some((t) => text.includes(t))
}

export function parseQuery(raw: string): Filters {
  const text = ` ${raw.toLowerCase().trim()} `
  const f: Filters = { ...EMPTY_FILTERS }

  for (const vibe of Object.keys(VIBE_SYNONYMS) as Vibe[]) {
    if (found(text, VIBE_SYNONYMS[vibe])) f.vibes.push(vibe)
  }
  f.vibes = f.vibes.slice(0, 3)

  for (const fmt of Object.keys(FORMAT_SYNONYMS) as Format[]) {
    if (found(text, FORMAT_SYNONYMS[fmt])) {
      f.format = fmt
      break
    }
  }

  for (const strain of Object.keys(STRAIN_SYNONYMS) as Array<'Indica' | 'Sativa' | 'Hybrid'>) {
    if (found(text, STRAIN_SYNONYMS[strain])) {
      f.strain = strain
      break
    }
  }

  if (found(text, BEGINNER)) f.experience = 'beginner'
  else if (found(text, EXPERIENCED)) f.experience = 'experienced'

  for (const borough of Object.keys(BOROUGH_SYNONYMS)) {
    // 'nyc' alone is too weak to pin a borough — skip it as a sole signal.
    const terms = BOROUGH_SYNONYMS[borough].filter((t) => t !== 'nyc')
    if (found(text, terms)) {
      f.borough = borough
      break
    }
  }

  // Price: explicit numbers win, then band words.
  const under = text.match(/(?:under|below|less than|max|up to)\s*\$?\s*(\d{1,4})/)
  const dollar = text.match(/\$\s*(\d{1,4})/)
  if (under) f.priceCeiling = parseInt(under[1], 10)
  else if (dollar) f.priceCeiling = parseInt(dollar[1], 10)
  else if (found(text, CHEAP)) f.priceBand = '$'
  else if (found(text, PREMIUM)) f.priceBand = '$$$'

  // Whatever didn't parse into structure stays as free text for name/brand match,
  // but only if nothing structured matched (avoids double-filtering).
  const structured =
    f.vibes.length ||
    f.format ||
    f.strain ||
    f.experience ||
    f.priceCeiling != null ||
    f.priceBand ||
    f.borough
  f.text = structured ? '' : raw.trim()

  return f
}
