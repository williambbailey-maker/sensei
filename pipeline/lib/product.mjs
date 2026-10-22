// Shared product helpers: every platform module normalizes into the same
// `products` row shape with these, so cleanup rules live in one place.

export const num = (x) => {
  if (x === null || x === undefined) return null
  const m = String(x).replace(/,/g, '').match(/-?[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

// Platform category labels -> the seven categories the app knows.
export function normCategory(type, fallback) {
  const t = String(type || '').toLowerCase()
  if (t.includes('pre-roll') || t.includes('preroll') || t.includes('pre roll')) return 'pre-rolls'
  if (t.includes('vap') || t.includes('cartridge') || t.includes('disposable')) return 'vaporizers'
  if (t.includes('edible')) return 'edibles'
  if (t.includes('flower')) return 'flower'
  if (t.includes('concentrate') || t.includes('extract')) return 'concentrates'
  if (t.includes('tincture')) return 'tinctures'
  if (t.includes('topical')) return 'topicals'
  return fallback || (type ? t : null)
}

// Only a percentage potency maps to thc_pct/cbd_pct; mg (edibles) is skipped.
export function potencyPct(content) {
  if (!content) return null
  const unit = String(content.unit || '').toUpperCase()
  if (unit && !unit.startsWith('PERCENT')) return null
  if (!Array.isArray(content.range)) return null
  const vals = content.range.filter((v) => typeof v === 'number')
  return vals.length ? Math.max(...vals) : null
}

// Product descriptions often carry light HTML entities/tags. Strip to clean,
// single-spaced text and cap the length so rows stay lean.
export function cleanDescription(raw) {
  if (!raw || typeof raw !== 'string') return null
  const text = raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h\d)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&rsquo;|&apos;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  return text.length > 1500 ? text.slice(0, 1497).trimEnd() + '…' : text
}

// Effects come as an array of strings or small objects; normalize to a
// deduped list of effect names.
export function extractEffects(raw) {
  if (!Array.isArray(raw)) return null
  const out = []
  for (const e of raw) {
    let v = null
    if (typeof e === 'string') v = e
    else if (e && typeof e === 'object') v = e.name || e.effect || e.displayName || e.label || null
    if (v && typeof v === 'string') {
      const s = v.trim()
      if (s && !out.includes(s)) out.push(s)
    }
  }
  return out.length ? out.slice(0, 8) : null
}

// The scraped columns of a `products` row. Every module fills all of them,
// using null for anything its platform doesn't provide (never a guess).
export const PRODUCT_FIELDS = [
  'name',
  'brand',
  'description',
  'brand_description',
  'effects',
  'category',
  'strain_type',
  'thc_pct',
  'cbd_pct',
  'variants',
  'price_min',
  'url',
  'image_url',
]

const filled = (v) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)

// Share of rows with each field filled, e.g. { thc_pct: 92, effects: 0, ... }.
export function fieldCoverage(rows) {
  const out = {}
  for (const f of PRODUCT_FIELDS) {
    const n = rows.filter((r) => filled(r[f])).length
    out[f] = rows.length ? Math.round((n / rows.length) * 100) : 0
  }
  return out
}

// Why items were left out, for a dry run to explain a low count:
//   const drops = dropCounter(); drops.add('category: gear'); drops.report()
export function dropCounter() {
  const counts = new Map()
  return {
    add(reason) {
      counts.set(reason, (counts.get(reason) || 0) + 1)
    },
    report() {
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      return top.length ? `dropped: ${top.map(([r, n]) => `${r} ×${n}`).join(', ')}` : ''
    },
  }
}
