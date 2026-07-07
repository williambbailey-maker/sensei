import { useEffect, useMemo, useState } from 'react'
import { AgeGate, useAgeGate } from './components/AgeGate'
import { CartView } from './components/CartView'
import { Hero } from './components/Hero'
import { Nav, type NavAction } from './components/Nav'
import { TapJourney } from './components/TapJourney'
import { Results } from './components/Results'
import { Deals } from './components/Deals'
import { Newsletter } from './components/Newsletter'
import { Preloader, useLenis } from './components/motion'
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
  useLenis()
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

  const goHome = () => {
    setFilters(EMPTY_FILTERS)
    go('home')
  }

  const locationLabel = hasLocation(filters)
    ? filters.userLoc
      ? `Near me${filters.radiusMiles != null ? ` · ${filters.radiusMiles} mi` : ''}`
      : (filters.neighborhood ?? filters.borough ?? '')
    : null

  const navActions: NavAction[] = [
    { label: 'Home', sub: 'Start over', onClick: goHome },
    { label: 'Browse', sub: 'Every menu', onClick: () => quickFilter({}) },
    { label: 'Journey', sub: 'Guided', onClick: () => go('journey') },
    ...(cartCount > 0
      ? [{ label: 'Cart', sub: `${cartCount} item${cartCount === 1 ? '' : 's'}`, onClick: () => go('cart') } as NavAction]
      : []),
  ]

  return (
    <div className="min-h-full">
      <Preloader />
      {!ageOk && <AgeGate onConfirm={confirmAge} />}

      <header className="sticky top-0 z-50 border-b border-hairline bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-[clamp(24px,6vw,120px)] py-4">
          <button onClick={goHome} className="flex items-center gap-2.5 transition hover:opacity-80">
            <span className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-accent font-display text-[15px] leading-none text-paper">
              先
            </span>
            <span className="display text-[22px] leading-none">sensei</span>
          </button>
          <Nav locationLabel={locationLabel} actions={navActions} />
        </div>
      </header>

      {cart && view !== 'cart' && (
        <div className="mx-auto max-w-[1240px] px-[clamp(24px,6vw,120px)] pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
            <span className="font-grotesk text-[0.72rem] uppercase tracking-label text-accent">
              Building a cart · {cart.store.name ?? prettyStore(cart.store.slug)} — this store only
            </span>
            <span className="flex items-center gap-4">
              <button
                onClick={() => go('cart')}
                className="font-grotesk text-[0.72rem] uppercase tracking-label text-ink transition hover:text-accent"
              >
                View cart · {cartCount}
              </button>
              <button
                onClick={clearCart}
                className="font-grotesk text-[0.72rem] uppercase tracking-label text-ink-soft transition hover:text-accent"
              >
                Clear
              </button>
            </span>
          </div>
        </div>
      )}

      {loadError && (
        <div className="mx-auto max-w-[1240px] px-[clamp(24px,6vw,120px)] pt-5">
          <div className="border-l-2 border-accent bg-paper-2 px-5 py-3 text-sm text-ink-soft">
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
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 bg-accent px-6 py-3.5 font-grotesk text-[0.72rem] uppercase tracking-label text-paper transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent-soft"
        >
          Cart · {cartCount} · ${cartTotal.toFixed(2).replace(/\.00$/, '')}
        </button>
      )}

      <footer className="mt-[clamp(10vh,14vh,200px)] border-t border-hairline bg-paper-2">
        <div className="mx-auto grid max-w-[1240px] gap-12 px-[clamp(24px,6vw,120px)] py-[clamp(10vh,12vh,160px)] sm:grid-cols-[1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-accent font-display text-[15px] leading-none text-paper">
                先
              </span>
              <span className="display text-2xl">sensei</span>
            </div>
            <p className="prose-jp mt-5 max-w-measure">
              Every licensed dispensary menu, one calm place. Compare price, potency and pickup —
              then order where it's right.
            </p>
            <p className="mt-8 font-grotesk text-[0.72rem] uppercase tracking-label text-ink-soft">
              21+ only · Adults in New York State
            </p>
            <p className="mt-1 font-grotesk text-[0.72rem] uppercase tracking-label text-ink-soft/70">
              v{__BUILD_ID__}
            </p>
          </div>
          <div className="sm:pl-8">
            <p className="eyebrow">The weekly drop</p>
            <p className="prose-jp mt-3">Deals and standouts, once a week. No spam.</p>
            <div className="mt-5">
              <Newsletter source="footer" compact />
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
