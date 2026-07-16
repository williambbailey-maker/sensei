import { useEffect, useMemo, useState } from 'react'
import { AgeGate, useAgeGate } from './components/AgeGate'
import { CartView } from './components/CartView'
import { IntroSlice } from './components/IntroSlice'
import { TapJourney } from './components/TapJourney'
import { Results } from './components/Results'
import { Deals } from './components/Deals'
import { Newsletter } from './components/Newsletter'
import { fetchDeals, fetchProducts, fetchStores } from './lib/supabase'
import { prettyStore } from './lib/labels'
import {
  EMPTY_FILTERS,
  type Cart,
  type Deal,
  type Filters,
  type Product,
  type StoreLite,
} from './lib/types'

type View = 'journey' | 'results' | 'cart'

export default function App() {
  const [ageOk, confirmAge] = useAgeGate()
  const [view, setView] = useState<View>('journey')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  // Bumped on restart to force the journey to remount at step one, even when
  // we're already on the journey view (e.g. tapping the logo mid-flow).
  const [journeyKey, setJourneyKey] = useState(0)
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

  // Store counts drive the swatch-block captions on the location steps.
  const boroughCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const st of stores) if (st.borough) m[st.borough] = (m[st.borough] ?? 0) + 1
    return m
  }, [stores])
  const neighborhoodCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const st of stores) if (st.neighborhood) m[st.neighborhood] = (m[st.neighborhood] ?? 0) + 1
    return m
  }, [stores])

  // Start a fresh journey from the top.
  const restart = () => {
    setFilters(EMPTY_FILTERS)
    setJourneyKey((k) => k + 1)
    go('journey')
  }

  return (
    <div className="min-h-full">
      <IntroSlice />
      {!ageOk && <AgeGate onConfirm={confirmAge} />}

      {/* Masthead — pinned to the top (never moves on scroll): the cyber-yellow
          wordmark floating over a frosted onyx bar. */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-onyx/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-6">
          <button onClick={restart} className="transition active:scale-95">
            <span className="display text-[64px] font-black leading-[0.9] tracking-tight text-yellow">sensei</span>
          </button>
          <span className="hidden rounded-full border border-white/20 px-4 py-1.5 label text-[10px] text-white/80 sm:inline-block">
            Est. 2026
          </span>
        </div>
      </header>

      {cart && view !== 'cart' && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink bg-panel px-5 py-3 shadow-soft-sm">
            <span className="label text-[12px] text-ink">
              Building a cart · {cart.store.name ?? prettyStore(cart.store.slug)} — this store only
            </span>
            <span className="flex items-center gap-2">
              <button
                onClick={() => go('cart')}
                className="rounded-full bg-yellow px-4 py-1.5 label text-[12px] text-onyx transition hover:bg-sage-deep"
              >
                View · {cartCount}
              </button>
              <button
                onClick={clearCart}
                className="rounded-full border border-line px-4 py-1.5 label text-[12px] text-ink transition hover:bg-ice"
              >
                Clear
              </button>
            </span>
          </div>
        </div>
      )}

      {loadError && (
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <div className="rounded-2xl border border-ink bg-panel px-5 py-3 label text-[12px] text-ink">
            ⚠ Couldn't reach the menu right now. Check your connection and refresh.
          </div>
        </div>
      )}

      {view === 'journey' && (
        <main>
          {/* Liquid hero — a cyber-yellow block that bleeds into the void, with
              a massive black headline. */}
          <div className="px-4 pt-4 sm:px-6">
            <div className="mx-auto max-w-6xl rounded-[40px] rounded-br-[110px] bg-yellow px-7 py-12 sm:px-12 sm:py-16">
              <p className="label text-[11px] text-onyx/70">New York · Cannabis Discovery</p>
              <h1 className="display mt-4 max-w-[15ch] text-[clamp(2.7rem,9vw,5rem)] font-black leading-[0.92] tracking-tight text-onyx">
                Every NYC dispensary, one place.
              </h1>
              <p className="mt-6 max-w-md text-[15px] font-medium leading-relaxed text-onyx/70">
                Compare price, potency &amp; pickup across every licensed NYC dispensary — then order
                where it's right.
              </p>
            </div>
          </div>
          <TapJourney
            key={journeyKey}
            initial={filters}
            neighborhoodsByBorough={neighborhoodsByBorough}
            boroughCounts={boroughCounts}
            neighborhoodCounts={neighborhoodCounts}
            onDone={(f) => {
              setFilters(f)
              go('results')
            }}
            onClose={restart}
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
            onHome={restart}
            onEdit={() => go('journey')}
            onAdd={addToCart}
          />
          <Deals deals={deals} />
          <div className="pb-16" />
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
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-yellow px-6 py-3.5 label text-[12px] text-onyx shadow-soft-lg transition hover:-translate-y-0.5 active:scale-95"
        >
          Cart · {cartCount} · ${cartTotal.toFixed(2).replace(/\.00$/, '')}
        </button>
      )}

      <footer className="mt-16 border-t border-white/10 bg-charcoal text-white">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 sm:grid-cols-[1fr_1fr]">
            <div>
              <div className="flex items-center">
                <span className="display text-2xl font-black text-yellow">sensei</span>
              </div>
              <p className="mt-4 max-w-sm text-[15px] font-medium leading-relaxed text-white/80">
                Every licensed dispensary menu, one place. Compare price, potency and pickup — then
                order where it's right.
              </p>
              <p className="label mt-6 text-[11px] text-white/50">
                21+ only · Adults in New York State
              </p>
              <p className="mt-2 text-[10px] font-medium text-white/30">Build {__BUILD_ID__}</p>
            </div>
            <div className="sm:pl-6">
              <p className="eyebrow text-sage-soft">The weekly drop</p>
              <p className="mt-2 text-sm font-medium text-white/75">
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
