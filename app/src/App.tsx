import { useEffect, useMemo, useState } from 'react'
import { AgeGate, useAgeGate } from './components/AgeGate'
import { CartView } from './components/CartView'
import { Masthead } from './components/Masthead'
import { Ways, type Way } from './components/Ways'
import { Menu, type MenuTarget } from './components/Menu'
import { requestLocation } from './lib/geo'
import { SmartSearch } from './components/SmartSearch'
import { TapJourney } from './components/TapJourney'
import { Results } from './components/Results'
import { Deals } from './components/Deals'
import { Newsletter } from './components/Newsletter'
import { fetchDeals, fetchProductCount, fetchProductsFor, fetchStores } from './lib/supabase'
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
  const [productCount, setProductCount] = useState<number | null>(null)
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
    fetchProductCount().then(setProductCount).catch(() => {})
  }, [])

  // Deep links from the SEO pages (/?brand=… /?store=… /?neighborhood=…
  // /?category=… /?entry=… /?near=1) skip the journey and open results with
  // those filters set. Resolved once the stores list is in, since store and
  // neighborhood hints are matched against it.
  const [deepLinked, setDeepLinked] = useState(false)
  useEffect(() => {
    if (deepLinked || stores.length === 0) return
    setDeepLinked(true)
    const q = new URLSearchParams(window.location.search)
    const entry = q.get('near') === '1' ? 'near' : q.get('entry')
    if (
      entry === 'near' ||
      entry === 'borough' ||
      entry === 'search' ||
      entry === 'all' ||
      entry === 'deals' ||
      entry === 'cart'
    ) {
      goTo(entry)
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

  // /#drop (the SEO menu's "weekly drop" row) lands on the footer sign-up.
  useEffect(() => {
    if (window.location.hash !== '#drop') return
    const t = setTimeout(() => document.getElementById('drop')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400)
    return () => clearTimeout(t)
  }, [])

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

  // The ways in. "Near me" asks for location and opens results closest
  // first; "Pick a borough" scrolls to the journey; "Search" focuses the
  // search field; "See everything" opens results, all, cheapest first.
  const [locating, setLocating] = useState(false)
  const [wayError, setWayError] = useState('')
  const scrollTo = (id: string, focus = false) =>
    requestAnimationFrame(() => {
      const el = document.getElementById(id)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      if (focus) (document.getElementById('search-input') as HTMLInputElement | null)?.focus()
    })
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
    if (view !== 'journey') {
      setFilters(EMPTY_FILTERS)
      setJourneyKey((k) => k + 1)
      go('journey')
    }
    setTimeout(() => scrollTo(w === 'search' ? 'search' : 'journey', w === 'search'), 50)
  }

  // Start a fresh journey from the top.
  const restart = () => {
    setFilters(EMPTY_FILTERS)
    setWayError('')
    setJourneyKey((k) => k + 1)
    go('journey')
  }

  // The menu. Deals = results (all, cheapest first) scrolled to the deals
  // section once the list has loaded; Cart = the cart, or home if empty.
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingScroll, setPendingScroll] = useState<string | null>(null)
  const goTo = (t: MenuTarget) => {
    if (t === 'deals') {
      setFilters({ ...EMPTY_FILTERS, sort: 'price-asc' })
      setPendingScroll('deals')
      go('results')
      return
    }
    if (t === 'cart') {
      if (cart) go('cart')
      else restart()
      return
    }
    pickWay(t)
  }
  useEffect(() => {
    if (!pendingScroll || view !== 'results' || loading) return
    const id = pendingScroll
    setPendingScroll(null)
    scrollTo(id)
  }, [pendingScroll, view, loading])
  const currentItem: MenuTarget | null = view === 'cart' ? 'cart' : null

  const storeCount = stores.length > 0 ? stores.length : null
  const hoodTotal = stores.length > 0 ? Object.keys(neighborhoodCounts).length : null

  return (
    <div className="min-h-full">
      {!ageOk && <AgeGate onConfirm={confirmAge} />}

      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        current={currentItem}
        storeCount={storeCount}
        hoodCount={hoodTotal}
        cart={cart}
        onGo={goTo}
      />

      {/* "Sensei" left, "Menu" right, a hairline under. Scrolls with the page. */}
      <header className="wrap">
        <div className="top">
          <button type="button" onClick={restart} className="wm">
            Sensei
          </button>
          <button
            type="button"
            onClick={() => {
              track('menu_open', {})
              setMenuOpen(true)
            }}
            className="mnu"
            aria-label="Menu"
          >
            <span className="burger" />
            Menu
          </button>
        </div>
      </header>

      {cart && view !== 'cart' && (
        <div className="wrap">
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
        <div className="wrap pt-4">
          <p className="meta text-ink">Couldn't reach the menu right now. Check your connection and refresh.</p>
        </div>
      )}

      {view === 'journey' && (
        <main>
          <Masthead storeCount={storeCount} productCount={productCount} neighborhoods={hoodTotal} />
          <Ways onPick={pickWay} busy={locating ? 'near' : null} error={wayError} />
          <SmartSearch
            neighborhoodsByBorough={neighborhoodsByBorough}
            onSearch={(f) => {
              setFilters(f)
              go('results')
            }}
          />
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
            loading={loading}
          />
          <Deals deals={deals} />
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
          className="label fixed bottom-7 left-1/2 z-30 -translate-x-1/2 border-2 border-ink bg-field px-6 py-2.5"
        >
          Cart · {cartCount} · ${cartTotal.toFixed(2).replace(/\.00$/, '')}
        </button>
      )}

      <footer className="wrap" style={{ paddingBottom: 60 }}>
        <div className="exit">
          <button type="button" onClick={restart}>
            ↑ Exit to menus
          </button>
          <span className="dim">Updated nightly</span>
        </div>
        <div id="drop" style={{ marginTop: 34 }}>
          <Newsletter source="footer" compact />
        </div>
        <p className="foot">
          <b>Sensei</b> is a guide for adults 21 and over in New York State. We list licensed retailers only, link to
          each dispensary's own menu, and do not sell cannabis. Brands may advertise on Sensei; they may not change
          the order of results.
          <br />
          <br />
          sensei.nyc · hello@sensei.nyc
        </p>
        <p className="meta" style={{ marginTop: 18, fontSize: 11 }}>
          Build {__BUILD_ID__}
        </p>
      </footer>
    </div>
  )
}
