import { useEffect, useMemo, useState } from 'react'
import { AgeGate, useAgeGate } from './components/AgeGate'
import { Hero } from './components/Hero'
import { TapJourney } from './components/TapJourney'
import { Results } from './components/Results'
import { Deals } from './components/Deals'
import { Newsletter } from './components/Newsletter'
import { fetchDeals, fetchProducts } from './lib/supabase'
import { parseQuery } from './lib/parser'
import { EMPTY_FILTERS, type Deal, type Filters, type Product, type Vibe } from './lib/types'

type View = 'home' | 'journey' | 'results'

export default function App() {
  const [ageOk, confirmAge] = useAgeGate()
  const [view, setView] = useState<View>('home')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [products, setProducts] = useState<Product[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    fetchProducts().then(setProducts).catch(() => setLoadError(true))
    fetchDeals().then(setDeals).catch(() => {})
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view])

  const go = (v: View) => setView(v)

  const boroughs = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) if (p.in_stock && p.store?.borough) set.add(p.store.borough)
    return [...set].sort()
  }, [products])

  const search = (text: string) => {
    setFilters(parseQuery(text))
    go('results')
  }
  const quickVibe = (v: Vibe) => {
    setFilters({ ...EMPTY_FILTERS, vibes: [v] })
    go('results')
  }
  // Jump straight to results with an objective filter applied (borough, price, …).
  const quickFilter = (patch: Partial<Filters>) => {
    setFilters({ ...EMPTY_FILTERS, ...patch })
    go('results')
  }

  return (
    <div className="min-h-full">
      {!ageOk && <AgeGate onConfirm={confirmAge} />}

      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <button
            onClick={() => {
              setFilters(EMPTY_FILTERS)
              go('home')
            }}
            className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight text-stone-900"
          >
            <span className="grid grid-cols-2 gap-px" aria-hidden="true">
              <span className="h-2 w-2 bg-clay" />
              <span className="h-2 w-2 bg-sand" />
              <span className="h-2 w-2 bg-slate" />
              <span className="h-2 w-2 bg-accent" />
            </span>
            Sensei
          </button>
          <span className="eyebrow">New York</span>
        </div>
      </header>

      {loadError && (
        <div className="mx-auto max-w-5xl px-6 pt-4">
          <div className="border border-clay/40 bg-clay/10 px-4 py-2.5 text-sm text-clay">
            Couldn't reach the menu right now. Check your connection and refresh.
          </div>
        </div>
      )}

      {view === 'home' && (
        <main>
          <Hero
            onSearch={search}
            onVibe={quickVibe}
            onBrowse={() => go('journey')}
            onQuick={quickFilter}
            boroughs={boroughs}
          />
          <Deals deals={deals} />
          <section className="mx-auto max-w-5xl px-6 pb-20 pt-4">
            <Newsletter source="home" />
          </section>
        </main>
      )}

      {view === 'journey' && (
        <main>
          <TapJourney
            initial={filters}
            boroughs={boroughs}
            onDone={(f) => {
              setFilters(f)
              go('results')
            }}
            onClose={() => go('home')}
          />
        </main>
      )}

      {view === 'results' && (
        <main>
          <Results
            products={products}
            filters={filters}
            onChange={setFilters}
            onHome={() => go('home')}
            onEdit={() => go('journey')}
          />
        </main>
      )}

      <footer className="mt-8 border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-10 text-xs text-stone-500">
          <p className="text-stone-700">Sensei — New York cannabis, considered.</p>
          <p>21+ only · For use only by adults in New York State.</p>
        </div>
      </footer>
    </div>
  )
}
