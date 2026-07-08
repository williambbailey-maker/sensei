import { formatMiles, haversineMiles } from '../lib/geo'
import { cleanTitle, prettyStore, vibeLabel } from '../lib/labels'
import type { LatLng, Product } from '../lib/types'

// Potency as a small dot — tone varies, not hue, to stay inside the
// black/white/steel system.
const TIER_DOT: Record<string, string> = {
  mild: 'bg-steel',
  medium: 'bg-steel-dim',
  strong: 'bg-ink',
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
  dark = false,
}: {
  p: Product
  userLoc?: LatLng | null
  onAdd?: (p: Product) => void
  dark?: boolean
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
    <div
      className={`group flex h-full gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 ${
        dark
          ? 'border-line-dark bg-white/[0.04]'
          : 'border-line bg-panel shadow-soft-sm'
      }`}
    >
      <div
        className={`h-24 w-24 shrink-0 overflow-hidden rounded-xl ${
          dark ? 'bg-gradient-to-br from-[#38393c] to-[#1c1d1f]' : 'bg-ice'
        }`}
      >
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
            <h3 className={`max-h-[2.6em] overflow-hidden text-[15px] font-bold leading-[1.3] ${dark ? 'text-white' : 'text-ink'}`}>
              {name}
            </h3>
            {brand && (
              <p className={`truncate text-sm font-medium ${dark ? 'text-steel-dim' : 'text-muted'}`}>{brand}</p>
            )}
          </div>
          <div
            className={`shrink-0 rounded-full px-2.5 py-0.5 display text-base ${
              dark ? 'bg-white text-ink' : 'text-ink'
            }`}
          >
            {price}
          </div>
        </div>

        <div className={`mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 label text-[10px] ${dark ? 'text-steel-dim' : 'text-muted'}`}>
          {weights?.length > 0 && (
            <span className={dark ? 'text-white' : 'text-ink'}>{weights.slice(0, 3).join(' · ')}</span>
          )}
          {p.potency_tier && (
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${TIER_DOT[p.potency_tier] ?? 'bg-muted'}`} />
              {p.potency_tier}
              {p.thc_pct != null && p.category !== 'edibles' ? ` · ${p.thc_pct}% THC` : ''}
            </span>
          )}
          {p.strain_type && <span>{p.strain_type}</span>}
          {(p.vibes ?? []).slice(0, 2).map((v) => (
            <span key={v}>{vibeLabel(v)}</span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className={`truncate label text-[10px] ${dark ? 'text-steel-dim' : 'text-muted'}`}>
            {p.store?.name ?? (p.store?.slug ? prettyStore(p.store.slug) : 'Dispensary')}
            {p.store?.neighborhood
              ? ` · ${p.store.neighborhood}`
              : p.store?.borough
                ? ` · ${p.store.borough}`
                : ''}
            {miles != null && <span> · {formatMiles(miles)}</span>}
          </p>
          <span className="flex shrink-0 items-center gap-2">
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-full border px-3 py-1 label text-[10px] transition ${
                  dark ? 'border-line-dark text-white hover:bg-white/10' : 'border-line text-ink hover:bg-ice'
                }`}
              >
                View
              </a>
            )}
            {onAdd && (
              <button
                onClick={() => onAdd(p)}
                className={`rounded-full px-3 py-1 label text-[10px] transition ${
                  dark ? 'bg-white text-ink hover:opacity-85' : 'bg-ink text-white hover:opacity-85'
                }`}
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
