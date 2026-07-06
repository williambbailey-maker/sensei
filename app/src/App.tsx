import { useEffect, useMemo, useState } from 'react'
import { AgeGate, useAgeGate } from './components/AgeGate'
import { Hero } from './components/Hero'
import { TapJourney } from './components/TapJourney'
import { Results } from './components/Results'
import { Deals } from './components/Deals'
import { Newsletter } from './components/Newsletter'
import { fetchDeals, fetchProducts } from './lib/supabase'
import { parseQuery } from './lib/parser'
import {
  EMPTY_FILTERS,
  hasLocation,
  locationOf,
  type Deal,
  type Filters,
  type Product,
  type Vibe,
} from './lib/types'

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

  // Which neighborhoods actually have in-stock product, per borough — drives
  // the drill-down chips and selects.
  const neighborhoodsByBorough = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    for (const p of products) {
      const s = p.store
      if (!p.in_stock || !s?.borough || !s.neighborhood) continue
      ;(map[s.borough] ??= new Set()).add(s.neighborhood)
    }
    return Object.fromEntries(Object.entries(map).map(([b, set]) => [b, [...set].sort()]))
  }, [products])

  // Location is the primary qualifier: set on the home screen, it persists
  // through search, vibe taps, quick filters, and the journey.
  const setLocation = (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch }))

  const search = (text: string) => {
    const parsed = parseQuery(text)
    // A location typed into the search wins; otherwise keep the chosen one.
    setFilters({ ...parsed, ...(parsed.borough ? {} : locationOf(filters)) })
    go('results')
  }
  const quickVibe = (v: Vibe) => {
    setFilters({ ...EMPTY_FILTERS, ...locationOf(filters), vibes: [v] })
    go('results')
  }
  // Jump straight to results with an objective filter applied (format, price, …).
  const quickFilter = (patch: Partial<Filters>) => {
    setFilters({ ...EMPTY_FILTERS, ...locationOf(filters), ...patch })
    go('results')
  }

  return (
    <div className="min-h-full">
      {!ageOk && <AgeGate onConfirm={confirmAge} />}

      <header className="sticky top-0 z-30 border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button
            onClick={() => {
              setFilters(EMPTY_FILTERS)
              go('home')
            }}
            className="display text-lg transition hover:opacity-70"
          >
            sensei
          </button>
          <span
            className={`hidden text-[13px] uppercase tracking-label sm:block ${
              hasLocation(filters) ? 'font-bold text-accent' : 'text-black'
            }`}
          >
            {hasLocation(filters)
              ? `◉ ${
                  filters.userLoc
                    ? `Near me${filters.radiusMiles != null ? ` · ${filters.radiusMiles} mi` : ''}`
                    : (filters.neighborhood ?? filters.borough)
                }`
              : 'New York · Cannabis'}
          </span>
          <span className="text-[13px] uppercase tracking-label text-muted">21+</span>
        </div>
      </header>

      {loadError && (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div className="rounded-full border border-clay/40 bg-clay/10 px-5 py-2.5 text-sm uppercase tracking-wide text-clay">
            Couldn't reach the menu right now. Check your connection and refresh.
          </div>
        </div>
      )}

      {view === 'home' && (
        <main>
          <Hero
            filters={filters}
            products={products}
            neighborhoodsByBorough={neighborhoodsByBorough}
            onLocation={setLocation}
            onSearch={search}
            onVibe={quickVibe}
            onBrowse={() => go('journey')}
            onQuick={quickFilter}
          />
          {/* Deals earn their place once the user has said where they are. */}
          {hasLocation(filters) && <Deals deals={deals} />}
          <div className="pb-16" />
        </main>
      )}

      {view === 'journey' && (
        <main>
          <TapJourney
            initial={filters}
            neighborhoodsByBorough={neighborhoodsByBorough}
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
            neighborhoodsByBorough={neighborhoodsByBorough}
            onChange={setFilters}
            onHome={() => go('home')}
            onEdit={() => go('journey')}
          />
        </main>
      )}

      <footer className="mt-16 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-12">
          <p className="display text-3xl">sensei</p>
          <div className="w-full max-w-md">
            <p className="eyebrow mb-2 text-center">The weekly drop — deals, once a week</p>
            <Newsletter source="footer" compact />
          </div>
          <div className="flex flex-col items-center gap-2 text-[12px] uppercase tracking-label text-muted sm:flex-row sm:gap-8">
            <p>Every New York menu, one place</p>
            <p>21+ only · Adults in New York State</p>
            <p className="text-muted/60">v{__BUILD_ID__}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
