import { useCallback, useMemo, useState } from 'react'
import { FilterChips } from './FilterChips'
import { RefineBar } from './RefineBar'
import { ProductCard, eventProps } from './ProductCard'
import { ProductDetail } from './ProductDetail'
import { track } from '../lib/analytics'
import { Newsletter } from './Newsletter'
import { rankProducts } from '../lib/rank'
import { prettyStore } from '../lib/labels'
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
        ? `within ${filters.radiusMiles} mi of you`
        : 'closest to you'
      : (filters.neighborhood ?? filters.borough)

  const waiting = loading && ranked.length === 0
  const count = waiting ? '…' : ranked.length > 999 ? '999+' : String(ranked.length)

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

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <button type="button" onClick={onHome} className="ghost">
          Home
        </button>
        <button type="button" onClick={onEdit} className="ghost">
          Edit
        </button>
      </div>

      <h1 className="poster">{where ?? 'All of New York'}</h1>
      <div className="rule mt-3">
        <span>{count}</span>
      </div>
      <p className="meta mt-3 text-center">
        {waiting ? 'Pulling live menus' : `${ranked.length.toLocaleString()} match${ranked.length === 1 ? '' : 'es'}`}
      </p>

      <div className="mt-8">
        <RefineBar f={filters} onChange={onChange} neighborhoodsByBorough={neighborhoodsByBorough} />
        <FilterChips f={filters} onChange={onChange} />
      </div>

      {waiting ? (
        // Products for this filter set are still arriving — never show a
        // false "nothing matched" while we wait.
        <p className="meta mt-14 text-center">Pulling live menus</p>
      ) : ranked.length === 0 ? (
        <div className="mt-14 text-center">
          <p className="poster">Nothing matched</p>
          <p className="copy mt-3">
            {filters.userLoc ? 'Try a wider radius, or clear a filter above.' : 'Clear a filter above to widen the search.'}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6">
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
              onClose={closeDetail}
              onStep={stepDetail}
              onAdd={onAdd}
            />
          )}
          {ranked.length > CAP && (
            <p className="meta mt-6 text-center">
              Showing the first {CAP} of {ranked.length.toLocaleString()}. Refine above to narrow it down.
            </p>
          )}
        </>
      )}

      <div className="mt-14">
        <Newsletter source="results" />
      </div>
    </div>
  )
}
