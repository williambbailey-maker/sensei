import { useEffect, useState } from 'react'
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

  const search = (text: string) => {
    setFilters(parseQuery(text))
    go('results')
  }
  const quickVibe = (v: Vibe) => {
    setFilters({ ...EMPTY_FILTERS, vibes: [v] })
    go('results')
  }

  return (
    <div className="min-h-full">
      {!ageOk && <AgeGate onConfirm={confirmAge} />}

      <header className="sticky top-0 z-30 border-b border-ink-line/60 bg-ink/70 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3.5">
          <button
            onClick={() => {
              setFilters(EMPTY_FILTERS)
              go('home')
            }}
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-sm text-accent">
              先
            </span>
            Sensei
          </button>
          <span className="text-xs text-zinc-500">NYC</span>
        </div>
      </header>

      {loadError && (
        <div className="mx-auto max-w-2xl px-5 pt-4">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
            Couldn't reach the menu right now. Check your connection and refresh.
          </div>
        </div>
      )}

      {view === 'home' && (
        <main>
          <Hero onSearch={search} onVibe={quickVibe} onBrowse={() => go('journey')} />
          <Deals deals={deals} />
          <section className="mx-auto max-w-2xl px-5 pb-16">
            <Newsletter source="home" />
          </section>
        </main>
      )}

      {view === 'journey' && (
        <main>
          <TapJourney
            initial={filters}
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

      <footer className="border-t border-ink-line/60 py-8 text-center text-xs text-zinc-600">
        <p>Sensei · NYC cannabis, matched to your vibe</p>
        <p className="mt-1">21+ only · For use only by adults in New York State</p>
      </footer>
    </div>
  )
}
