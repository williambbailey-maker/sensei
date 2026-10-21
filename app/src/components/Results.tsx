import { useCallback, useMemo, useState } from 'react'
import { FilterChips } from './FilterChips'
import { RefineBar } from './RefineBar'
import { ProductCard, eventProps } from './ProductCard'
import { ProductDetail } from './ProductDetail'
import { track, productKey } from '../lib/analytics'
import { rankProducts } from '../lib/rank'
import { cleanTitle, prettyStore } from '../lib/labels'
import type { Filters, Product } from '../lib/types'

export function Results({
  products,
  filters,
  neighborhoodsByBorough,
  onChange,
  onHome,
  onEdit,
  onAdd,
  loading = false,
}: {
  products: Product[]
  filters: Filters
  neighborhoodsByBorough: Record<string, string[]>
  onChange: (f: Filters) => void
  onHome: () => void
  onEdit: () => void
  onAdd?: (p: Product) => void
  loading?: boolean
}) {
  const ranked = useMemo(() => rankProducts(products, filters), [products, filters])
  // Show 25 at a time with a "Load more" button; the heading still reports
  // the true total. A new search or filter (a new ranked list) starts back at
  // 25: the limit is remembered per ranked list, so there's no flash of the
  // old length on the first render.
  const PAGE = 25
  const [lim, setLim] = useState<{ list: Product[]; n: number }>({ list: ranked, n: PAGE })
  const limit = lim.list === ranked ? lim.n : PAGE
  const showUpTo = useCallback((n: number) => setLim({ list: ranked, n }), [ranked])
  const shown = useMemo(() => ranked.slice(0, limit), [ranked, limit])

  const where = filters.store
    ? (filters.storeName ?? prettyStore(filters.store))
    : filters.userLoc
      ? filters.radiusMiles != null
        ? `Within ${filters.radiusMiles} mi of you`
        : 'Closest to you'
      : (filters.neighborhood ?? filters.borough)

  const waiting = loading && ranked.length === 0

  // The detail panel is owned here so it can be swiped through the list:
  // openIndex points into `shown`, and stepping logs a product_view for the
  // product that comes into view.
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const openProduct = (p: Product) => {
    const i = shown.findIndex((x) => x.id === p.id)
    setOpenIndex(i >= 0 ? i : null)
  }
  const closeDetail = useCallback(() => setOpenIndex(null), [])
  const stepDetail = useCallback(
    (delta: 1 | -1) => {
      setOpenIndex((i) => {
        if (i == null) return i
        const n = i + delta
        if (n < 0 || n >= ranked.length) return i
        // Swiping past the last loaded card loads the next 25 behind it.
        if (n >= limit) showUpTo(limit + PAGE)
        track('product_view', { ...eventProps(ranked[n]), via: 'swipe' })
        return n
      })
    },
    [ranked, limit, showUpTo],
  )
  const openProductItem = openIndex != null ? ranked[openIndex] : null

  // "Also at N shops" / "Lowest nearby": the same product (brand + name) across
  // the loaded result set, which already spans every shop in scope.
  const same = useMemo(() => {
    if (!openProductItem) return { shops: 0, lowest: null as number | null }
    const key = productKey(openProductItem.clean_brand ?? openProductItem.brand, cleanTitle(openProductItem.clean_name ?? openProductItem.name ?? ''))
    const stores = new Set<string>()
    let lowest: number | null = null
    for (const p of products) {
      if (productKey(p.clean_brand ?? p.brand, cleanTitle(p.clean_name ?? p.name ?? '')) !== key) continue
      if (p.store?.slug) stores.add(p.store.slug)
      if (p.price_min != null && (lowest == null || p.price_min < lowest)) lowest = p.price_min
    }
    return { shops: stores.size, lowest }
  }, [openProductItem, products])

  return (
    <div className="wrap" style={{ paddingTop: 28 }}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onHome} className="ghost">
          Home
        </button>
        <button type="button" onClick={onEdit} className="ghost">
          Edit
        </button>
      </div>

      <h1 className="poster" style={{ marginTop: 26 }}>
        {where ?? 'All of New York'}
      </h1>
      <p className="meta" style={{ marginTop: 10 }}>
        {waiting ? 'Pulling live menus' : `${ranked.length.toLocaleString()} match${ranked.length === 1 ? '' : 'es'}`}
      </p>

      <div style={{ marginTop: 24 }}>
        <RefineBar f={filters} onChange={onChange} neighborhoodsByBorough={neighborhoodsByBorough} />
        <FilterChips f={filters} onChange={onChange} />
      </div>

      {waiting ? (
        // Products for this filter set are still arriving — never show a
        // false "nothing matched" while we wait.
        <p className="meta" style={{ marginTop: 48 }}>
          Pulling live menus
        </p>
      ) : ranked.length === 0 ? (
        <div style={{ marginTop: 48 }}>
          <p className="poster">Nothing matched</p>
          <p className="lede lede-sm" style={{ marginTop: 14 }}>
            {filters.userLoc ? 'Try a wider radius, or clear a filter above.' : 'Clear a filter above to widen the search.'}
          </p>
        </div>
      ) : (
        <>
          <div className="results-list" style={{ marginTop: 20 }}>
            {shown.map((p) => (
              <ProductCard key={p.id} p={p} userLoc={filters.userLoc} onOpen={openProduct} />
            ))}
          </div>
          {openProductItem && openIndex != null && (
            <ProductDetail
              p={openProductItem}
              index={openIndex}
              total={ranked.length}
              userLoc={filters.userLoc}
              alsoAt={same.shops}
              lowest={same.lowest}
              onClose={closeDetail}
              onStep={stepDetail}
              onAdd={onAdd}
            />
          )}
          {shown.length < ranked.length && (
            <div className="load-more">
              <button
                type="button"
                className="cta ghost"
                onClick={() => {
                  track('load_more', { shown: shown.length, total: ranked.length })
                  showUpTo(limit + PAGE)
                }}
              >
                <span>Load more</span>
              </button>
              <p className="meta" style={{ marginTop: 10 }}>
                Showing {shown.length.toLocaleString()} of {ranked.length.toLocaleString()}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
