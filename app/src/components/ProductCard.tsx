import { useEffect, useRef, useState } from 'react'
import { formatMiles, haversineMiles } from '../lib/geo'
import { cleanTitle, prettyStore } from '../lib/labels'
import { productKey, track } from '../lib/analytics'
import type { LatLng, Product } from '../lib/types'

// Edibles are dosed in milligrams — a "0.05g" gummy is a 50mg gummy.
export function displayWeight(weight: string, category: string | null): string {
  if (category !== 'edibles') return weight
  const m = weight.match(/^\s*([\d.]+)\s*g\s*$/i)
  if (!m) return weight
  const mg = Math.round(parseFloat(m[1]) * 1000)
  return Number.isFinite(mg) && mg > 0 ? `${mg}mg` : weight
}

export function formatPrice(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(2)
}

// The six mandated properties for every product event. page_type + source
// come from the registered super-properties.
export function eventProps(p: Product) {
  const name = cleanTitle(p.clean_name ?? p.name ?? 'Unknown')
  const brand = p.clean_brand ?? p.brand
  return {
    brand: brand ?? null,
    product_key: productKey(brand, name),
    dispensary: p.store?.name ?? p.store?.slug ?? null,
    neighborhood: p.store?.neighborhood ?? null,
    category: p.category ?? null,
  }
}

// What a product row and its detail panel both show.
export function productFacts(p: Product, userLoc?: LatLng | null) {
  const name = cleanTitle(p.clean_name ?? p.name ?? 'Unknown')
  const brand = p.clean_brand ?? p.brand
  const price = p.price_min != null ? `$${formatPrice(p.price_min)}` : '—'
  const weights = ((p.variants?.map((v) => v.weight).filter(Boolean) as string[]) ?? [])
    .filter((w) => !/^n\/?a$/i.test(w.trim()))
    .map((w) => displayWeight(w, p.category))
  const miles =
    userLoc && p.store?.lat != null && p.store?.lng != null
      ? haversineMiles(userLoc, { lat: p.store.lat, lng: p.store.lng })
      : null
  const storeName = p.store?.name ?? (p.store?.slug ? prettyStore(p.store.slug) : 'Dispensary')
  const place = p.store?.neighborhood ?? p.store?.borough ?? null
  const thc = p.thc_pct != null && p.category !== 'edibles' ? `${p.thc_pct}% THC` : null
  return { name, brand, price, weights, miles, storeName, place, thc }
}

// A result row: thumb · name / brand · size · strain · THC / store · hood ·
// distance · price. Tapping it opens the detail panel, which Results owns so
// the panel can be swiped from product to product.
export function ProductCard({
  p,
  userLoc,
  onOpen,
}: {
  p: Product
  userLoc?: LatLng | null
  onOpen: (p: Product) => void
}) {
  const evProps = eventProps(p)
  const { name, brand, price, weights, miles, storeName, place, thc } = productFacts(p, userLoc)

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

  const [imgOk, setImgOk] = useState(true)
  const hasImg = !!p.image_url && imgOk

  const open = () => {
    track('product_view', evProps)
    onOpen(p)
  }

  const detailLine = [brand, weights.slice(0, 2).join(' · '), p.strain_type, thc].filter(Boolean).join(' · ')
  const storeLine = [storeName, place, miles != null ? formatMiles(miles) : null].filter(Boolean).join(' · ')

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      className="row cursor-pointer"
    >
      <span className="row-l">
        <span className={`thumb ${hasImg ? '' : 'thumb-empty'}`}>
          {hasImg && <img src={p.image_url!} alt="" loading="lazy" onError={() => setImgOk(false)} />}
        </span>
        <span className="min-w-0">
          <span className="label block truncate">{name}</span>
          {detailLine && <span className="meta block truncate">{detailLine}</span>}
          <span className="meta block truncate text-[rgba(20,20,20,.4)]">{storeLine}</span>
        </span>
      </span>
      <span className="label shrink-0">{price}</span>
    </div>
  )
}
