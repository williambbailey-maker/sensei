import { useEffect, useMemo, useState } from 'react'
import { AgeGate, useAgeGate } from './components/AgeGate'
import { CartView } from './components/CartView'
import { Hero } from './components/Hero'
import { TapJourney } from './components/TapJourney'
import { Results } from './components/Results'
import { Deals } from './components/Deals'
import { Newsletter } from './components/Newsletter'
import { fetchDeals, fetchProducts, fetchStores } from './lib/supabase'
import { parseQuery } from './lib/parser'
import { prettyStore } from './lib/labels'
import {
  EMPTY_FILTERS,
  hasLocation,
  locationOf,
  type Cart,
  type Deal,
  type Filters,
  type Product,
  type StoreLite,
  type Vibe,
} from './lib/types'

type View = 'home' | 'journey' | 'results' | 'cart'

export default function App() {
  const [ageOk, confirmAge] = useAgeGate()
  const [view, setView] = useState<View>('home')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<StoreLite[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loadError, setLoadError] = useState(false)
  // Dummy cart — one store at a time, survives reloads on this device.
  const [cart, setCart] = useState<Cart | null>(() => {
    try {
      const raw = localStorage.getItem('sensei_cart')
      return raw ? (JSON.parse(raw) as Cart) : null
    } catch {
      return null
    }
  })
  useEffect(() => {
    try {
      if (cart) localStorage.setItem('sensei_cart', JSON.stringify(cart))
      else localStorage.removeItem('sensei_cart')
    } catch {
      /* storage unavailable — cart just won't persist */
    }
  }, [cart])

  useEffect(() => {
    fetchProducts().then(setProducts).catch(() => setLoadError(true))
    fetchStores().then(setStores).catch(() => {})
    fetchDeals().then(setDeals).catch(() => {})
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view])

  const go = (v: View) => setView(v)

  // Once the cart holds a product, browsing narrows to that store — you're
  // building one order. Clearing the cart reopens the whole city.
  const scopedProducts = useMemo(
    () => (cart ? products.filter((p) => p.store?.slug === cart.store.slug) : products),
    [products, cart],
  )
  const addToCart = (p: Product) => {
    if (!p.store) return
    setCart((prev) => {
      if (!prev || prev.store.slug !== p.store!.slug)
        return { store: p.store!, items: [{ product: p, qty: 1 }] }
      const exists = prev.items.some((i) => i.product.id === p.id)
      return {
        ...prev,
        items: exists
          ? prev.items.map((i) => (i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i))
          : [...prev.items, { product: p, qty: 1 }],
      }
    })
  }
  const changeQty = (productId: string, delta: number) =>
    setCart((prev) => {
      if (!prev) return prev
      const items = prev.items
        .map((i) => (i.product.id === productId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
      return items.length ? { ...prev, items } : null
    })
  const clearCart = () => setCart(null)
  const cartCount = cart?.items.reduce((n, i) => n + i.qty, 0) ?? 0
  const cartTotal = cart?.items.reduce((s, i) => s + (i.product.price_min ?? 0) * i.qty, 0) ?? 0

  // Neighborhoods per borough come from the stores table itself, so the
  // drill-down never depends on which product rows happened to load.
  const neighborhoodsByBorough = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    for (const st of stores) {
      if (!st.borough || !st.neighborhood) continue
      ;(map[st.borough] ??= new Set()).add(st.neighborhood)
    }
    return Object.fromEntries(Object.entries(map).map(([b, set]) => [b, [...set].sort()]))
  }, [stores])

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

      <header className="halftone sticky top-0 z-30 border-b-2 border-black">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <button
            onClick={() => {
              setFilters(EMPTY_FILTERS)
              go('home')
            }}
            className="display rounded-md border-2 border-black bg-paper px-2.5 py-0.5 text-[28px] leading-none shadow-[2px_2px_0_#111] transition hover:-translate-y-0.5"
          >
            sensei
          </button>
          <span
            className={`hidden text-[13px] uppercase tracking-label sm:block ${
              hasLocation(filters)
                ? 'rounded-md border-2 border-black bg-white px-2.5 py-1 font-bold text-accent'
                : 'text-black'
            }`}
          >
            {hasLocation(filters)
              ? `◉ ${
                  filters.userLoc
                    ? `Near me${filters.radiusMiles != null ? ` · ${filters.radiusMiles} mi` : ''}`
                    : (filters.neighborhood ?? filters.borough)
                }`
              : ''}
          </span>
        </div>
      </header>

      {cart && view !== 'cart' && (
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-full border border-accent/30 bg-accent/5 py-2 pl-5 pr-2">
            <span className="text-[13px] font-bold uppercase tracking-wide text-accent">
              Building a cart at {cart.store.name ?? prettyStore(cart.store.slug)} — showing this
              store only
            </span>
            <span className="flex items-center gap-2">
              <button
                onClick={() => go('cart')}
                className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-bold uppercase tracking-wide text-white transition hover:scale-105"
              >
                View cart · {cartCount}
              </button>
              <button
                onClick={clearCart}
                className="rounded-full border-2 border-black bg-white px-4 py-1.5 text-[13px] uppercase tracking-wide text-black transition hover:bg-clay hover:text-white"
              >
                Clear
              </button>
            </span>
          </div>
        </div>
      )}

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
            products={scopedProducts}
            neighborhoodsByBorough={neighborhoodsByBorough}
            onLocation={setLocation}
            onSearch={search}
            onVibe={quickVibe}
            onBrowse={() => go('journey')}
            onQuick={quickFilter}
            onAdd={addToCart}
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
            products={scopedProducts}
            filters={filters}
            neighborhoodsByBorough={neighborhoodsByBorough}
            onChange={setFilters}
            onHome={() => go('home')}
            onEdit={() => go('journey')}
            onAdd={addToCart}
          />
        </main>
      )}

      {view === 'cart' && cart && (
        <main>
          <CartView
            cart={cart}
            onQty={changeQty}
            onClear={() => {
              clearCart()
              go('results')
            }}
            onBack={() => go('results')}
          />
        </main>
      )}

      {/* Floating cart pill — one tap from anywhere back to the order. */}
      {cartCount > 0 && view !== 'cart' && (
        <button
          onClick={() => go('cart')}
          className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-[0_7px_29px_rgba(0,0,139,0.35)] transition hover:scale-105"
        >
          Cart · {cartCount} · ${cartTotal.toFixed(2).replace(/\.00$/, '')}
        </button>
      )}

      <footer className="mt-16 border-t-4 border-black bg-black text-paper">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-12">
          <p className="display text-3xl text-lemon">sensei</p>
          <div className="w-full max-w-md">
            <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-label text-paper/70">The weekly drop — deals, once a week</p>
            <Newsletter source="footer" compact />
          </div>
          <div className="flex flex-col items-center gap-2 text-[12px] uppercase tracking-label text-paper/60 sm:flex-row sm:gap-8">
            <p>Every New York menu, one place</p>
            <p>21+ only · Adults in New York State</p>
            <p className="text-muted/60">v{__BUILD_ID__}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
