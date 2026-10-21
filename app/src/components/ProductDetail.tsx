import { useEffect, useRef, useState } from 'react'
import { formatMiles } from '../lib/geo'
import { formatLabel } from '../lib/labels'
import { track } from '../lib/analytics'
import { eventProps, formatPrice, productFacts } from './ProductCard'
import type { LatLng, Product } from '../lib/types'

const PILL_COLORS = ['var(--o)', 'var(--b)', 'var(--y)']

// The product detail: a full-height sheet on the field. Swipe left or right
// (or use the arrow keys) to move through the result list without closing.
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

  // Lock body scroll; Escape closes; arrow keys step. The panel is a history
  // entry, so the back button (or an edge swipe) closes it rather than
  // leaving the results.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const stepRef = useRef(onStep)
  stepRef.current = onStep
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      else if (e.key === 'ArrowRight') stepRef.current(1)
      else if (e.key === 'ArrowLeft') stepRef.current(-1)
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
    // A swipe that starts at the left edge is "back", handled by the app.
    touch.current = t.clientX <= 24 ? null : { x: t.clientX, y: t.clientY }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touch.current) return
    const t = e.touches[0]
    const mx = t.clientX - touch.current.x
    const my = t.clientY - touch.current.y
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

  const sheetRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    sheetRef.current?.scrollTo({ top: 0 })
  }, [p.id])

  const [imgOk, setImgOk] = useState(true)
  useEffect(() => setImgOk(true), [p.id])
  const hasImg = !!p.image_url && imgOk
  const pad = (n: number) => String(n).padStart(2, '0')
  const firstId = useRef(p.id)
  const entrance = nudge && firstId.current === p.id ? 'sheet-nudge' : 'sheet-in'

  return (
    <div
      ref={sheetRef}
      key={p.id}
      className={`sheet ${entrance}`}
      role="dialog"
      aria-modal="true"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform .18s ease' }}
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

        <div className="swipe mt-3 justify-start">
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

        <div className={`detail-img mt-5 ${hasImg ? '' : 'items-center'}`}>
          {hasImg ? <img src={p.image_url!} alt={name} onError={() => setImgOk(false)} /> : <span className="meta">No image</span>}
        </div>

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
        </div>

        {/* Product-level description if we have it, else the brand blurb. */}
        {p.description ? (
          <p className="copy" style={{ marginTop: 18 }}>
            {p.description}
          </p>
        ) : p.brand_description ? (
          <div style={{ marginTop: 18 }}>
            <p className="meta">About {brand ?? 'the brand'}</p>
            <p className="copy mt-1">{p.brand_description}</p>
          </div>
        ) : (
          <p className="copy" style={{ marginTop: 18 }}>
            No description yet. It will appear after the next menu sync.
          </p>
        )}

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
  )
}
