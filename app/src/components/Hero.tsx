import { useMemo, useState } from 'react'
import { Ico } from './Ico'
import { ProductCard } from './ProductCard'
import { requestLocation } from '../lib/geo'
import { BOROUGHS, FORMATS, RADII, VIBES } from '../lib/labels'
import { rankProducts } from '../lib/rank'
import {
  EMPTY_FILTERS,
  hasLocation,
  locationOf,
  type Filters,
  type Product,
  type Vibe,
} from '../lib/types'

// Search-first home: a short prompt leads straight into one panel (location +
// search + quick vibes) — that panel is the product. Everything else is
// secondary and styled quietly. "Cheapest near you" gets its own inverted
// band so it reads as a distinct, unmissable module; "Top picks" stays quiet.
export function Hero({
  filters,
  products,
  neighborhoodsByBorough,
  onLocation,
  onSearch,
  onVibe,
  onBrowse,
  onQuick,
  onAdd,
}: {
  filters: Filters
  products: Product[]
  neighborhoodsByBorough: Record<string, string[]>
  onLocation: (patch: Partial<Filters>) => void
  onSearch: (text: string) => void
  onVibe: (v: Vibe) => void
  onBrowse: () => void
  onQuick: (patch: Partial<Filters>) => void
  onAdd?: (p: Product) => void
}) {
  const [text, setText] = useState('')
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')
  const [editingLoc, setEditingLoc] = useState(false)

  const located = hasLocation(filters)
  const showPicker = !located || editingLoc

  const nearby = useMemo(
    () => rankProducts(products, { ...EMPTY_FILTERS, ...locationOf(filters) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, filters.borough, filters.neighborhood, filters.userLoc, filters.radiusMiles],
  )
  const storeCount = useMemo(() => new Set(nearby.map((p) => p.store?.slug ?? '')).size, [nearby])
  const cheapest = useMemo(
    () =>
      [...nearby].sort((a, b) => (a.price_min ?? Infinity) - (b.price_min ?? Infinity)).slice(0, 6),
    [nearby],
  )
  const picks = nearby.slice(0, 6)

  const whereLabel = filters.userLoc
    ? `Near me${filters.radiusMiles != null ? ` · ${filters.radiusMiles} mi` : ''}`
    : (filters.neighborhood ?? filters.borough ?? '')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim()) onSearch(text)
  }

  const nearMe = () => {
    setLocError('')
    setLocating(true)
    requestLocation(
      (loc) => {
        setLocating(false)
        onLocation({ userLoc: loc, radiusMiles: 2, borough: null, neighborhood: null })
        setEditingLoc(true)
      },
      (msg) => {
        setLocating(false)
        setLocError(msg)
      },
    )
  }

  const pickBorough = (b: string) => {
    onLocation({
      borough: filters.borough === b ? null : b,
      neighborhood: null,
      userLoc: null,
      radiusMiles: null,
    })
    setEditingLoc(true)
  }

  const neighborhoods = filters.borough ? (neighborhoodsByBorough[filters.borough] ?? []) : []

  return (
    <section>
      <div className="mx-auto max-w-xl px-6 pt-14 text-center sm:pt-20">
        <h1 className="display text-[clamp(2.1rem,6vw,3.1rem)] text-ink">
          Browse every NYC licensed dispensary in one place.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] font-medium leading-relaxed text-muted">
          One search across every licensed NYC dispensary — price, potency &amp; pickup, instantly.
        </p>
      </div>

      <div className="mx-auto max-w-xl px-4 sm:px-6">
        {/* The primary panel — location, search, quick vibes. Everything the
            page wants you to do lives inside this one box. */}
        <div className="mt-8 rounded-[28px] border border-ink bg-panel p-6 shadow-soft sm:p-7">
          {!showPicker ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="label text-[12px] text-ink">◉ {whereLabel}</span>
              {nearby.length > 0 && (
                <span className="label text-[11px] text-muted">
                  {storeCount} store{storeCount === 1 ? '' : 's'} · {nearby.length.toLocaleString()} products
                </span>
              )}
              <button
                onClick={() => setEditingLoc(true)}
                className="label text-[11px] text-muted transition hover:text-ink"
              >
                Change
              </button>
            </div>
          ) : (
            <div>
              <span className="eyebrow text-steel-dim">Where are you?</span>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill active={!!filters.userLoc} onClick={nearMe}>
                  ◉ {locating ? 'Locating…' : filters.userLoc ? 'Near me' : 'Use my location'}
                </Pill>
                {BOROUGHS.map((b) => (
                  <Pill key={b} active={filters.borough === b} onClick={() => pickBorough(b)}>
                    {b}
                  </Pill>
                ))}
              </div>

              {locError && <p className="mt-3 label text-[11px] text-ink">{locError}</p>}

              {filters.userLoc && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="eyebrow mr-1">Within</span>
                  {RADII.map((r) => (
                    <Pill key={r} active={filters.radiusMiles === r} onClick={() => onLocation({ radiusMiles: r })}>
                      {r} mi
                    </Pill>
                  ))}
                </div>
              )}

              {neighborhoods.length > 0 && !filters.userLoc && (
                <div className="mt-3">
                  <span className="eyebrow">Neighborhood</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Pill active={filters.neighborhood === null} onClick={() => onLocation({ neighborhood: null })}>
                      All {filters.borough}
                    </Pill>
                    {neighborhoods.map((n) => (
                      <Pill
                        key={n}
                        active={filters.neighborhood === n}
                        onClick={() => onLocation({ neighborhood: filters.neighborhood === n ? null : n })}
                      >
                        {n}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}

              {located && (
                <button
                  onClick={() => setEditingLoc(false)}
                  className="mt-3 label text-[11px] text-muted transition hover:text-ink"
                >
                  Done
                </button>
              )}
            </div>
          )}

          <form onSubmit={submit} className="mt-5">
            <div className="flex items-center gap-2 rounded-full border border-ink bg-ice py-1.5 pl-5 pr-1.5 transition focus-within:bg-white">
              <Ico name="search" className="h-4 w-4 shrink-0 text-muted" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={located ? `Ask sensei — searching ${whereLabel}…` : 'Ask sensei — “mellow flower under $50”…'}
                className="w-full bg-transparent py-2 text-[15px] font-semibold text-ink placeholder:text-muted/70"
                autoComplete="off"
                aria-label="Ask sensei what you want"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-ink px-5 py-2.5 label text-[12px] text-white transition hover:opacity-85 disabled:opacity-30"
                disabled={!text.trim()}
              >
                Search
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="eyebrow text-steel-dim">Try</span>
            {VIBES.slice(0, 5).map((v) => (
              <button
                key={v.key}
                onClick={() => onVibe(v.key)}
                className="rounded-full bg-ink/5 px-3 py-1.5 text-[12px] font-semibold text-ink transition hover:bg-ink/10"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary paths — de-emphasized on purpose; the panel above is
            the primary action. */}
        <div className="mt-5 flex flex-wrap justify-center gap-x-7 gap-y-2">
          <button onClick={() => onQuick({})} className="label text-[11.5px] text-muted transition hover:text-ink">
            Browse the full menu →
          </button>
          <button onClick={onBrowse} className="label text-[11.5px] text-muted transition hover:text-ink">
            Take the guided journey →
          </button>
        </div>

        {/* Full filter functionality stays reachable, just quiet. */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-line pt-5">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.key}
              onClick={() => onQuick({ format: fmt.key })}
              className="text-[12.5px] font-semibold text-muted transition hover:text-ink"
            >
              {fmt.label}
            </button>
          ))}
          <span className="h-3.5 w-px bg-line" />
          <button
            onClick={() => onQuick({ priceCeiling: 25 })}
            className="text-[12.5px] font-semibold text-muted transition hover:text-ink"
          >
            Under $25
          </button>
          <button
            onClick={() => onQuick({ priceCeiling: 50 })}
            className="text-[12.5px] font-semibold text-muted transition hover:text-ink"
          >
            Under $50
          </button>
          <button
            onClick={() => onQuick({ sort: 'price-asc' })}
            className="text-[12.5px] font-semibold text-muted transition hover:text-ink"
          >
            Lowest price
          </button>
        </div>
      </div>

      {/* Cheapest near you — deliberately loud, inverted band. */}
      {located && cheapest.length > 0 && (
        <div className="mt-14 bg-ink py-12 text-white sm:py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1 label text-[11px] text-ink">
                  ⚡ Best value
                </span>
                <p className="display mt-3 text-[clamp(1.75rem,5vw,2.6rem)] text-white">
                  Cheapest {filters.userLoc ? 'near you' : `in ${whereLabel}`}
                </p>
              </div>
              <button
                onClick={() => onQuick({ sort: 'price-asc' })}
                className="label text-[11px] text-steel transition hover:text-white"
              >
                See all →
              </button>
            </div>
            <div className="-mx-4 mt-8 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
              {cheapest.map((p) => (
                <div key={p.id} className="w-[300px] shrink-0">
                  <ProductCard p={p} userLoc={filters.userLoc} onAdd={onAdd} dark />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top picks — quiet, secondary listing underneath. */}
      {located && picks.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
          <Row label={`Top picks ${filters.userLoc ? 'near you' : `in ${whereLabel}`}`} onSeeAll={() => onQuick({})}>
            {picks.map((p) => (
              <div key={p.id} className="w-[300px] shrink-0">
                <ProductCard p={p} userLoc={filters.userLoc} onAdd={onAdd} />
              </div>
            ))}
          </Row>
        </div>
      )}
    </section>
  )
}

function Row({ label, onSeeAll, children }: { label: string; onSeeAll: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-end justify-between border-b border-line pb-3">
        <p className="text-[17px] font-bold text-muted">{label}</p>
        <button onClick={onSeeAll} className="label text-[11px] text-muted transition hover:text-ink">
          See all →
        </button>
      </div>
      <div className="-mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">{children}</div>
    </div>
  )
}

// Pop pill — active fills ink, inactive is white with a thin outline.
function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border border-ink px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
        active ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-ice'
      }`}
    >
      {children}
    </button>
  )
}
