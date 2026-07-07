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

  const neighborhoodsByBorough = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    for (const st of stores) {
      if (!st.borough || !st.neighborhood) continue
      ;(map[st.borough] ??= new Set()).add(st.neighborhood)
    }
    return Object.fromEntries(Object.entries(map).map(([b, set]) => [b, [...set].sort()]))
  }, [stores])

  const setLocation = (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch }))

  const search = (text: string) => {
    const parsed = parseQuery(text)
    setFilters({ ...parsed, ...(parsed.borough ? {} : locationOf(filters)) })
    go('results')
  }
  const quickVibe = (v: Vibe) => {
    setFilters({ ...EMPTY_FILTERS, ...locationOf(filters), vibes: [v] })
    go('results')
  }
  const quickFilter = (patch: Partial<Filters>) => {
    setFilters({ ...EMPTY_FILTERS, ...locationOf(filters), ...patch })
    go('results')
  }

  const goHome = () => {
    setFilters(EMPTY_FILTERS)
    go('home')
  }


  return (
    <div className="min-h-full">
      {!ageOk && <AgeGate onConfirm={confirmAge} />}

      <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center px-5 py-2.5 sm:px-6">
          <button onClick={goHome} className="display text-[35px] leading-none text-cobalt transition hover:opacity-80">
            sensei
          </button>
        </div>
      </header>

      {cart && view !== 'cart' && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-3 border-ink bg-sun px-5 py-3 shadow-[4px_4px_0_#384166]">
            <span className="label text-[12px] text-ink">
              Building a cart · {cart.store.name ?? prettyStore(cart.store.slug)} — this store only
            </span>
            <span className="flex items-center gap-2">
              <button
                onClick={() => go('cart')}
                className="rounded-full border-3 border-ink bg-cobalt px-4 py-1.5 label text-[12px] text-white transition hover:bg-cobalt-deep"
              >
                View · {cartCount}
              </button>
              <button
                onClick={clearCart}
                className="rounded-full border-3 border-ink bg-panel px-4 py-1.5 label text-[12px] text-ink transition hover:bg-ice"
              >
                Clear
              </button>
            </span>
          </div>
        </div>
      )}

      {loadError && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <div className="rounded-2xl border-3 border-ink bg-tomato px-5 py-3 label text-[12px] text-white">
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

      {cartCount > 0 && view !== 'cart' && (
        <button
          onClick={() => go('cart')}
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border-3 border-ink bg-magenta px-6 py-3.5 label text-[13px] text-white shadow-[4px_4px_0_#384166] transition hover:-translate-y-0.5"
        >
          Cart · {cartCount} · ${cartTotal.toFixed(2).replace(/\.00$/, '')}
        </button>
      )}

      <footer className="mt-16 border-t-3 border-ink bg-cobalt text-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 sm:grid-cols-[1fr_1fr]">
            <div>
              <div className="flex items-center">
                <span className="display text-3xl">sensei</span>
              </div>
              <p className="mt-4 max-w-sm text-[15px] font-medium leading-relaxed text-white/85">
                Every licensed dispensary menu, one place. Compare price, potency and pickup — then
                order where it's right.
              </p>
              <p className="label mt-6 text-[12px] text-white/70">
                21+ only · Adults in New York State
              </p>
            </div>
            <div className="sm:pl-6">
              <p className="display text-2xl text-sun">The weekly drop</p>
              <p className="mt-2 text-sm font-medium text-white/80">
                Deals and standouts, once a week. No spam.
              </p>
              <div className="mt-4">
                <Newsletter source="footer" compact />
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
