import { useEffect, useMemo, useRef, useState } from 'react'
import { AgeGate, useAgeGate } from './components/AgeGate'
import { CartView } from './components/CartView'
import { Masthead, SenseiBullets } from './components/Masthead'
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
  // first; "Pick a borough" opens the journey screen; "Search" opens the
  // search screen; "See everything" opens results, all, cheapest first.
  // `way` is which of the two screens is showing; null is the home.
  const [way, setWay] = useState<'borough' | 'search' | null>(null)
  const [locating, setLocating] = useState(false)
  const [wayError, setWayError] = useState('')
  const isHome = view === 'journey' && way === null

  // Every screen change starts at the top; the home's "Start here" block is
  // a long way down, and the next screen must not open at that offset.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [view, way])

  // Browser history mirrors the screen, so the back button, and a swipe in
  // from the left edge, step back inside the app instead of leaving the site.
  const cur = useRef({ view, way })
  const lastPop = useRef(0)
  useEffect(() => {
    const prev = cur.current
    cur.current = { view, way }
    if (prev.view === view && prev.way === way) return
    try {
      const s = history.state
      if (!s || s.view === undefined) history.replaceState({ view, way }, '')
      else if (s.view !== view || s.way !== way) history.pushState({ view, way }, '')
    } catch {
      /* history unavailable */
    }
  }, [view, way])
  useEffect(() => {
    try {
      if (!history.state || history.state.view === undefined) history.replaceState({ view: 'journey', way: null }, '')
    } catch {
      /* ignore */
    }
    const onPop = (e: PopStateEvent) => {
      lastPop.current = Date.now()
      const s = e.state
      // Menu and product-detail entries close themselves; only app screens here.
      if (!s || s.view === undefined) return
      if (s.view === cur.current.view && (s.way ?? null) === cur.current.way) return
      cur.current = { view: s.view, way: s.way ?? null }
      setView(s.view)
      setWay(s.way ?? null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swipe in from the left edge = back. Browsers with a native edge gesture
  // fire popstate themselves; if one just did, we stay out of the way.
  const [backHintSeen, setBackHintSeen] = useState(() => {
    try {
      return localStorage.getItem('sensei_back_hint') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    if (isHome) return
    let start: { x: number; y: number } | null = null
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      // Anywhere in the left third of the screen counts as the start zone.
      start = t.clientX <= window.innerWidth / 3 ? { x: t.clientX, y: t.clientY } : null
    }
    const onEnd = (e: TouchEvent) => {
      if (!start) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = Math.abs(t.clientY - start.y)
      start = null
      if (dx < 70 || dx < dy * 1.5) return
      if (Date.now() - lastPop.current < 600) return
      try {
        localStorage.setItem('sensei_back_hint', '1')
      } catch {
        /* ignore */
      }
      setBackHintSeen(true)
      track('swipe_back', {})
      history.back()
    }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
    }
  }, [isHome])
  const scrollTo = (id: string) =>
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
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
    setFilters(EMPTY_FILTERS)
    setJourneyKey((k) => k + 1)
    setWay(w)
    go('journey')
  }

  // Back to the home.
  const restart = () => {
    setFilters(EMPTY_FILTERS)
    setWayError('')
    setWay(null)
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
  const currentItem: MenuTarget | null = view === 'cart' ? 'cart' : view === 'journey' ? way : null

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
        {!isHome && !backHintSeen && (
          <p className="meta back-hint" style={{ marginTop: 12 }}>
            <span className="back-hint-arrow" aria-hidden="true">
              ←
            </span>
            Swipe right from the left side to go back
          </p>
        )}
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

      {view === 'journey' && way === null && (
        <main>
          <Masthead storeCount={storeCount} productCount={productCount} neighborhoods={hoodTotal} />
          <Ways onPick={goTo} busy={locating ? 'near' : null} error={wayError} />
        </main>
      )}

      {view === 'journey' && way === 'search' && (
        <main>
          <div className="wrap" style={{ paddingTop: 28 }}>
            <div className="flex items-center justify-between">
              <button type="button" onClick={restart} className="ghost">
                Home
              </button>
              <button type="button" onClick={() => pickWay('borough')} className="ghost">
                Pick a borough instead
              </button>
            </div>
            <h1 className="poster" style={{ marginTop: 26 }}>
              Search in your words
            </h1>
          </div>
          <SmartSearch
            autoFocus
            neighborhoodsByBorough={neighborhoodsByBorough}
            onSearch={(f) => {
              setFilters(f)
              go('results')
            }}
          />
        </main>
      )}

      {view === 'journey' && way === 'borough' && (
        <main>
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
            onEdit={() => {
              setWay('borough')
              go('journey')
            }}
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

      <footer className="wrap" style={{ paddingBottom: 80 }}>
        <div id="drop" className="notice" style={{ marginTop: 96 }}>
          <Newsletter source="footer" compact />
        </div>
        <p className="foot">
          <b>Sensei</b> is a guide for adults 21 and over in New York State. We list licensed retailers only, link to
          each dispensary's own menu, and do not sell cannabis. Brands may advertise on Sensei; they may not change
          the order of results.
        </p>
        <div className="contact">
          <a href="mailto:hello@sensei.nyc">hello@sensei.nyc</a>
          <a href="tel:+12125550100">(212) 555-0100</a>
          <span>420 Broadway, New York, NY 10010</span>
          <a href="#" aria-label="Instagram" className="ig" onClick={(e) => e.preventDefault()}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
          </a>
        </div>
        <SenseiBullets />
      </footer>
    </div>
  )
}
