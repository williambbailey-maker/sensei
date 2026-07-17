import { useEffect, useState } from 'react'
import { formatMiles, haversineMiles } from '../lib/geo'
import { cleanTitle, prettyStore, vibeLabel } from '../lib/labels'
import type { LatLng, Product } from '../lib/types'

// Potency as a small dot — tone varies, not hue, to stay inside the palette.
const TIER_DOT: Record<string, string> = {
  mild: 'bg-steel',
  medium: 'bg-steel-dim',
  strong: 'bg-yellow',
}

// Edibles are dosed in milligrams — a "0.05g" gummy is a 50mg gummy.
function displayWeight(weight: string, category: string | null): string {
  if (category !== 'edibles') return weight
  const m = weight.match(/^\s*([\d.]+)\s*g\s*$/i)
  if (!m) return weight
  const mg = Math.round(parseFloat(m[1]) * 1000)
  return Number.isFinite(mg) && mg > 0 ? `${mg}mg` : weight
}

// A result card that expands on click: the compact card grows into a larger
// detail panel (roughly double, sized to the screen) with the full product
// image, dispensary name, brand, and description.
export function ProductCard({
  p,
  userLoc,
  onAdd,
}: {
  p: Product
  userLoc?: LatLng | null
  onAdd?: (p: Product) => void
}) {
  const [open, setOpen] = useState(false)
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

  // While the panel is open, lock body scroll and allow Escape to close.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const potency = p.potency_tier && (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${TIER_DOT[p.potency_tier] ?? 'bg-muted'}`} />
      {p.potency_tier}
      {p.thc_pct != null && p.category !== 'edibles' ? ` · ${p.thc_pct}% THC` : ''}
    </span>
  )

  return (
    <>
      {/* Compact card */}
      <div
        onClick={() => setOpen(true)}
        className="group glass flex h-full cursor-pointer gap-4 rounded-[28px] p-4 shadow-soft-sm transition hover:-translate-y-0.5"
      >
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-white/5">
          {p.image_url ? (
            <img
              src={p.image_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          ) : null}
          <span className="pointer-events-none absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] leading-none text-white">
            ⤢
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="max-h-[2.6em] overflow-hidden text-[15px] font-bold leading-[1.3] text-ink">{name}</h3>
              {brand && <p className="truncate text-sm font-medium text-muted">{brand}</p>}
            </div>
            <div className="shrink-0 rounded-full px-2.5 py-0.5 display text-base text-ink">{price}</div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 label text-[10px] text-muted">
            {weights?.length > 0 && <span className="text-ink">{weights.slice(0, 3).join(' · ')}</span>}
            {potency}
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
                  className="rounded-full border border-white/20 px-3 py-1 label text-[10px] text-white transition hover:bg-white/10"
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
                  className="rounded-full bg-clay px-3 py-1 label text-[10px] text-onyx transition active:scale-95"
                >
                  + Add
                </button>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded detail panel */}
      {open && (
        <div
          className="fade-in fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="expand-in relative z-10 flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-[32px] border border-white/15 bg-charcoal shadow-soft-lg"
          >
            {/* Large product image from the site */}
            <div className="relative aspect-square w-full shrink-0 bg-ice">
              {p.image_url ? (
                <img src={p.image_url} alt={name} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center label text-[11px] text-muted">
                  No image
                </div>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
              >
                ✕
              </button>
            </div>

            {/* Details */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold leading-tight text-ink">{name}</h3>
                  {brand && <p className="mt-0.5 text-sm font-medium text-muted">{brand}</p>}
                </div>
                <div className="shrink-0 display text-xl text-ink">{price}</div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 label text-[10px] text-muted">
                {weights?.length > 0 && <span className="text-ink">{weights.join(' · ')}</span>}
                {potency}
                {p.strain_type && <span>{p.strain_type}</span>}
              </div>

              {(p.effects?.length ?? 0) > 0 && (
                <div className="mt-3">
                  <p className="label text-[10px] text-muted">Effects</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.effects!.slice(0, 8).map((e) => (
                      <span key={e} className="rounded-full border border-clay/40 bg-clay/10 px-2.5 py-1 label text-[10px] text-clay">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 border-t border-line pt-4">
                <p className="label text-[10px] text-muted">Dispensary</p>
                <p className="mt-0.5 text-[15px] font-bold text-ink">{storeName}</p>
                {place && (
                  <p className="label text-[10px] text-muted">
                    {place}
                    {miles != null ? ` · ${formatMiles(miles)}` : ''}
                  </p>
                )}
              </div>

              {/* Product-level description if we have it, else the brand blurb. */}
              {p.description ? (
                <p className="mt-4 text-[13px] leading-relaxed text-ink/75">{p.description}</p>
              ) : p.brand_description ? (
                <div className="mt-4">
                  <p className="label text-[10px] text-muted">About {brand ?? 'the brand'}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink/75">{p.brand_description}</p>
                </div>
              ) : (
                <p className="mt-4 text-[13px] leading-relaxed text-ink/60">
                  No description yet — it’ll appear after the next menu sync.
                </p>
              )}

              <div className="mt-5 flex items-center gap-2.5">
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-full border border-white/25 px-4 py-2.5 text-center label text-[11px] text-white transition hover:bg-white/10"
                  >
                    View on Dutchie
                  </a>
                )}
                {onAdd && (
                  <button
                    onClick={() => {
                      onAdd(p)
                      setOpen(false)
                    }}
                    className="flex-1 rounded-full bg-clay px-4 py-2.5 label text-[11px] text-onyx transition active:scale-95"
                  >
                    + Add to cart
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function formatPrice(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(2)
}
