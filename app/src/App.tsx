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

      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <button
            onClick={() => {
              setFilters(EMPTY_FILTERS)
              go('home')
            }}
            className="display text-xl text-black transition hover:text-accent"
          >
            Sensei
          </button>
          <span className="display text-base text-black">#NewYorkCannabis</span>
          <span className="hidden text-sm text-black/50 sm:block">21+</span>
        </div>
      </header>

      {loadError && (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div className="rounded-full border border-clay/40 bg-clay/10 px-5 py-2.5 text-sm text-clay">
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
          <section className="mx-auto max-w-6xl px-6 pb-20 pt-4">
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

      <footer className="mt-10 overflow-hidden bg-black">
        <div className="mx-auto max-w-6xl px-6 pb-8 pt-12">
          <p className="display text-center text-[17vw] leading-[0.9] text-sand sm:text-8xl lg:text-9xl">
            Sensei
          </p>
          <div className="mt-8 flex flex-col items-center gap-1 text-xs text-paper/70 sm:flex-row sm:justify-between">
            <p>Sensei — every New York menu, one place.</p>
            <p>21+ only · For use only by adults in New York State.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
