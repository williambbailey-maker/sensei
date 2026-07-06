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

// The home flow: answer "where are you?" once, then the page becomes a
// storefront for that location — stats, an always-present "ask sensei" search
// box, nearby product rows, and refiner chips. Location persists everywhere.
export function Hero({
  filters,
  products,
  neighborhoodsByBorough,
  onLocation,
  onSearch,
  onVibe,
  onBrowse,
  onQuick,
}: {
  filters: Filters
  products: Product[]
  neighborhoodsByBorough: Record<string, string[]>
  onLocation: (patch: Partial<Filters>) => void
  onSearch: (text: string) => void
  onVibe: (v: Vibe) => void
  onBrowse: () => void
  onQuick: (patch: Partial<Filters>) => void
}) {
  const [text, setText] = useState('')
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')
  const [editingLoc, setEditingLoc] = useState(false)

  const located = hasLocation(filters)
  const showPicker = !located || editingLoc

  // Everything in stock at the chosen location, ranked with defaults.
  const nearby = useMemo(
    () => rankProducts(products, { ...EMPTY_FILTERS, ...locationOf(filters) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, filters.borough, filters.neighborhood, filters.userLoc, filters.radiusMiles],
  )
  const storeCount = useMemo(
    () => new Set(nearby.map((p) => p.store?.slug ?? '')).size,
    [nearby],
  )
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
      },
      (msg) => {
        setLocating(false)
        setLocError(msg)
      },
    )
  }

  const pickBorough = (b: string) =>
    onLocation({
      borough: filters.borough === b ? null : b,
      neighborhood: null,
      userLoc: null,
      radiusMiles: null,
    })

  const neighborhoods = filters.borough ? (neighborhoodsByBorough[filters.borough] ?? []) : []

  return (
    <section className="mx-auto max-w-6xl px-6 pt-12 sm:pt-16">
      {/* Splash: lowercase display wordmark + vertical label. */}
      <div className="flex items-stretch justify-center gap-6 sm:gap-10">
        <h1 className="display animate-scale-in text-6xl sm:text-8xl lg:text-9xl">sensei</h1>
        <div className="flex animate-fade-up flex-col items-center">
          <p
            className="text-[13px] uppercase tracking-label text-black"
            style={{ writingMode: 'vertical-rl' }}
          >
            Every menu in New York
          </p>
          <span className="mt-3 w-px flex-grow bg-black" aria-hidden="true" />
          <span className="-mt-px text-black" aria-hidden="true">
            ▾
          </span>
        </div>
      </div>

      {/* Located: a compact bar with stats. Not located (or editing): the picker. */}
      {!showPicker ? (
        <div className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-full border border-line bg-white py-3 pl-6 pr-3 animate-fade-up">
          <span className="text-[13px] font-bold uppercase tracking-wide text-accent">
            ◉ {whereLabel}
          </span>
          {nearby.length > 0 && (
            <span className="text-[13px] uppercase tracking-wide text-muted">
              {storeCount} store{storeCount === 1 ? '' : 's'} · {nearby.length.toLocaleString()}{' '}
              products
            </span>
          )}
          <button
            onClick={() => setEditingLoc(true)}
            className="rounded-full border border-line px-4 py-1.5 text-[13px] uppercase tracking-wide text-black transition hover:border-accent hover:text-accent"
          >
            Change
          </button>
        </div>
      ) : (
        <div className="mx-auto mt-12 max-w-3xl animate-fade-up rounded-[40px] border border-accent/25 bg-white p-7 sm:p-9">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow text-accent">Start here</p>
              <h2 className="display mt-2 text-4xl">where are you?</h2>
            </div>
            {located && (
              <button
                onClick={() => setEditingLoc(false)}
                className="rounded-full border border-line px-4 py-1.5 text-[13px] uppercase tracking-wide text-black transition hover:border-accent hover:text-accent"
              >
                Done
              </button>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={nearMe}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-bold uppercase tracking-wide transition ${
                filters.userLoc
                  ? 'bg-accent text-white'
                  : 'border border-accent text-accent hover:scale-105'
              }`}
            >
              ◉ {locating ? 'Locating…' : filters.userLoc ? 'Near me' : 'Use my location'}
            </button>
            {BOROUGHS.map((b) => (
              <button
                key={b}
                onClick={() => pickBorough(b)}
                className={`rounded-full px-4 py-1.5 text-[13px] uppercase tracking-wide transition ${
                  filters.borough === b
                    ? 'bg-accent text-white'
                    : 'border border-line bg-white text-black hover:border-accent hover:text-accent'
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          {locError && <p className="mt-3 text-xs uppercase tracking-wide text-clay">{locError}</p>}

          {filters.userLoc && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="eyebrow">Within</span>
              {RADII.map((r) => (
                <button
                  key={r}
                  onClick={() => onLocation({ radiusMiles: r })}
                  className={`rounded-full px-3.5 py-1 text-[13px] uppercase tracking-wide transition ${
                    filters.radiusMiles === r
                      ? 'bg-accent text-white'
                      : 'border border-line bg-white text-black hover:border-accent hover:text-accent'
                  }`}
                >
                  {r} mi
                </button>
              ))}
            </div>
          )}

          {neighborhoods.length > 0 && !filters.userLoc && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="eyebrow">Neighborhood</span>
              <div className="relative">
                <select
                  value={filters.neighborhood ?? ''}
                  onChange={(e) => onLocation({ neighborhood: e.target.value || null })}
                  className={`appearance-none rounded-full border px-4 py-2 pr-9 text-[13px] uppercase tracking-wide transition focus:outline-none ${
                    filters.neighborhood
                      ? 'border-accent bg-accent text-white'
                      : 'border-line bg-white text-black hover:border-accent hover:text-accent'
                  }`}
                  aria-label={`Neighborhood in ${filters.borough}`}
                >
                  <option value="">All {filters.borough}</option>
                  {neighborhoods.map((n) => (
                    <option key={n} value={n} className="bg-white text-black">
                      {n}
                    </option>
                  ))}
                </select>
                <svg
                  className={`pointer-events-none absolute right-3.5 top-1/2 h-3 w-3 -translate-y-1/2 ${
                    filters.neighborhood ? 'text-white' : 'text-muted'
                  }`}
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ask sensei — always present; the shortcut through everything. */}
      <form onSubmit={submit} className="mx-auto mt-8 max-w-xl animate-fade-up">
        <div className="flex items-center gap-2 rounded-full border border-line bg-white py-1.5 pl-5 pr-1.5 transition focus-within:border-accent">
          <Ico name="search" className="h-5 w-5 shrink-0 text-muted" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              located
                ? `ASK SENSEI — SEARCHING ${whereLabel.toUpperCase()}…`
                : 'ASK SENSEI — “MELLOW FLOWER UNDER $50”…'
            }
            className="w-full bg-transparent py-2 text-sm uppercase tracking-wide placeholder:text-muted/70"
            autoComplete="off"
            aria-label="Ask sensei what you want"
          />
          <button
            type="submit"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:scale-105 hover:shadow-[0_7px_29px_rgba(0,0,139,0.2)] disabled:opacity-30"
            disabled={!text.trim()}
          >
            Ask
          </button>
        </div>
      </form>

      {/* Located storefront: what's actually near you, right now. */}
      {located && cheapest.length > 0 && (
        <div className="mt-14 animate-fade-up">
          <Row
            label={`Cheapest ${filters.userLoc ? 'near you' : `in ${whereLabel}`}`}
            onSeeAll={() => onQuick({ sort: 'price-asc' })}
          >
            {cheapest.map((p) => (
              <div key={p.id} className="w-[330px] shrink-0">
                <ProductCard p={p} userLoc={filters.userLoc} />
              </div>
            ))}
          </Row>
          <div className="mt-8">
            <Row
              label={`Top picks ${filters.userLoc ? 'near you' : `in ${whereLabel}`}`}
              onSeeAll={() => onQuick({})}
            >
              {picks.map((p) => (
                <div key={p.id} className="w-[330px] shrink-0">
                  <ProductCard p={p} userLoc={filters.userLoc} />
                </div>
              ))}
            </Row>
          </div>
        </div>
      )}

      {/* Refiners: by feel, by the numbers — location rides along on every tap. */}
      <div className="mt-14 grid gap-10 border-t border-line pt-10 animate-fade-up sm:grid-cols-2">
        <div>
          <p className="eyebrow">By feel</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {VIBES.slice(0, 6).map((v) => (
              <Tag key={v.key} onClick={() => onVibe(v.key)}>
                {v.label}
              </Tag>
            ))}
          </div>
          <button
            onClick={onBrowse}
            className="mt-6 inline-flex items-center gap-2 text-sm uppercase tracking-wide text-accent transition hover:gap-3 hover:underline"
          >
            Not sure? Take the guided journey <Ico name="arrow" className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <p className="eyebrow">By format</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {FORMATS.map((fmt) => (
                <Tag key={fmt.key} onClick={() => onQuick({ format: fmt.key })}>
                  {fmt.label}
                </Tag>
              ))}
            </div>
          </div>

          <div>
            <p className="eyebrow">By price</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Tag onClick={() => onQuick({ priceCeiling: 25 })}>Under $25</Tag>
              <Tag onClick={() => onQuick({ priceCeiling: 50 })}>Under $50</Tag>
              <Tag onClick={() => onQuick({ sort: 'price-asc' })}>Lowest price</Tag>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// A horizontally scrolling product row with a label and "see all".
function Row({
  label,
  onSeeAll,
  children,
}: {
  label: string
  onSeeAll: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">{label}</p>
        <button
          onClick={onSeeAll}
          className="text-[13px] uppercase tracking-wide text-accent transition hover:underline"
        >
          See all →
        </button>
      </div>
      <div className="-mx-6 mt-3 flex gap-3 overflow-x-auto px-6 pb-2">{children}</div>
    </div>
  )
}

function Tag({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-line bg-white px-4 py-1.5 text-[13px] uppercase tracking-wide text-black transition hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  )
}
