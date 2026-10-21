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
  // Render a bounded slice so a broad match set (thousands of products) stays
  // smooth; the heading still reports the true total.
  const CAP = 240
  const shown = ranked.slice(0, CAP)

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
        if (n < 0 || n >= shown.length) return i
        track('product_view', { ...eventProps(shown[n]), via: 'swipe' })
        return n
      })
    },
    [shown],
  )
  const openProductItem = openIndex != null ? shown[openIndex] : null

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
              total={shown.length}
              userLoc={filters.userLoc}
              alsoAt={same.shops}
              lowest={same.lowest}
              onClose={closeDetail}
              onStep={stepDetail}
              onAdd={onAdd}
            />
          )}
          {ranked.length > CAP && (
            <p className="meta" style={{ marginTop: 20 }}>
              Showing the first {CAP} of {ranked.length.toLocaleString()}. Refine above to narrow it down.
            </p>
          )}
        </>
      )}
    </div>
  )
}
