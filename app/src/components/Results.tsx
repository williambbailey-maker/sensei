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
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={onHome}
          className="flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white"
        >
          <Ico name="back" className="h-4 w-4" /> Home
        </button>
        <button
          onClick={onEdit}
          className="rounded-lg border border-ink-line px-3 py-1.5 text-sm text-zinc-300 transition hover:border-accent/50 hover:text-white"
        >
          Edit journey
        </button>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight">
        {ranked.length} match{ranked.length === 1 ? '' : 'es'}
      </h1>
      <p className="mt-1 text-sm text-zinc-400">Dial in the details, or tap a chip to loosen a filter.</p>

      <div className="mt-4">
        <RefineBar f={filters} onChange={onChange} boroughs={boroughs} />
      </div>

      <div className="mt-3">
        <FilterChips f={filters} onChange={onChange} />
      </div>

      {ranked.length === 0 ? (
        <div className="mt-10 rounded-xl2 border border-dashed border-ink-line p-10 text-center">
          <p className="text-zinc-300">Nothing matched every filter.</p>
          <p className="mt-1 text-sm text-zinc-500">Remove a chip above to widen the search.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {ranked.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}

      <div className="mt-10">
        <Newsletter source="results" />
      </div>
    </div>
  )
}
