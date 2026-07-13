import { haversineMiles } from './geo'
import { SIZES, weightToGrams } from './labels'
import { hasStructuredFilter, type Filters, type Product } from './types'

const POTENCY_ORDER: Record<string, number> = { mild: 0, medium: 1, strong: 2 }

// Distance from the user to a product's store, or null when either side has
// no coordinates.
export function productMiles(p: Product, f: Filters): number | null {
  if (!f.userLoc || p.store?.lat == null || p.store?.lng == null) return null
  return haversineMiles(f.userLoc, { lat: p.store.lat, lng: p.store.lng })
}

// Hard filters remove products; soft signals score the survivors.
// Spec ranking: filter match -> in_stock -> potency/price fit -> variety across stores.
export function rankProducts(products: Product[], f: Filters): Product[] {
  const structured = hasStructuredFilter(f)
  const query = f.text.trim().toLowerCase()

  const kept = products.filter((p) => {
    if (!p.in_stock) return false
    if (f.format && p.category !== f.format) return false
    if (f.strain && p.strain_type !== f.strain) return false
    if (f.borough && p.store?.borough !== f.borough) return false
    if (f.neighborhood && p.store?.neighborhood !== f.neighborhood) return false
    if (f.userLoc && f.radiusMiles != null) {
      // Radius mode: stores without coordinates can't qualify.
      const mi = productMiles(p, f)
      if (mi == null || mi > f.radiusMiles) return false
    }
    if (f.priceCeiling != null && (p.price_min ?? Infinity) > f.priceCeiling) return false
    if (f.priceBand && p.price_band !== f.priceBand) return false
    if (f.thcMin != null && (p.thc_pct == null || p.thc_pct < f.thcMin)) return false
    if (f.size) {
      const bucket = SIZES.find((s) => s.key === f.size)
      // A product qualifies if any of its variants falls in the size bucket.
      if (bucket) {
        const ok = (p.variants ?? []).some((v) => {
          const g = weightToGrams(v.weight)
          return g != null && g >= bucket.min && g < bucket.max
        })
        if (!ok) return false
      }
    }
    if (!structured && query) {
      const hay = `${p.clean_name ?? p.name ?? ''} ${p.clean_brand ?? p.brand ?? ''}`.toLowerCase()
      if (!hay.includes(query)) return false
    }
    return true
  })

  // Objective sorts override the vibe score and skip store interleaving so the
  // ordering the user asked for is exact (cheapest first really is cheapest).
  if (f.sort === 'price-asc')
    return [...kept].sort((a, b) => (a.price_min ?? Infinity) - (b.price_min ?? Infinity))
  if (f.sort === 'price-desc')
    return [...kept].sort((a, b) => (b.price_min ?? -Infinity) - (a.price_min ?? -Infinity))
  if (f.sort === 'potency')
    return [...kept].sort((a, b) => potency(b) - potency(a))
  if (f.sort === 'distance' && f.userLoc)
    return [...kept].sort(
      (a, b) => (productMiles(a, f) ?? Infinity) - (productMiles(b, f) ?? Infinity),
    )

  const scored = kept.map((p) => ({ p, s: score(p, f) }))
  scored.sort((a, b) => b.s - a.s || (a.p.price_min ?? 1e9) - (b.p.price_min ?? 1e9))
  return interleaveByStore(scored.map((x) => x.p))
}

// A single potency number for sorting: THC% when we have it, else the tier.
function potency(p: Product): number {
  if (p.thc_pct != null) return p.thc_pct
  return (POTENCY_ORDER[p.potency_tier ?? ''] ?? 1) * 10
}

function score(p: Product, f: Filters): number {
  let s = 0
  // vibe overlap is the strongest signal
  if (f.vibes.length && p.vibes) {
    const overlap = f.vibes.filter((v) => p.vibes!.includes(v)).length
    s += overlap * 5
  }
  if (f.experience && p.experience_level === f.experience) s += 3
  // potency/price fit: reward beginner->mild, experienced->strong even without explicit tier
  if (f.experience === 'beginner' && p.potency_tier === 'mild') s += 1
  if (f.experience === 'experienced' && p.potency_tier === 'strong') s += 1
  if (f.priceCeiling != null && p.price_min != null) {
    // closer to the ceiling (but under) = better value signal, mild boost
    s += Math.max(0, 1 - Math.abs(f.priceCeiling - p.price_min) / Math.max(f.priceCeiling, 1))
  }
  // known potency ordering as a gentle tiebreaker toward medium by default
  s += (POTENCY_ORDER[p.potency_tier ?? ''] ?? 1) * 0.01
  return s
}

// Spread stores so the top of the list isn't one shop. Round-robin by store,
// preserving the score order within each store.
function interleaveByStore(list: Product[]): Product[] {
  const buckets = new Map<string, Product[]>()
  for (const p of list) {
    const key = p.store?.slug ?? 'unknown'
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(p)
  }
  const queues = [...buckets.values()]
  const out: Product[] = []
  let added = true
  while (added) {
    added = false
    for (const q of queues) {
      const next = q.shift()
      if (next) {
        out.push(next)
        added = true
      }
    }
  }
  return out
}
