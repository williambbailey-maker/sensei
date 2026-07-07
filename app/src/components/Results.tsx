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
    <div className="mx-auto max-w-[1240px] px-[clamp(24px,6vw,120px)] py-[clamp(5vh,8vh,100px)]">
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={onHome}
          className="group inline-flex items-center gap-1.5 font-grotesk text-[0.72rem] uppercase tracking-label text-ink-soft transition-colors hover:text-accent"
        >
          <Ico name="back" className="h-4 w-4" /> Home
        </button>
        <button
          onClick={onEdit}
          className="link-underline font-grotesk text-[0.72rem] uppercase tracking-label text-ink"
        >
          Edit journey
        </button>
      </div>

      <p className="eyebrow">{where ? `Results · ${where}` : 'Results · all of New York'}</p>
      <h1 className="display mt-3 text-[clamp(2.5rem,7vw,5rem)] leading-none">
        {ranked.length} match{ranked.length === 1 ? '' : 'es'}
      </h1>
      <p className="prose-jp mt-3">Dial in the details, or clear a chip to widen the search.</p>

      <div className="mt-6 border-y border-hairline py-5">
        <RefineBar f={filters} onChange={onChange} neighborhoodsByBorough={neighborhoodsByBorough} />
        <FilterChips f={filters} onChange={onChange} />
      </div>

      {ranked.length === 0 ? (
        <div className="mt-16 border border-dashed border-hairline p-12 text-center">
          <p className="display text-2xl text-ink">Nothing matched every filter.</p>
          <p className="prose-jp mt-2">
            {filters.userLoc
              ? 'Try a wider radius, or clear a filter above.'
              : 'Clear a filter above to widen the search.'}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ranked.map((p) => (
            <ProductCard key={p.id} p={p} userLoc={filters.userLoc} onAdd={onAdd} />
          ))}
        </div>
      )}

      <div className="mt-[clamp(8vh,10vh,140px)]">
        <Newsletter source="results" />
      </div>
    </div>
  )
}
