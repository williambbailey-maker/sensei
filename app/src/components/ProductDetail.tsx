import { useEffect, useRef, useState } from 'react'
import { directionsUrl, formatMiles, shortAddress } from '../lib/geo'
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
  const address = shortAddress(p.store?.address)
  const maps = p.store ? directionsUrl(storeName, p.store.address, p.store.lat, p.store.lng) : null

  // Lock body scroll; Escape closes; arrow keys step. The panel is a history
  // entry, so the back button (or an edge swipe) closes it rather than
  // leaving the results.
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

  // Horizontal swipe, deck-style: the card follows the finger 1:1 with a
  // little tilt, flies off when released past the threshold (or flung), and
  // the next card slides in from the other side. Short drags spring back.
  const touch = useRef<{ x: number; y: number; t: number; lastX: number; lastT: number } | null>(null)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  // 0 = at rest; ±1 = flying off in that direction; 'bump' = at the end of the deck.
  const [fly, setFly] = useState<0 | 1 | -1 | 'bump'>(0)
  const dirRef = useRef<0 | 1 | -1>(0)
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
  const canStep = (dir: 1 | -1) => (dir === 1 ? index < total - 1 : index > 0)
  const flyTo = (dir: 1 | -1) => {
    if (fly !== 0) return
    if (!canStep(dir)) {
      setDx(0)
      setFly('bump')
      setTimeout(() => setFly(0), 260)
      return
    }
    setFly(dir)
    setTimeout(() => {
      dirRef.current = dir
      setFly(0)
      setDx(0)
      onStep(dir)
    }, 230)
  }
  flyRef.current = flyTo
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    // A swipe that starts in the left third is "back", handled by the app;
    // product swipes start anywhere else.
    if (t.clientX <= window.innerWidth / 3 || fly !== 0) {
      touch.current = null
      return
    }
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now(), lastX: t.clientX, lastT: Date.now() }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touch.current
    if (!s) return
    const t = e.touches[0]
    const mx = t.clientX - s.x
    const my = t.clientY - s.y
    s.lastX = t.clientX
    s.lastT = Date.now()
    if (!dragging && Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3) setDragging(true)
    if (dragging || (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3)) {
      // Resist at the ends of the deck so the card feels held.
      const dir = mx < 0 ? 1 : -1
      setDx(canStep(dir) ? mx : mx * 0.3)
    }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current
    touch.current = null
    const wasDragging = dragging
    setDragging(false)
    if (!s) return
    const t = e.changedTouches[0]
    const mx = t.clientX - s.x
    const my = t.clientY - s.y
    // Velocity from the last few pixels: a quick flick counts even if short.
    const vx = (t.clientX - s.lastX) / Math.max(1, Date.now() - s.lastT)
    const sideways = Math.abs(mx) > Math.abs(my) * 1.3
    const far = Math.abs(mx) > Math.min(140, window.innerWidth * 0.35)
    const flick = Math.abs(vx) > 0.5 && Math.abs(mx) > 30
    if (wasDragging && sideways && (far || flick)) {
      flyTo(mx < 0 ? 1 : -1)
      return
    }
    setDx(0)
  }
  // Where the card is right now: dragging follows the finger; flying goes
  // off-screen; a bump is a short shove; otherwise at rest.
  const W = typeof window !== 'undefined' ? window.innerWidth : 400
  const x = fly === 1 ? -W * 1.15 : fly === -1 ? W * 1.15 : fly === 'bump' ? 0 : dx
  const tilt = fly === 'bump' ? 0 : fly === 1 || fly === -1 ? (fly === 1 ? -6 : 6) : dx / 40
  const sheetStyle: React.CSSProperties = {
    transform: x || tilt ? `translateX(${x}px) rotate(${tilt}deg)` : undefined,
    transformOrigin: '50% 120%',
    transition: dragging ? 'none' : fly === 1 || fly === -1 ? 'transform .23s cubic-bezier(.4,0,1,1)' : 'transform .32s cubic-bezier(.2,.8,.2,1)',
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
  const entrance =
    dirRef.current === 1 ? 'sheet-enter-r' : dirRef.current === -1 ? 'sheet-enter-l' : nudge && firstId.current === p.id ? 'sheet-nudge' : 'sheet-in'

  return (
    <div
      ref={sheetRef}
      key={p.id}
      className={`sheet ${entrance} ${fly === 'bump' ? 'sheet-bump' : ''}`}
      role="dialog"
      aria-modal="true"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={sheetStyle}
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
              onClick={() => flyTo(-1)}
              disabled={index === 0}
              className="deck-btn"
              aria-label="Previous product"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => flyTo(1)}
              disabled={index >= total - 1}
              className="deck-btn"
              aria-label="Next product"
            >
              →
            </button>
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
