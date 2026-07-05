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
  onChange,
  onHome,
  onEdit,
}: {
  products: Product[]
  filters: Filters
  onChange: (f: Filters) => void
  onHome: () => void
  onEdit: () => void
}) {
  const ranked = useMemo(() => rankProducts(products, filters), [products, filters])
  // Boroughs that actually have in-stock products, so the filter never offers an
  // empty option.
  const boroughs = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) if (p.in_stock && p.store?.borough) set.add(p.store.borough)
    return [...set].sort()
  }, [products])

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onHome}
          className="flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-900"
        >
          <Ico name="back" className="h-4 w-4" /> Home
        </button>
        <button
          onClick={onEdit}
          className="border border-line px-3 py-1.5 text-sm text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
        >
          Edit journey
        </button>
      </div>

      <p className="eyebrow">Results</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
        {ranked.length} match{ranked.length === 1 ? '' : 'es'}
      </h1>
      <p className="mt-1 text-sm text-stone-500">
        Dial in the details, or clear a chip to widen the search.
      </p>

      <div className="mt-5 border-y border-line py-4">
        <RefineBar f={filters} onChange={onChange} boroughs={boroughs} />
        <FilterChips f={filters} onChange={onChange} />
      </div>

      {ranked.length === 0 ? (
        <div className="mt-12 border border-dashed border-line p-12 text-center">
          <p className="text-stone-700">Nothing matched every filter.</p>
          <p className="mt-1 text-sm text-stone-500">Clear a filter above to widen the search.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2">
          {ranked.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}

      <div className="mt-12">
        <Newsletter source="results" />
      </div>
    </div>
  )
}
