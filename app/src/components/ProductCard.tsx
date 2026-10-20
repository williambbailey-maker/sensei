import { useEffect, useRef, useState } from 'react'
import { formatMiles, haversineMiles } from '../lib/geo'
import { cleanTitle, formatLabel, prettyStore } from '../lib/labels'
import { productKey, track } from '../lib/analytics'
import type { LatLng, Product } from '../lib/types'

// Edibles are dosed in milligrams — a "0.05g" gummy is a 50mg gummy.
function displayWeight(weight: string, category: string | null): string {
  if (category !== 'edibles') return weight
  const m = weight.match(/^\s*([\d.]+)\s*g\s*$/i)
  if (!m) return weight
  const mg = Math.round(parseFloat(m[1]) * 1000)
  return Number.isFinite(mg) && mg > 0 ? `${mg}mg` : weight
}

// A result row that opens a detail panel on tap: thumb · name / brand · size ·
// strain · THC / store · hood · distance · price.
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

  // The six mandated properties for every product event. page_type + source
  // come from the registered super-properties.
  const evProps = {
    brand: brand ?? null,
    product_key: productKey(brand, name),
    dispensary: p.store?.name ?? p.store?.slug ?? null,
    neighborhood: p.store?.neighborhood ?? null,
    category: p.category ?? null,
  }

  // product_impression — fires once when the row first enters the viewport.
  const cardRef = useRef<HTMLDivElement | null>(null)
  const seen = useRef(false)
  useEffect(() => {
    const el = cardRef.current
    if (!el || seen.current) return
    try {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting && !seen.current) {
              seen.current = true
              track('product_impression', evProps)
              io.disconnect()
            }
          }
        },
        { threshold: 0.5 },
      )
      io.observe(el)
      return () => io.disconnect()
    } catch {
      /* no IntersectionObserver — skip impressions */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
  const thc = p.thc_pct != null && p.category !== 'edibles' ? `${p.thc_pct}% THC` : null

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

  const [imgOk, setImgOk] = useState(true)
  const hasImg = !!p.image_url && imgOk
  const thumb = (cls = '') => (
    <span className={`thumb ${hasImg ? '' : 'thumb-empty'} ${cls}`}>
      {hasImg && <img src={p.image_url!} alt="" loading="lazy" onError={() => setImgOk(false)} />}
    </span>
  )

  const detailLine = [brand, weights?.slice(0, 2).join(' · '), p.strain_type, thc].filter(Boolean).join(' · ')
  const storeLine = [storeName, place, miles != null ? formatMiles(miles) : null].filter(Boolean).join(' · ')

  return (
    <>
      {/* Compact row */}
      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        onClick={() => {
          track('product_view', evProps)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            track('product_view', evProps)
            setOpen(true)
          }
        }}
        className="row cursor-pointer"
      >
        <span className="row-l">
          {thumb()}
          <span className="min-w-0">
            <span className="label block truncate">{name}</span>
            {detailLine && <span className="meta block truncate">{detailLine}</span>}
            <span className="meta block truncate text-[rgba(20,20,20,.4)]">{storeLine}</span>
          </span>
        </span>
        <span className="label shrink-0">{price}</span>
      </div>

      {/* Detail panel: bottom sheet on mobile, centered on larger screens. */}
      {open && (
        <div
          className="fade-in fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-ink/20" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="sheet-in relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto border-t-2 border-ink bg-field px-6 pb-10 pt-5 sm:border-2"
          >
            <div className="flex items-center justify-between">
              <span className="meta">{p.category ? formatLabel(p.category) : 'Product'}</span>
              <button type="button" onClick={() => setOpen(false)} className="ghost" aria-label="Close">
                Close
              </button>
            </div>

            <div className={`detail-img mt-5 ${hasImg ? '' : 'detail-img-empty'}`}>
              {hasImg ? (
                <img src={p.image_url!} alt={name} onError={() => setImgOk(false)} />
              ) : (
                <span className="meta">No image</span>
              )}
            </div>

            <h3 className="poster mt-6">{name}</h3>
            {brand && <p className="meta mt-2 text-center">{brand}</p>}
            <div className="rule mt-4">
              <span>{price}</span>
            </div>

            <div className="stats mt-6">
              <div>
                <span className="stat-k">Size</span>
                <span className="stat-v">{weights?.length ? weights.slice(0, 2).join(' · ') : '—'}</span>
              </div>
              <div>
                <span className="stat-k">Strain</span>
                <span className="stat-v">{p.strain_type ?? '—'}</span>
              </div>
              <div>
                <span className="stat-k">THC</span>
                <span className="stat-v">{thc ? `${p.thc_pct}%` : p.potency_tier ?? '—'}</span>
              </div>
            </div>

            {(p.effects?.length ?? 0) > 0 && (
              <p className="meta mt-5 text-center">{p.effects!.slice(0, 6).join(' · ')}</p>
            )}

            <div className="mt-6 border-t-2 border-line pt-4">
              <p className="meta">Dispensary</p>
              <p className="label mt-1">{storeName}</p>
              {(place || miles != null) && (
                <p className="meta mt-0.5">{[place, miles != null ? formatMiles(miles) : null].filter(Boolean).join(' · ')}</p>
              )}
            </div>

            {/* Product-level description if we have it, else the brand blurb. */}
            {p.description ? (
              <p className="copy sentence mt-5">{p.description}</p>
            ) : p.brand_description ? (
              <div className="mt-5">
                <p className="meta">About {brand ?? 'the brand'}</p>
                <p className="copy sentence mt-1">{p.brand_description}</p>
              </div>
            ) : (
              <p className="copy sentence mt-5">No description yet. It will appear after the next menu sync.</p>
            )}

            <div className="mt-8 flex flex-col items-center gap-5">
              {p.url && (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('menu_click', { ...evProps, url: p.url })}
                  className="dotcta"
                >
                  View on Dutchie
                </a>
              )}
              {onAdd && (
                <button
                  type="button"
                  onClick={() => {
                    track('save', evProps)
                    onAdd(p)
                    setOpen(false)
                  }}
                  className="ghost"
                >
                  Add to cart
                </button>
              )}
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
