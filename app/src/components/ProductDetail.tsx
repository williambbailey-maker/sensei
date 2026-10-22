import { useEffect, useRef, useState } from 'react'
import { directionsUrl, formatMiles, shortAddress } from '../lib/geo'
import { formatLabel } from '../lib/labels'
import { track } from '../lib/analytics'
import { eventProps, formatPrice, productFacts } from './ProductCard'
import type { LatLng, Product } from '../lib/types'

const PILL_COLORS = ['var(--o)', 'var(--b)', 'var(--y)']

// The product detail: a full-height sheet on the field. The arrow buttons (or
// arrow keys) move through the result list without closing. No swiping.
export function ProductDetail({
  p,
  index,
  total,
  userLoc,
  alsoAt,
  lowest,
  onClose,
  onStep,
  onAdd,
}: {
  p: Product
  index: number
  total: number
  userLoc?: LatLng | null
  alsoAt: number
  lowest: number | null
  onClose: () => void
  onStep: (delta: 1 | -1) => void
  onAdd?: (p: Product) => void
}) {
  const evProps = eventProps(p)
  const { name, brand, price, weights, miles, storeName, place, thc } = productFacts(p, userLoc)
  const address = shortAddress(p.store?.address)
  const maps = p.store ? directionsUrl(storeName, p.store.address, p.store.lat, p.store.lng) : null

  // Lock body scroll; Escape closes; arrow keys step. The panel is a history
  // entry, so the back button closes it rather than leaving the results.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const flyRef = useRef<(d: 1 | -1) => void>(() => {})
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      else if (e.key === 'ArrowRight') flyRef.current(1)
      else if (e.key === 'ArrowLeft') flyRef.current(-1)
    }
    const onPop = () => closeRef.current()
    window.addEventListener('keydown', onKey)
    try {
      history.pushState({ detail: true }, '')
      window.addEventListener('popstate', onPop)
    } catch {
      /* history unavailable */
    }
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', onPop)
      try {
        if (history.state?.detail) history.back()
      } catch {
        /* ignore */
      }
    }
  }, [])

  // Previous/next: the arrow buttons (or arrow keys) step through the result
  // list; the next product slides in from the side it came from. At either
  // end of the list the card gives a short bump instead.
  const [bump, setBump] = useState(false)
  const dirRef = useRef<0 | 1 | -1>(0)
  const canStep = (dir: 1 | -1) => (dir === 1 ? index < total - 1 : index > 0)
  const step = (dir: 1 | -1) => {
    if (!canStep(dir)) {
      setBump(true)
      setTimeout(() => setBump(false), 260)
      return
    }
    dirRef.current = dir
    onStep(dir)
  }
  flyRef.current = step

  const sheetRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 })
  }, [p.id])

  const [imgOk, setImgOk] = useState(true)
  useEffect(() => setImgOk(true), [p.id])
  const hasImg = !!p.image_url && imgOk
  const pad = (n: number) => String(n).padStart(2, '0')
  const entrance = dirRef.current === 1 ? 'sheet-enter-r' : dirRef.current === -1 ? 'sheet-enter-l' : 'sheet-in'

  return (
    <div
      ref={sheetRef}
      key={p.id}
      className={`sheet ${entrance} ${bump ? 'sheet-bump' : ''}`}
      role="dialog"
      aria-modal="true"
    >
      <div className="wrap" style={{ paddingBottom: 60 }}>
        <div className="top">
          <span>{p.category ? formatLabel(p.category) : 'Product'}</span>
          <button type="button" onClick={onClose} className="ghost" aria-label="Close">
            Close
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2" style={{ fontSize: 13, fontWeight: 500 }}>
          <span className="dot" />
          <span>In stock · as of last refresh</span>
        </div>

        <div className="deck-nav mt-3">
          <span className="meta">
            {pad(index + 1)} / {total > 999 ? '999+' : pad(total)}
          </span>
          <span className="deck-btns">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={index === 0}
              className="deck-btn"
              aria-label="Previous product"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={index >= total - 1}
              className="deck-btn"
              aria-label="Next product"
            >
              →
            </button>
          </span>
        </div>

        {/* One column on phones; image left, details right on desktop. */}
        <div className="detail-grid">
        <div className="detail-media">
        <div className={`detail-img mt-5 ${hasImg ? '' : 'items-center'}`}>
          {hasImg ? <img src={p.image_url!} alt={name} onError={() => setImgOk(false)} /> : <span className="meta">No image</span>}
        </div>
        </div>

        <div className="detail-info">
        <h3 className="poster" style={{ marginTop: 22 }}>
          {name}
        </h3>
        {brand && (
          <p className="meta" style={{ marginTop: 8 }}>
            {brand}
          </p>
        )}

        <div className="spec" style={{ marginTop: 18 }}>
          <div>
            <span className="spec-k">Price</span>
            <span className="spec-v">{price}</span>
          </div>
          <div>
            <span className="spec-k">Size</span>
            <span className="spec-v">{weights.length ? weights.slice(0, 2).join(' · ') : '—'}</span>
          </div>
          <div>
            <span className="spec-k">THC</span>
            <span className="spec-v">{thc ? `${p.thc_pct}%` : (p.potency_tier ?? '—')}</span>
          </div>
          <div>
            <span className="spec-k">Type</span>
            <span className="spec-v">{p.strain_type ?? (p.category ? formatLabel(p.category) : '—')}</span>
          </div>
          <div>
            <span className="spec-k">Also at</span>
            <span className="spec-v">{alsoAt > 1 ? `${alsoAt} shops` : 'This shop only'}</span>
          </div>
          <div>
            <span className="spec-k">Lowest nearby</span>
            <span className="spec-v">{lowest != null ? `$${formatPrice(lowest)}` : '—'}</span>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <p className="meta">Dispensary</p>
          <p className="label mt-1">{storeName}</p>
          {(place || miles != null) && (
            <p className="meta mt-0.5">{[place, miles != null ? formatMiles(miles) : null].filter(Boolean).join(' · ')}</p>
          )}
          {address && <p className="meta mt-0.5">{address}</p>}
          {maps && (
            <a
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('directions_click', { ...evProps, url: maps })}
              className="dir mt-2 inline-block"
            >
              Directions in Google Maps →
            </a>
          )}
        </div>

        {/* Product-level description if we have it, else the brand blurb; with
            neither, no description section at all. */}
        {p.description ? (
          <p className="copy" style={{ marginTop: 18 }}>
            {p.description}
          </p>
        ) : p.brand_description ? (
          <div style={{ marginTop: 18 }}>
            <p className="meta">About {brand ?? 'the brand'}</p>
            <p className="copy mt-1">{p.brand_description}</p>
          </div>
        ) : null}

        {(p.effects?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2" style={{ marginTop: 18 }}>
            {p.effects!.slice(0, 6).map((e, i) => (
              <span key={e} className={`pill ${i % 3 === 2 ? 'y' : ''}`} style={{ background: PILL_COLORS[i % 3] }}>
                {e}
              </span>
            ))}
          </div>
        )}

        {p.url && (
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('menu_click', { ...evProps, url: p.url })}
            className="cta"
            style={{ marginTop: 28 }}
          >
            <span>View on Dutchie</span>
          </a>
        )}
        {onAdd && (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => {
                track('save', evProps)
                onAdd(p)
                onClose()
              }}
              className="ghost"
            >
              Add to cart
            </button>
          </div>
        )}
        </div>
        </div>
      </div>
    </div>
  )
}
