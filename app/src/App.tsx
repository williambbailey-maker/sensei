import { useEffect, useMemo, useState } from 'react'
import { AgeGate, useAgeGate } from './components/AgeGate'
import { CartView } from './components/CartView'
import { IntroSlice } from './components/IntroSlice'
import { Masthead } from './components/Masthead'
import { PinnedWay, Ways, type Way } from './components/Ways'
import { requestLocation } from './lib/geo'
import { SmartSearch } from './components/SmartSearch'
import { TapJourney } from './components/TapJourney'
import { Results } from './components/Results'
import { Deals } from './components/Deals'
import { Newsletter } from './components/Newsletter'
import { fetchDeals, fetchProductsFor, fetchStores } from './lib/supabase'
import { prettyStore } from './lib/labels'
import { track } from './lib/analytics'
import {
  EMPTY_FILTERS,
  filtersFromQuery,
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
  // True while the products for the current filter set are being fetched, so
  // the results screen can say "loading" instead of a false "nothing matched".
  const [loading, setLoading] = useState(true)
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
    fetchStores().then(setStores).catch(() => {})
    fetchDeals().then(setDeals).catch(() => {})
  }, [])

  // Deep links from the SEO pages (/?brand=… /?store=… /?neighborhood=…
  // /?category=…) skip the journey and open results with those filters set.
  // Resolved once the stores list is in, since store and neighborhood hints
  // are matched against it.
  const [deepLinked, setDeepLinked] = useState(false)
  useEffect(() => {
    if (deepLinked || stores.length === 0) return
    setDeepLinked(true)
    // /?entry=near|borough|search|all — the SEO home's "Start here" rows.
    const entry = new URLSearchParams(window.location.search).get('entry')
    if (entry === 'near' || entry === 'borough' || entry === 'search' || entry === 'all') {
      pickWay(entry)
      return
    }
    const f = filtersFromQuery(window.location.search, stores)
    if (!f) return
    setFilters(f)
    setView('results')
    track('deep_link', {
      brand: f.brand,
      dispensary: f.storeName ?? f.store,
      neighborhood: f.neighborhood,
      category: f.format,
    })
  }, [stores, deepLinked])

  // Fetch only the products this filter set can match — when results are
  // requested or refined — instead of the whole catalog up front. Waits for
  // the (tiny) stores list, which scopes the query by location.
  useEffect(() => {
    if (view !== 'results' || stores.length === 0) return
    let live = true
    setLoading(true)
    fetchProductsFor(filters, stores)
      .then((rows) => {
        if (live) setProducts(rows)
      })
      .catch(() => {
        if (live) setLoadError(true)
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [view, filters, stores])

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

  // Store counts drive the captions on the location steps.
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

  // Which of the four ways in was picked. null = the home screen (masthead +
  // the "Start here" block); 'borough' and 'search' open the journey screen
  // with that row pinned; 'near' and 'all' go straight to results.
  const [way, setWay] = useState<Way | null>(null)
  const [locating, setLocating] = useState(false)
  const [wayError, setWayError] = useState('')
  const pickWay = (w: Way) => {
    setWayError('')
    track('journey_step', { step: 'entry', entry: w })
    if (w === 'near') {
      setLocating(true)
      requestLocation(
        (loc) => {
          setLocating(false)
          setFilters({ ...EMPTY_FILTERS, userLoc: loc, radiusMiles: null, sort: 'distance' })
          go('results')
        },
        (msg) => {
          setLocating(false)
          setWayError(msg)
        },
      )
      return
    }
    if (w === 'all') {
      setFilters({ ...EMPTY_FILTERS, sort: 'price-asc' })
      go('results')
      return
    }
    setWay(w)
    setJourneyKey((k) => k + 1)
    go('journey')
  }

  // Start a fresh journey from the top.
  const restart = () => {
    setFilters(EMPTY_FILTERS)
    setWay(null)
    setWayError('')
    setJourneyKey((k) => k + 1)
    go('journey')
  }

  const storeCount = stores.length > 0 ? stores.length : null
  const boroughTotal = stores.length > 0 ? Object.keys(boroughCounts).length : null
  const hoodTotal = stores.length > 0 ? Object.keys(neighborhoodCounts).length : null
  const home = view === 'journey' && way === null

  return (
    <div className="min-h-full">
      <IntroSlice />
      {!ageOk && <AgeGate onConfirm={confirmAge} />}

      {/* Header: burger left, the name center (the masthead carries it on the
          journey view), an 18px spacer right so the name stays centered. */}
      <header className="sticky top-0 z-40 bg-field">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 pb-2 pt-8">
          <button type="button" onClick={restart} className="burger" aria-label="Home" />
          <span className={`label ${home ? 'invisible' : ''}`}>Sensei</span>
          <span className="w-[18px]" aria-hidden="true" />
        </div>
      </header>

      {cart && view !== 'cart' && (
        <div className="mx-auto max-w-2xl px-6">
          <div className="row">
            <span className="meta min-w-0 truncate">
              Building a cart · {cart.store.name ?? prettyStore(cart.store.slug)} · this store only
            </span>
            <span className="flex shrink-0 items-center gap-4">
              <button type="button" onClick={() => go('cart')} className="ghost">
                View · {cartCount}
              </button>
              <button type="button" onClick={clearCart} className="ghost">
                Clear
              </button>
            </span>
          </div>
        </div>
      )}

      {loadError && (
        <div className="mx-auto max-w-2xl px-6 pt-4">
          <p className="meta text-ink">Couldn't reach the menu right now. Check your connection and refresh.</p>
        </div>
      )}

      {home && (
        <main>
          <Masthead storeCount={storeCount} boroughs={boroughTotal} neighborhoods={hoodTotal} />
          <Ways onPick={pickWay} busy={locating ? 'near' : null} error={wayError} />
        </main>
      )}

      {view === 'journey' && way !== null && (
        <main>
          <PinnedWay
            way={way}
            next={way === 'search' ? 'Then refine on the results screen' : 'Then neighborhood · product · strain · budget'}
          />
          {way === 'search' && (
            <SmartSearch
              autoFocus
              neighborhoodsByBorough={neighborhoodsByBorough}
              onSearch={(f) => {
                setFilters(f)
                go('results')
              }}
            />
          )}
          {way === 'search' && (
            <div className="rule mt-10">
              <span>Or</span>
            </div>
          )}
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
          {way === 'borough' && (
            <>
              <div className="rule">
                <span>Or</span>
              </div>
              <SmartSearch
                neighborhoodsByBorough={neighborhoodsByBorough}
                onSearch={(f) => {
                  setFilters(f)
                  go('results')
                }}
              />
            </>
          )}
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
            loading={loading}
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
          type="button"
          onClick={() => go('cart')}
          className="label fixed bottom-7 left-1/2 z-40 -translate-x-1/2 border-2 border-ink bg-field px-6 py-2.5 transition active:translate-y-px"
        >
          Cart · {cartCount} · ${cartTotal.toFixed(2).replace(/\.00$/, '')}
        </button>
      )}

      <footer className="mt-16 border-t-2 border-line">
        <div className="mx-auto max-w-2xl px-6 py-12 text-center">
          <p className="poster">Sensei.nyc</p>
          <p className="label mt-4 text-mist">
            Every licensed dispensary menu, one place. Compare price, potency and pickup, then order where it's right.
          </p>
          <p className="meta mt-4">21+ only · adults in New York State</p>
          <div className="mt-8">
            <Newsletter source="footer" compact />
          </div>
          <p className="mt-8 text-[10px] font-semibold text-[rgba(20,20,20,.31)]">Build {__BUILD_ID__}</p>
        </div>
      </footer>
    </div>
  )
}
