import { formatMiles, haversineMiles } from '../lib/geo'
import { cleanTitle, prettyStore, vibeLabel } from '../lib/labels'
import type { LatLng, Product } from '../lib/types'

// Potency as a small colored dot.
const TIER_DOT: Record<string, string> = {
  mild: 'bg-slate',
  medium: 'bg-ochre',
  strong: 'bg-tomato',
}

// Edibles are dosed in milligrams — a "0.05g" gummy is a 50mg gummy.
function displayWeight(weight: string, category: string | null): string {
  if (category !== 'edibles') return weight
  const m = weight.match(/^\s*([\d.]+)\s*g\s*$/i)
  if (!m) return weight
  const mg = Math.round(parseFloat(m[1]) * 1000)
  return Number.isFinite(mg) && mg > 0 ? `${mg}mg` : weight
}

export function ProductCard({
  p,
  userLoc,
  onAdd,
}: {
  p: Product
  userLoc?: LatLng | null
  onAdd?: (p: Product) => void
}) {
  const name = cleanTitle(p.clean_name ?? p.name ?? 'Unknown')
  const brand = p.clean_brand ?? p.brand
  const price = p.price_min != null ? `$${formatPrice(p.price_min)}` : '—'
  const weights = (p.variants?.map((v) => v.weight).filter(Boolean) as string[])
    ?.filter((w) => !/^n\/?a$/i.test(w.trim()))
    .map((w) => displayWeight(w, p.category))
  const miles =
    userLoc && p.store?.lat != null && p.store?.lng != null
      ? haversineMiles(userLoc, { lat: p.store.lat, lng: p.store.lng })
      : null

  return (
    <div className="group flex h-full gap-4 rounded-2xl border-3 border-ink bg-white p-4 shadow-[4px_4px_0_#384166] transition hover:-translate-y-0.5">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border-3 border-ink bg-ice">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="max-h-[2.6em] overflow-hidden text-[15px] font-bold leading-[1.3] text-ink">
              {name}
            </h3>
            {brand && <p className="truncate text-sm font-medium text-muted">{brand}</p>}
          </div>
          <div className="display shrink-0 text-2xl text-cobalt">{price}</div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 label text-[10px] text-muted">
          {weights?.length > 0 && <span className="text-ink">{weights.slice(0, 3).join(' · ')}</span>}
          {p.potency_tier && (
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full border border-ink ${TIER_DOT[p.potency_tier] ?? 'bg-muted'}`} />
              {p.potency_tier}
              {p.thc_pct != null && p.category !== 'edibles' ? ` · ${p.thc_pct}% THC` : ''}
            </span>
          )}
          {p.strain_type && <span>{p.strain_type}</span>}
          {(p.vibes ?? []).slice(0, 2).map((v) => (
            <span key={v} className="text-magenta">
              {vibeLabel(v)}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="truncate label text-[10px] text-muted">
            {p.store?.name ?? (p.store?.slug ? prettyStore(p.store.slug) : 'Dispensary')}
            {p.store?.neighborhood
              ? ` · ${p.store.neighborhood}`
              : p.store?.borough
                ? ` · ${p.store.borough}`
                : ''}
            {miles != null && <span className="text-magenta"> · {formatMiles(miles)}</span>}
          </p>
          <span className="flex shrink-0 items-center gap-2">
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border-3 border-ink px-3 py-1 label text-[10px] text-ink transition hover:bg-ice"
              >
                View
              </a>
            )}
            {onAdd && (
              <button
                onClick={() => onAdd(p)}
                className="rounded-full border-3 border-ink bg-cobalt px-3 py-1 label text-[10px] text-white transition hover:bg-cobalt-deep"
              >
                + Add
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

function formatPrice(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(2)
}
