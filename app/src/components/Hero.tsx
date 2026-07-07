import { useMemo, useState } from 'react'
import { Ico } from './Ico'
import { ProductCard } from './ProductCard'
import { PopIn, PopItem, Reveal } from './motion'
import { FloatSticker, StickerBolt, StickerCookie, StickerJar, StickerLeaf, StickerStar } from './pop'
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

// Home flow in the PLAZA-pop idiom: a cobalt knockout hero band with scattered
// sticker mascots, then a bright ice section with the location picker, search,
// and product rows. All logic preserved; presentation is loud and playful.
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
      {/* Cobalt knockout hero band — rounded heavy headline with floating
          stickers. The loud, immediately-on-brand opener. */}
      <div className="relative overflow-hidden border-b-3 border-ink bg-cobalt">
        <FloatSticker seed={1} className="absolute -right-4 top-8 h-24 w-24 sm:right-16 sm:top-14 sm:h-36 sm:w-36">
          <StickerCookie className="h-full w-full rotate-12" />
        </FloatSticker>
        <FloatSticker seed={2} className="absolute left-4 top-6 h-16 w-16 sm:left-24 sm:top-24 sm:h-24 sm:w-24">
          <StickerLeaf className="h-full w-full -rotate-12" />
        </FloatSticker>
        <FloatSticker seed={3} className="absolute bottom-10 left-6 hidden h-16 w-16 sm:block">
          <StickerStar className="h-full w-full rotate-6" />
        </FloatSticker>
        <FloatSticker seed={4} className="absolute -bottom-2 right-6 h-20 w-20 sm:right-40 sm:h-28 sm:w-28">
          <StickerJar className="h-full w-full -rotate-6" />
        </FloatSticker>
        <FloatSticker seed={5} className="absolute right-6 top-1/2 hidden h-14 w-14 sm:block">
          <StickerBolt className="h-full w-full" />
        </FloatSticker>

        <PopIn className="relative mx-auto max-w-6xl px-6 py-16 text-center sm:py-24">
          <PopItem>
            <p className="label text-[13px] text-sun">Your dispensary sensei</p>
          </PopItem>
          <PopItem>
            <h1 className="display mx-auto mt-4 max-w-4xl text-[clamp(3rem,13vw,8.5rem)] text-white">
              Every menu.
              <br />
              One counter.
            </h1>
          </PopItem>
          <PopItem>
            <p className="mx-auto mt-5 max-w-md text-[15px] font-semibold text-white/85">
              Compare price, potency &amp; pickup across every licensed dispensary near you — then order
              where it's right.
            </p>
          </PopItem>
          <PopItem>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => onQuick({})}
                className="pop-press rounded-full border-3 border-ink bg-white px-7 py-3 display text-lg text-cobalt"
              >
                Browse menus →
              </button>
              <button
                onClick={onBrowse}
                className="pop-press rounded-full border-3 border-ink bg-magenta px-7 py-3 display text-lg text-white"
              >
                Guided journey →
              </button>
            </div>
          </PopItem>
        </PopIn>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Location — the primary interaction, as a bold pop card. */}
        {!showPicker ? (
          <div className="-mt-6 flex flex-wrap items-center justify-between gap-3 rounded-full border-3 border-ink bg-white px-6 py-3 shadow-[4px_4px_0_#111]">
            <span className="label text-[13px] text-magenta">◉ {whereLabel}</span>
            {nearby.length > 0 && (
              <span className="label text-[12px] text-muted">
                {storeCount} store{storeCount === 1 ? '' : 's'} · {nearby.length.toLocaleString()} products
              </span>
            )}
            <button
              onClick={() => setEditingLoc(true)}
              className="rounded-full border-3 border-ink bg-ice px-4 py-1.5 label text-[12px] text-cobalt transition hover:bg-white"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="-mt-6 rounded-3xl border-3 border-ink bg-white p-6 shadow-[6px_6px_0_#111] sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow text-magenta">Start here</p>
                <h2 className="display mt-1 text-4xl text-cobalt sm:text-5xl">Where are you?</h2>
              </div>
              {located && (
                <button
                  onClick={() => setEditingLoc(false)}
                  className="rounded-full border-3 border-ink bg-ice px-4 py-1.5 label text-[12px] text-cobalt transition hover:bg-white"
                >
                  Done
                </button>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Pill active={!!filters.userLoc} onClick={nearMe} tone="magenta">
                ◉ {locating ? 'Locating…' : filters.userLoc ? 'Near me' : 'Use my location'}
              </Pill>
              {BOROUGHS.map((b) => (
                <Pill key={b} active={filters.borough === b} onClick={() => pickBorough(b)}>
                  {b}
                </Pill>
              ))}
            </div>

            {locError && <p className="mt-3 label text-[12px] text-tomato">{locError}</p>}

            {filters.userLoc && (
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <span className="eyebrow mr-1">Within</span>
                {RADII.map((r) => (
                  <Pill key={r} active={filters.radiusMiles === r} onClick={() => onLocation({ radiusMiles: r })}>
                    {r} mi
                  </Pill>
                ))}
              </div>
            )}

            {neighborhoods.length > 0 && !filters.userLoc && (
              <div className="mt-5">
                <span className="eyebrow">Neighborhood</span>
                <div className="mt-2.5 flex flex-wrap gap-2.5">
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
          </div>
        )}

        {/* Ask sensei — a pop pill search. */}
        <form onSubmit={submit} className="mt-6">
          <div className="flex items-center gap-2 rounded-full border-3 border-ink bg-white py-2 pl-5 pr-2 shadow-[4px_4px_0_#111] transition focus-within:bg-ice">
            <Ico name="search" className="h-5 w-5 shrink-0 text-cobalt" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={located ? `Ask sensei — searching ${whereLabel}…` : 'Ask sensei — “mellow flower under $50”…'}
              className="w-full bg-transparent py-1.5 text-[15px] font-semibold text-ink placeholder:text-muted/70"
              autoComplete="off"
              aria-label="Ask sensei what you want"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full border-3 border-ink bg-cobalt px-5 py-2 display text-base text-white transition hover:bg-cobalt-deep disabled:opacity-30"
              disabled={!text.trim()}
            >
              Ask
            </button>
          </div>
        </form>

        {/* Located storefront: what's near you, right now. */}
        {located && cheapest.length > 0 && (
          <div className="mt-12">
            <Row label={`Cheapest ${filters.userLoc ? 'near you' : `in ${whereLabel}`}`} onSeeAll={() => onQuick({ sort: 'price-asc' })}>
              {cheapest.map((p) => (
                <div key={p.id} className="w-[320px] shrink-0">
                  <ProductCard p={p} userLoc={filters.userLoc} onAdd={onAdd} />
                </div>
              ))}
            </Row>
            <div className="mt-10">
              <Row label={`Top picks ${filters.userLoc ? 'near you' : `in ${whereLabel}`}`} onSeeAll={() => onQuick({})}>
                {picks.map((p) => (
                  <div key={p.id} className="w-[320px] shrink-0">
                    <ProductCard p={p} userLoc={filters.userLoc} onAdd={onAdd} />
                  </div>
                ))}
              </Row>
            </div>
          </div>
        )}

        {/* Refiners */}
        <Reveal className="mt-14 grid gap-8 sm:grid-cols-2">
          <div>
            <p className="display text-2xl text-cobalt">By feel</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {VIBES.slice(0, 6).map((v) => (
                <Tag key={v.key} onClick={() => onVibe(v.key)}>
                  {v.label}
                </Tag>
              ))}
            </div>
            <button
              onClick={onBrowse}
              className="mt-5 inline-flex items-center gap-2 label text-[13px] text-magenta transition hover:gap-3"
            >
              Not sure? Take the guided journey →
            </button>
          </div>
          <div className="space-y-7">
            <div>
              <p className="display text-2xl text-cobalt">By product type</p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {FORMATS.map((fmt) => (
                  <Tag key={fmt.key} onClick={() => onQuick({ format: fmt.key })}>
                    {fmt.label}
                  </Tag>
                ))}
              </div>
            </div>
            <div>
              <p className="display text-2xl text-cobalt">By price</p>
              <div className="mt-4 flex flex-wrap gap-2.5">
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

function Row({ label, onSeeAll, children }: { label: string; onSeeAll: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-end justify-between">
        <p className="display text-2xl text-cobalt sm:text-3xl">{label}</p>
        <button onClick={onSeeAll} className="label text-[13px] text-magenta transition hover:text-cobalt">
          See all →
        </button>
      </div>
      <div className="-mx-4 mt-4 flex gap-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">{children}</div>
    </div>
  )
}

// Pop pill — active fills cobalt (or magenta), inactive is white with a black outline.
function Pill({
  active,
  onClick,
  tone = 'cobalt',
  children,
}: {
  active: boolean
  onClick: () => void
  tone?: 'cobalt' | 'magenta'
  children: React.ReactNode
}) {
  const activeSkin = tone === 'magenta' ? 'bg-magenta text-white' : 'bg-cobalt text-white'
  return (
    <button
      onClick={onClick}
      className={`rounded-full border-3 border-ink px-4 py-2 label text-[12px] transition ${
        active ? activeSkin : 'bg-white text-ink hover:bg-ice'
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
      className="rounded-full border-3 border-ink bg-white px-4 py-2 label text-[12px] text-ink transition hover:bg-sun"
    >
      {children}
    </button>
  )
}
