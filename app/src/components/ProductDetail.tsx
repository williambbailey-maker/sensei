import { useEffect, useRef, useState } from 'react'
import { formatMiles } from '../lib/geo'
import { formatLabel } from '../lib/labels'
import { track } from '../lib/analytics'
import { eventProps, productFacts } from './ProductCard'
import type { LatLng, Product } from '../lib/types'

// The product detail panel: a bottom sheet on mobile, centered on larger
// screens. Swipe left or right (or use the arrow keys) to move through the
// result list without closing it.
export function ProductDetail({
  p,
  index,
  total,
  userLoc,
  onClose,
  onStep,
  onAdd,
}: {
  p: Product
  index: number
  total: number
  userLoc?: LatLng | null
  onClose: () => void
  onStep: (delta: 1 | -1) => void
  onAdd?: (p: Product) => void
}) {
  const evProps = eventProps(p)
  const { name, brand, price, weights, miles, storeName, place, thc } = productFacts(p, userLoc)

  // Lock body scroll; Escape closes; arrow keys step.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onStep(1)
      else if (e.key === 'ArrowLeft') onStep(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, onStep])

  // Horizontal swipe: a clear sideways gesture, not a vertical scroll.
  const touch = useRef<{ x: number; y: number } | null>(null)
  const [dx, setDx] = useState(0)
  // First open in this session: the sheet nudges sideways once so the swipe
  // is discoverable without a button.
  const [nudge] = useState(() => {
    try {
      if (sessionStorage.getItem('sensei_swipe_hint') === '1') return false
      sessionStorage.setItem('sensei_swipe_hint', '1')
    } catch {
      /* no storage — nudge every time */
    }
    return true
  })
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touch.current) return
    const t = e.touches[0]
    const mx = t.clientX - touch.current.x
    const my = t.clientY - touch.current.y
    // Follow the finger a little once it's clearly sideways, so the panel
    // reads as a deck of tiles.
    if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.5) setDx(Math.max(-80, Math.min(80, mx * 0.4)))
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current
    touch.current = null
    setDx(0)
    if (!start) return
    const t = e.changedTouches[0]
    const mx = t.clientX - start.x
    const my = t.clientY - start.y
    if (Math.abs(mx) < 60 || Math.abs(mx) < Math.abs(my) * 1.5) return
    onStep(mx < 0 ? 1 : -1)
  }

  // Scroll the sheet back to the top and re-run the entrance when the
  // product changes.
  const sheetRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 })
  }, [p.id])

  const [imgOk, setImgOk] = useState(true)
  useEffect(() => setImgOk(true), [p.id])
  const hasImg = !!p.image_url && imgOk
  const pad = (n: number) => String(n).padStart(2, '0')
  // The nudge plays on the product the panel opened on, not on every swipe.
  const firstId = useRef(p.id)
  const entrance = nudge && firstId.current === p.id ? 'sheet-nudge' : 'sheet-in'

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/20" />
      <div
        ref={sheetRef}
        key={p.id}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform .18s ease' }}
        className={`${entrance} relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto border-t-2 border-ink bg-field px-6 pb-10 pt-5 sm:border-2`}
      >
        <div className="flex items-center justify-between">
          <span className="meta">{p.category ? formatLabel(p.category) : 'Product'}</span>
          <button type="button" onClick={onClose} className="ghost" aria-label="Close">
            Close
          </button>
        </div>

        {/* Where you are in the deck, and that it swipes. */}
        <div className="swipe mt-4">
          <span className={`swipe-a ${index === 0 ? 'swipe-off' : ''}`} aria-hidden="true">
            ←
          </span>
          <span className="meta">
            {pad(index + 1)} / {total > 999 ? '999+' : pad(total)} · swipe for next
          </span>
          <span className={`swipe-a ${index >= total - 1 ? 'swipe-off' : ''}`} aria-hidden="true">
            →
          </span>
        </div>

        <div className={`detail-img mt-4 ${hasImg ? '' : 'detail-img-empty'}`}>
          {hasImg ? <img src={p.image_url!} alt={name} onError={() => setImgOk(false)} /> : <span className="meta">No image</span>}
        </div>

        <h3 className="poster mt-6">{name}</h3>
        {brand && <p className="meta mt-2 text-center">{brand}</p>}
        <div className="rule mt-4">
          <span>{price}</span>
        </div>

        <div className="stats mt-6">
          <div>
            <span className="stat-k">Size</span>
            <span className="stat-v">{weights.length ? weights.slice(0, 2).join(' · ') : '—'}</span>
          </div>
          <div>
            <span className="stat-k">Strain</span>
            <span className="stat-v">{p.strain_type ?? '—'}</span>
          </div>
          <div>
            <span className="stat-k">THC</span>
            <span className="stat-v">{thc ? `${p.thc_pct}%` : (p.potency_tier ?? '—')}</span>
          </div>
        </div>

        {(p.effects?.length ?? 0) > 0 && <p className="meta mt-5 text-center">{p.effects!.slice(0, 6).join(' · ')}</p>}

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
                onClose()
              }}
              className="ghost"
            >
              Add to cart
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
