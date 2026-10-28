import { useCallback, useMemo, useState } from 'react'
import { ProductCard, eventProps } from './ProductCard'
import { ProductDetail } from './ProductDetail'
import { Select } from './RefineBar'
import { Trail } from './Trail'
import { track } from '../lib/analytics'
import { requestLocation } from '../lib/geo'
import { BOROUGHS, formatLabel } from '../lib/labels'
import { productMiles } from '../lib/rank'
import { EMPTY_FILTERS, type LatLng, type Product } from '../lib/types'

type Sort = 'mix' | 'discount' | 'price-asc' | 'distance'
const SORT_LABELS: Record<Sort, string> = {
  mix: 'Best mix',
  discount: 'Biggest discount',
  'price-asc': 'Price: low to high',
  distance: 'Nearest first',
}
// Product types in the order the rest of the app lists them.
const TYPES = ['flower', 'pre-rolls', 'vaporizers', 'edibles', 'concentrates', 'tinctures', 'topicals']
const PAGE = 25

const off = (p: Product) => (p.price_was && p.price_min ? 1 - p.price_min / p.price_was : 0)

// The deals page (/deals): every item refresh_deals() picked from today's
// menus, about 300 markdowns of 20% or more spread across product type and
// borough. Filter by type and place, sort, and tap a row for the product
// detail, which steps through the list like results do.
export function DealsPage({
  products,
  loading,
  error,
  onBack,
  onAdd,
}: {
  products: Product[]
  loading: boolean
  error: boolean
  onBack: () => void
  onAdd?: (p: Product) => void
}) {
  const [type, setType] = useState<string | null>(null)
  const [borough, setBorough] = useState<string | null>(null)
  const [userLoc, setUserLoc] = useState<LatLng | null>(null)
  const [sort, setSort] = useState<Sort>('mix')
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of products) if (p.category) m[p.category] = (m[p.category] ?? 0) + 1
    return m
  }, [products])

  const list = useMemo(() => {
    const kept = products.filter(
      (p) => (!type || p.category === type) && (!borough || p.store?.borough === borough),
    )
    if (sort === 'discount') return [...kept].sort((a, b) => off(b) - off(a) || (a.price_min ?? 0) - (b.price_min ?? 0))
    if (sort === 'price-asc') return [...kept].sort((a, b) => (a.price_min ?? Infinity) - (b.price_min ?? Infinity))
    if (sort === 'distance' && userLoc) {
      const f = { ...EMPTY_FILTERS, userLoc }
      return [...kept].sort((a, b) => (productMiles(a, f) ?? Infinity) - (productMiles(b, f) ?? Infinity))
    }
    return kept
  }, [products, type, borough, sort, userLoc])
  const shops = useMemo(() => new Set(list.map((p) => p.store?.slug)).size, [list])

  // 25 at a time; a new filter starts back at 25 (the limit belongs to a list).
  const [lim, setLim] = useState<{ list: Product[]; n: number }>({ list, n: PAGE })
  const limit = lim.list === list ? lim.n : PAGE
  const showUpTo = useCallback((n: number) => setLim({ list, n }), [list])
  const shown = useMemo(() => list.slice(0, limit), [list, limit])

  const filtered = (what: string, value: string | null) => track('deals_filter', { [what]: value })

  // "Near me" lives in the place select: it asks for location, then sorts
  // nearest first across every borough.
  const pickPlace = (v: string) => {
    setLocError('')
    if (v === 'near') {
      filtered('place', 'near')
      setLocating(true)
      requestLocation(
        (loc) => {
          setLocating(false)
          setUserLoc(loc)
          setBorough(null)
          setSort('distance')
        },
        (msg) => {
          setLocating(false)
          setLocError(msg)
        },
      )
      return
    }
    filtered('place', v || null)
    setUserLoc(null)
    if (sort === 'distance') setSort('mix')
    setBorough(v || null)
  }

  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const openProduct = (p: Product) => {
    const i = list.findIndex((x) => x.id === p.id)
    if (i < 0) return
    track('deal_open', { ...eventProps(p), where: 'deals', rank: p.deal_rank ?? null, pct: Math.round(off(p) * 100) })
    setOpenIndex(i)
  }
  const stepDetail = useCallback(
    (delta: 1 | -1) => {
      setOpenIndex((i) => {
        if (i == null) return i
        const n = i + delta
        if (n < 0 || n >= list.length) return i
        if (n >= limit) showUpTo(limit + PAGE)
        track('product_view', { ...eventProps(list[n]), via: 'arrow' })
        return n
      })
    },
    [list, limit, showUpTo],
  )
  const open = openIndex != null ? list[openIndex] : null

  const waiting = loading && products.length === 0
  const sorts: Sort[] = userLoc ? ['mix', 'distance', 'discount', 'price-asc'] : ['mix', 'discount', 'price-asc']

  return (
    <div className="wrap" style={{ paddingTop: 28 }}>
      <Trail stops={[{ label: 'Deals' }]} onBack={onBack} backLabel="Back to home" />

      <h1 className="poster" style={{ marginTop: 26 }}>
        Deals
      </h1>
      <p className="lede lede-sm" style={{ marginTop: 12 }}>
        Markdowns of 20% or more on today's menus, spread across every product type and borough.
      </p>
      <p className="meta" style={{ marginTop: 10 }}>
        {waiting
          ? 'Pulling live menus'
          : `${list.length.toLocaleString()} deal${list.length === 1 ? '' : 's'} at ${shops} shop${shops === 1 ? '' : 's'}`}
      </p>

      {products.length > 0 && (
        <>
          <div className="deal-types" role="group" aria-label="Product type">
            {[null, ...TYPES.filter((t) => typeCounts[t])].map((t) => (
              <button
                key={t ?? 'all'}
                type="button"
                className={`tab ${type === t ? 'tab-on' : ''}`}
                aria-pressed={type === t}
                onClick={() => {
                  filtered('type', t)
                  setType(t)
                }}
              >
                {t ? formatLabel(t) : 'All'}
                <span className="deal-n">{t ? typeCounts[t] : products.length}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-4" style={{ marginTop: 20 }}>
            <Select
              label="Where"
              value={userLoc ? 'near' : (borough ?? '')}
              onChange={pickPlace}
              options={[
                { value: '', label: 'All boroughs' },
                ...BOROUGHS.map((b) => ({ value: b, label: b })),
                { value: 'near', label: locating ? 'Finding you…' : 'Near me' },
              ]}
              active={borough != null || userLoc != null}
            />
            <div className="ml-auto">
              <Select
                label="Sort"
                value={sort}
                onChange={(v) => {
                  filtered('sort', v)
                  setSort(v as Sort)
                }}
                options={sorts.map((k) => ({ value: k, label: SORT_LABELS[k] }))}
                active={sort !== 'mix'}
              />
            </div>
          </div>
          {locError && (
            <p className="meta" style={{ marginTop: 12 }}>
              {locError}
            </p>
          )}
        </>
      )}

      {waiting ? (
        <p className="meta" style={{ marginTop: 48 }}>
          Pulling live menus
        </p>
      ) : error && products.length === 0 ? (
        <p className="meta" style={{ marginTop: 48 }}>
          Couldn't load the deals right now. Check your connection and refresh.
        </p>
      ) : list.length === 0 ? (
        <div style={{ marginTop: 48 }}>
          <p className="poster">Nothing on sale here</p>
          <p className="lede lede-sm" style={{ marginTop: 14 }}>
            {products.length ? 'Try another product type or borough.' : 'No markdowns on the menus right now. Check back after the next update.'}
          </p>
        </div>
      ) : (
        <>
          <div className="results-list" style={{ marginTop: 20 }}>
            {shown.map((p) => (
              <ProductCard key={p.id} p={p} userLoc={userLoc} onOpen={openProduct} showPct />
            ))}
          </div>
          {open && openIndex != null && (
            <ProductDetail
              p={open}
              index={openIndex}
              total={list.length}
              userLoc={userLoc}
              alsoAt={null}
              lowest={null}
              onClose={() => setOpenIndex(null)}
              onStep={stepDetail}
              onAdd={onAdd}
            />
          )}
          {shown.length < list.length && (
            <div className="load-more">
              <button
                type="button"
                className="cta ghost"
                onClick={() => {
                  track('load_more', { shown: shown.length, total: list.length, where: 'deals' })
                  showUpTo(limit + PAGE)
                }}
              >
                <span>Load more</span>
              </button>
              <p className="meta" style={{ marginTop: 10 }}>
                Showing {shown.length.toLocaleString()} of {list.length.toLocaleString()}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
