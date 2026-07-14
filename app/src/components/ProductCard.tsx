import { useState } from 'react'
import { formatMiles, haversineMiles } from '../lib/geo'
import { cleanTitle, prettyStore, vibeLabel } from '../lib/labels'
import type { LatLng, Product } from '../lib/types'

// Potency as a small dot — tone varies, not hue, to stay inside the palette.
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

// A result card that flips on click: the front is the at-a-glance listing; the
// back shows the full dispensary name, brand, and product description.
export function ProductCard({
  p,
  userLoc,
  onAdd,
}: {
  p: Product
  userLoc?: LatLng | null
  onAdd?: (p: Product) => void
}) {
  const [flipped, setFlipped] = useState(false)
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
  const storeName = p.store?.name ?? (p.store?.slug ? prettyStore(p.store.slug) : 'Dispensary')
  const place = p.store?.neighborhood ?? p.store?.borough ?? null

  return (
    <div className="flip h-[180px] cursor-pointer" onClick={() => setFlipped((v) => !v)}>
      <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>
        {/* Front — at-a-glance listing */}
        <div className="flip-face flex h-full gap-4 overflow-hidden rounded-2xl border border-line bg-panel p-4 shadow-soft-sm">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-ice">
            {p.image_url ? (
              <img
                src={p.image_url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            ) : null}
            {/* affordance: this card flips */}
            <span className="pointer-events-none absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-[11px] leading-none text-white">
              ⟳
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="max-h-[2.6em] overflow-hidden text-[15px] font-bold leading-[1.3] text-ink">
                  {name}
                </h3>
                {brand && <p className="truncate text-sm font-medium text-muted">{brand}</p>}
              </div>
              <div className="shrink-0 rounded-full px-2.5 py-0.5 display text-base text-ink">{price}</div>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 label text-[10px] text-muted">
              {weights?.length > 0 && <span className="text-ink">{weights.slice(0, 3).join(' · ')}</span>}
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
              <p className="truncate label text-[10px] text-muted">
                {storeName}
                {place ? ` · ${place}` : ''}
                {miles != null && <span> · {formatMiles(miles)}</span>}
              </p>
              <span className="flex shrink-0 items-center gap-2">
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full border border-line px-3 py-1 label text-[10px] text-ink transition hover:bg-ice"
                  >
                    View
                  </a>
                )}
                {onAdd && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAdd(p)
                    }}
                    className="rounded-full bg-ink px-3 py-1 label text-[10px] text-white transition hover:opacity-85"
                  >
                    + Add
                  </button>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Back — full dispensary name, brand, and description */}
        <div className="flip-face back flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-panel p-4 shadow-soft-sm">
          <p className="label text-[10px] text-muted">Dispensary</p>
          <h3 className="text-[15px] font-bold leading-tight text-ink">{storeName}</h3>
          {brand && <p className="mt-0.5 text-sm font-medium text-muted">{brand}</p>}
          <div className="mt-2 flex-1 overflow-y-auto pr-1 text-[12.5px] leading-snug text-ink/75">
            {p.description || 'No description yet — it’ll appear after the next menu sync.'}
          </div>
          <p className="mt-2 label text-[10px] text-muted">↩ Tap to flip back</p>
        </div>
      </div>
    </div>
  )
}

function formatPrice(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(2)
}
