import { useState } from 'react'
import { Ico } from './Ico'
import { requestLocation } from '../lib/geo'
import { BOROUGHS, FORMATS, RADII, VIBES } from '../lib/labels'
import { hasLocation, type Filters, type Vibe } from '../lib/types'

export function Hero({
  filters,
  neighborhoodsByBorough,
  onLocation,
  onSearch,
  onVibe,
  onBrowse,
  onQuick,
}: {
  filters: Filters
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
  const located = hasLocation(filters)

  return (
    <section className="mx-auto max-w-6xl px-6 pt-14 sm:pt-20">
      {/* Splash: giant lowercase display wordmark + vertical label. */}
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

      {/* Location first — everything after inherits this answer. */}
      <div className="mx-auto mt-14 max-w-3xl animate-fade-up rounded-[40px] border border-accent/25 bg-white p-7 sm:p-9">
        <p className="eyebrow text-accent">Start here</p>
        <h2 className="display mt-2 text-4xl">where are you?</h2>
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

        {neighborhoods.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="eyebrow">Narrow it</span>
            <button
              onClick={() => onLocation({ neighborhood: null })}
              className={`rounded-full px-3.5 py-1 text-[13px] uppercase tracking-wide transition ${
                filters.neighborhood === null
                  ? 'bg-accent text-white'
                  : 'border border-line bg-white text-black hover:border-accent hover:text-accent'
              }`}
            >
              All {filters.borough}
            </button>
            {neighborhoods.map((n) => (
              <button
                key={n}
                onClick={() =>
                  onLocation({ neighborhood: filters.neighborhood === n ? null : n })
                }
                className={`rounded-full px-3.5 py-1 text-[13px] uppercase tracking-wide transition ${
                  filters.neighborhood === n
                    ? 'bg-accent text-white'
                    : 'border border-line bg-white text-black hover:border-accent hover:text-accent'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {located && (
          <button
            onClick={() => onQuick({})}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:scale-[1.02] hover:shadow-[0_7px_29px_rgba(0,0,139,0.2)]"
          >
            Browse everything{' '}
            {filters.userLoc
              ? `within ${filters.radiusMiles} mi`
              : (filters.neighborhood ?? filters.borough)}{' '}
            <Ico name="arrow" className="h-4 w-4" />
          </button>
        )}
      </div>

      <form onSubmit={submit} className="mx-auto mt-10 max-w-xl animate-fade-up">
        <div className="flex items-center gap-2 rounded-full border border-line bg-white py-1.5 pl-5 pr-1.5 transition focus-within:border-accent">
          <Ico name="search" className="h-5 w-5 shrink-0 text-muted" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="MELLOW FLOWER UNDER $50…"
            className="w-full bg-transparent py-2 text-sm uppercase tracking-wide placeholder:text-muted/70"
            autoComplete="off"
            aria-label="Describe what you want"
          />
          <button
            type="submit"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:scale-105 hover:shadow-[0_7px_29px_rgba(0,0,139,0.2)] disabled:opacity-30"
            disabled={!text.trim()}
          >
            Search
          </button>
        </div>
        {located && (
          <p className="mt-2 text-center text-[11px] uppercase tracking-label text-muted">
            Searching {filters.userLoc ? `within ${filters.radiusMiles} mi of you` : (filters.neighborhood ?? filters.borough)}
          </p>
        )}
      </form>

      {/* Then: by feel, and by the numbers — location carries into all of it. */}
      <div className="mt-16 grid gap-10 border-t border-line pt-10 animate-fade-up sm:grid-cols-2">
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
            Take the guided journey <Ico name="arrow" className="h-4 w-4" />
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
