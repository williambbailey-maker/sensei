import { useState } from 'react'
import { Ico } from './Ico'
import { FORMATS, VIBES } from '../lib/labels'
import type { Filters, Vibe } from '../lib/types'

export function Hero({
  onSearch,
  onVibe,
  onBrowse,
  onQuick,
  boroughs,
}: {
  onSearch: (text: string) => void
  onVibe: (v: Vibe) => void
  onBrowse: () => void
  onQuick: (patch: Partial<Filters>) => void
  boroughs: string[]
}) {
  const [text, setText] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim()) onSearch(text)
  }

  return (
    <section className="mx-auto max-w-2xl px-5 pt-16 pb-10 text-center sm:pt-24">
      <div className="animate-fade-up">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-ink-line bg-ink-soft px-3 py-1 text-xs text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          NYC dispensary menus, in one place
        </p>
        <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          Find your match.
          <br />
          <span className="text-accent">By vibe or by the details.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-base text-zinc-400">
          Say what you want in plain words — or filter by price, format, and
          borough. Every NYC menu, one place.
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 animate-fade-up">
        <div className="group flex items-center gap-2 rounded-2xl border border-ink-line bg-ink-card p-2 pl-4 transition focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10">
          <Ico name="search" className="h-5 w-5 shrink-0 text-zinc-500" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="mellow flower under $50 in Brooklyn…"
            className="w-full bg-transparent py-2.5 text-[15px] placeholder:text-zinc-500"
            autoComplete="off"
            aria-label="Describe what you want"
          />
          <button
            type="submit"
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-accent-soft disabled:opacity-40"
            disabled={!text.trim()}
          >
            Match <Ico name="arrow" className="h-4 w-4" />
          </button>
        </div>
      </form>

      {/* Two equal entry points: search by vibe, or jump in by the numbers. */}
      <div className="mt-8 animate-fade-up space-y-4 text-left">
        <Row label="By vibe">
          {VIBES.slice(0, 6).map((v) => (
            <Pill key={v.key} onClick={() => onVibe(v.key)}>
              <span className="mr-1">{v.emoji}</span>
              {v.label}
            </Pill>
          ))}
        </Row>

        <Row label="By format">
          {FORMATS.map((fmt) => (
            <Pill key={fmt.key} onClick={() => onQuick({ format: fmt.key })}>
              <span className="mr-1">{fmt.emoji}</span>
              {fmt.label}
            </Pill>
          ))}
        </Row>

        <Row label="By price">
          <Pill onClick={() => onQuick({ priceCeiling: 25 })}>Under $25</Pill>
          <Pill onClick={() => onQuick({ priceCeiling: 50 })}>Under $50</Pill>
          <Pill onClick={() => onQuick({ sort: 'price-asc' })}>Cheapest first</Pill>
        </Row>

        {boroughs.length > 0 && (
          <Row label="By borough">
            {boroughs.map((b) => (
              <Pill key={b} onClick={() => onQuick({ borough: b })}>
                {b}
              </Pill>
            ))}
          </Row>
        )}
      </div>

      <button
        onClick={onBrowse}
        className="mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-accent-soft transition hover:text-white"
      >
        or take the guided journey <Ico name="arrow" className="h-4 w-4" />
      </button>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-full text-xs uppercase tracking-wide text-zinc-500 sm:w-20 sm:shrink-0">
        {label}
      </span>
      {children}
    </div>
  )
}

function Pill({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-ink-line bg-ink-soft px-3.5 py-1.5 text-sm text-zinc-300 transition hover:border-accent/50 hover:text-white"
    >
      {children}
    </button>
  )
}
