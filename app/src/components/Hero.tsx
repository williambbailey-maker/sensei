import { useMemo, useState } from 'react'
import { Ico } from './Ico'
import { ProductCard } from './ProductCard'
import { MaskLabel, Reveal } from './motion'
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
// storefront for that location. Restyled to the TRANS×HOME system — giant
// grotesque labels, a poetic Fraunces statement, hairlines, and calm reveals.
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
      {/* Opening statement — asymmetric, giant grotesque label + poetic serif. */}
      <div className="mx-auto max-w-[1240px] px-[clamp(24px,6vw,120px)] pb-[clamp(6vh,9vh,120px)] pt-[clamp(8vh,12vh,160px)]">
        <div className="grid gap-y-8 sm:grid-cols-12">
          <div className="sm:col-span-7">
            <Reveal>
              <p className="eyebrow">Your dispensary sensei · 先</p>
            </Reveal>
            <h1 className="label mt-6 text-[clamp(2.75rem,9vw,6.5rem)] leading-[0.98] text-ink">
              <MaskLabel>EVERY</MaskLabel>
              <br />
              <MaskLabel>MENU.</MaskLabel>
            </h1>
            <p className="display mt-6 text-[clamp(1.5rem,4vw,2.6rem)] leading-[1.15] text-accent">
              One sensei.
            </p>
          </div>
          <div className="flex items-end sm:col-span-5 sm:justify-end">
            <Reveal delay={0.2}>
              <p className="prose-jp max-w-[38ch]">
                Compare price, potency and pickup across every licensed dispensary near you — then
                order where it's right. Calm, unhurried, one counter.
              </p>
            </Reveal>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1240px] border-t border-hairline px-[clamp(24px,6vw,120px)]">
        {/* Location — the primary interaction, as hairline rows not a card. */}
        {!showPicker ? (
          <Reveal className="flex flex-wrap items-center justify-between gap-4 py-7">
            <span className="font-grotesk text-[0.72rem] uppercase tracking-label text-accent">
              ◉ {whereLabel}
            </span>
            {nearby.length > 0 && (
              <span className="font-grotesk text-[0.72rem] uppercase tracking-label text-ink-soft">
                {storeCount} store{storeCount === 1 ? '' : 's'} · {nearby.length.toLocaleString()}{' '}
                products
              </span>
            )}
            <button
              onClick={() => setEditingLoc(true)}
              className="link-underline font-grotesk text-[0.72rem] uppercase tracking-label text-ink"
            >
              Change location
            </button>
          </Reveal>
        ) : (
          <Reveal className="py-9">
            <div className="flex items-baseline justify-between gap-4">
              <p className="eyebrow text-accent">Start here</p>
              {located && (
                <button
                  onClick={() => setEditingLoc(false)}
                  className="link-underline font-grotesk text-[0.72rem] uppercase tracking-label text-ink"
                >
                  Done
                </button>
              )}
            </div>
            <h2 className="display mt-3 text-[clamp(2rem,5vw,3.25rem)]">Where are you?</h2>

            <div className="mt-7 flex flex-wrap gap-2.5">
              <PickButton active={!!filters.userLoc} onClick={nearMe}>
                ◉ {locating ? 'Locating…' : filters.userLoc ? 'Near me' : 'Use my location'}
              </PickButton>
              {BOROUGHS.map((b) => (
                <PickButton key={b} active={filters.borough === b} onClick={() => pickBorough(b)}>
                  {b}
                </PickButton>
              ))}
            </div>

            {locError && <p className="mt-3 text-xs text-accent">{locError}</p>}

            {filters.userLoc && (
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <span className="eyebrow mr-1">Within</span>
                {RADII.map((r) => (
                  <PickButton
                    key={r}
                    active={filters.radiusMiles === r}
                    onClick={() => onLocation({ radiusMiles: r })}
                  >
                    {r} mi
                  </PickButton>
                ))}
              </div>
            )}

            {neighborhoods.length > 0 && !filters.userLoc && (
              <div className="mt-6">
                <span className="eyebrow">Neighborhood</span>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <PickButton
                    active={filters.neighborhood === null}
                    onClick={() => onLocation({ neighborhood: null })}
                  >
                    All {filters.borough}
                  </PickButton>
                  {neighborhoods.map((n) => (
                    <PickButton
                      key={n}
                      active={filters.neighborhood === n}
                      onClick={() => onLocation({ neighborhood: filters.neighborhood === n ? null : n })}
                    >
                      {n}
                    </PickButton>
                  ))}
                </div>
              </div>
            )}
          </Reveal>
        )}
      </div>

      {/* Ask sensei — a quiet underlined field, always present. */}
      <div className="mx-auto max-w-[1240px] border-t border-hairline px-[clamp(24px,6vw,120px)]">
        <form onSubmit={submit} className="flex items-center gap-3 py-6">
          <Ico name="search" className="h-5 w-5 shrink-0 text-ink-soft" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              located
                ? `Ask sensei — searching ${whereLabel}…`
                : 'Ask sensei — “mellow flower under $50”…'
            }
            className="w-full bg-transparent py-1 text-[15px] text-ink placeholder:text-ink-soft/70"
            autoComplete="off"
            aria-label="Ask sensei what you want"
          />
          <button
            type="submit"
            className="shrink-0 bg-accent px-5 py-2.5 font-grotesk text-[0.72rem] uppercase tracking-label text-paper transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent-soft disabled:opacity-30"
            disabled={!text.trim()}
          >
            Ask
          </button>
        </form>
      </div>

      {/* Located storefront: what's actually near you, right now. */}
      {located && cheapest.length > 0 && (
        <div className="mx-auto max-w-[1240px] px-[clamp(24px,6vw,120px)] pt-[clamp(6vh,9vh,120px)]">
          <Row
            label={`Cheapest ${filters.userLoc ? 'near you' : `in ${whereLabel}`}`}
            onSeeAll={() => onQuick({ sort: 'price-asc' })}
          >
            {cheapest.map((p) => (
              <div key={p.id} className="w-[320px] shrink-0">
                <ProductCard p={p} userLoc={filters.userLoc} onAdd={onAdd} />
              </div>
            ))}
          </Row>
          <div className="mt-12">
            <Row
              label={`Top picks ${filters.userLoc ? 'near you' : `in ${whereLabel}`}`}
              onSeeAll={() => onQuick({})}
            >
              {picks.map((p) => (
                <div key={p.id} className="w-[320px] shrink-0">
                  <ProductCard p={p} userLoc={filters.userLoc} onAdd={onAdd} />
                </div>
              ))}
            </Row>
          </div>
        </div>
      )}

      {/* Refiners: by feel, by the numbers. */}
      <div className="mx-auto max-w-[1240px] px-[clamp(24px,6vw,120px)] pt-[clamp(6vh,9vh,120px)]">
        <Reveal className="grid gap-x-10 gap-y-12 border-t border-hairline pt-12 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <p className="eyebrow">By feel</p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {VIBES.slice(0, 6).map((v) => (
                <Tag key={v.key} onClick={() => onVibe(v.key)}>
                  {v.label}
                </Tag>
              ))}
            </div>
            <button
              onClick={onBrowse}
              className="group mt-8 inline-flex items-center gap-2 font-grotesk text-[0.72rem] uppercase tracking-label text-accent"
            >
              Not sure? Take the guided journey
              <Ico name="arrow" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>

          <div className="space-y-10 sm:col-span-7">
            <div>
              <p className="eyebrow">By product type</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {FORMATS.map((fmt) => (
                  <Tag key={fmt.key} onClick={() => onQuick({ format: fmt.key })}>
                    {fmt.label}
                  </Tag>
                ))}
              </div>
            </div>
            <div>
              <p className="eyebrow">By price</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Tag onClick={() => onQuick({ priceCeiling: 25 })}>Under $25</Tag>
                <Tag onClick={() => onQuick({ priceCeiling: 50 })}>Under $50</Tag>
                <Tag onClick={() => onQuick({ sort: 'price-asc' })}>Lowest price</Tag>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

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
    <Reveal>
      <div className="flex items-baseline justify-between border-t border-hairline pt-5">
        <p className="eyebrow">{label}</p>
        <button
          onClick={onSeeAll}
          className="group inline-flex items-center gap-1.5 font-grotesk text-[0.72rem] uppercase tracking-label text-accent"
        >
          See all
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </button>
      </div>
      <div className="-mx-[clamp(24px,6vw,120px)] mt-6 flex gap-4 overflow-x-auto px-[clamp(24px,6vw,120px)] pb-2">
        {children}
      </div>
    </Reveal>
  )
}

// Sharp, hairline pick button — active fills terracotta.
function PickButton({
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
      className={`rounded-[2px] border px-4 py-2 font-grotesk text-[0.72rem] uppercase tracking-label transition-colors duration-300 ${
        active
          ? 'border-accent bg-accent text-paper'
          : 'border-hairline text-ink hover:border-accent hover:text-accent'
      }`}
    >
      {children}
    </button>
  )
}

function Tag({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-[2px] border border-hairline px-4 py-2 font-grotesk text-[0.72rem] uppercase tracking-label text-ink transition-colors duration-300 hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  )
}
