import { useMemo } from 'react'
import { Ico } from './Ico'
import { FilterChips } from './FilterChips'
import { RefineBar } from './RefineBar'
import { ProductCard } from './ProductCard'
import { Newsletter } from './Newsletter'
import { rankProducts } from '../lib/rank'
import type { Filters, Product } from '../lib/types'

export function Results({
  products,
  filters,
  neighborhoodsByBorough,
  onChange,
  onHome,
  onEdit,
  onAdd,
}: {
  products: Product[]
  filters: Filters
  neighborhoodsByBorough: Record<string, string[]>
  onChange: (f: Filters) => void
  onHome: () => void
  onEdit: () => void
  onAdd?: (p: Product) => void
}) {
  const ranked = useMemo(() => rankProducts(products, filters), [products, filters])

  const where = filters.userLoc
    ? `within ${filters.radiusMiles} mi of you`
    : (filters.neighborhood ?? filters.borough)

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onHome}
          className="flex items-center gap-1.5 text-sm uppercase tracking-wide text-muted transition hover:text-accent hover:underline"
        >
          <Ico name="back" className="h-4 w-4" /> Home
        </button>
        <button
          onClick={onEdit}
          className="rounded-full border border-line px-4 py-1.5 text-sm uppercase tracking-wide text-black transition hover:border-accent hover:text-accent"
        >
          Edit journey
        </button>
      </div>

      <p className="eyebrow">{where ? `Results · ${where}` : 'Results · all of New York'}</p>
      <h1 className="display mt-1 text-6xl">
        {ranked.length} match{ranked.length === 1 ? '' : 'es'}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Dial in the details, or clear a chip to widen the search.
      </p>

      <div className="mt-5 border-y border-line py-4">
        <RefineBar f={filters} onChange={onChange} neighborhoodsByBorough={neighborhoodsByBorough} />
        <FilterChips f={filters} onChange={onChange} />
      </div>

      {ranked.length === 0 ? (
        <div className="mt-12 rounded-[40px] border border-dashed border-line p-12 text-center">
          <p className="uppercase tracking-wide text-black">Nothing matched every filter.</p>
          <p className="mt-1 text-sm text-muted">
            {filters.userLoc
              ? 'Try a wider radius, or clear a filter above.'
              : 'Clear a filter above to widen the search.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ranked.map((p) => (
            <ProductCard key={p.id} p={p} userLoc={filters.userLoc} onAdd={onAdd} />
          ))}
        </div>
      )}

      <div className="mt-12">
        <Newsletter source="results" />
      </div>
    </div>
  )
}
