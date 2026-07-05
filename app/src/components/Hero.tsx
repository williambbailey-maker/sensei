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
    <section className="mx-auto max-w-5xl px-6 pt-16 sm:pt-24">
      <div className="animate-fade-up">
        <p className="eyebrow">New York · Cannabis, considered</p>
        <h1 className="mt-5 max-w-3xl text-balance text-4xl font-medium leading-[1.08] tracking-tight sm:text-6xl">
          Find the right thing,
          <br />
          without the menu maze.
        </h1>
        <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-stone-600">
          Every licensed New York dispensary menu in one place. Search by feel —
          or by the details that matter: price, format, strain, borough.
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 max-w-xl animate-fade-up">
        <div className="flex items-center gap-2 border border-line bg-white px-4 transition focus-within:border-stone-900">
          <Ico name="search" className="h-5 w-5 shrink-0 text-stone-400" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="mellow flower under $50 in Brooklyn…"
            className="w-full bg-transparent py-3.5 text-[15px] text-stone-900 placeholder:text-stone-400"
            autoComplete="off"
            aria-label="Describe what you want"
          />
          <button
            type="submit"
            className="-mr-2 flex shrink-0 items-center gap-1.5 bg-stone-900 px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-stone-700 disabled:opacity-30"
            disabled={!text.trim()}
          >
            Search <Ico name="arrow" className="h-4 w-4" />
          </button>
        </div>
      </form>

      {/* USM-style modular color band — self-contained, muted, on-brand. */}
      <div className="mt-14 animate-fade-up">
        <ModularBand />
      </div>

      {/* Two equal ways in: by feel, and by the numbers. */}
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
            className="mt-5 inline-flex items-center gap-1.5 border-b border-stone-900/30 pb-0.5 text-sm font-medium text-stone-900 transition hover:border-stone-900"
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

          {boroughs.length > 0 && (
            <div>
              <p className="eyebrow">By borough</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {boroughs.map((b) => (
                  <Tag key={b} onClick={() => onQuick({ borough: b })}>
                    {b}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// A quiet row of modular blocks — a nod to USM's grid, in muted earth tones.
function ModularBand() {
  const cells = [
    'bg-clay',
    'bg-white',
    'bg-sand',
    'bg-slate',
    'bg-white',
    'bg-ochre',
    'bg-white',
    'bg-accent',
  ]
  return (
    <div className="grid grid-cols-8 overflow-hidden border border-line" aria-hidden="true">
      {cells.map((c, i) => (
        <div
          key={i}
          className={`aspect-square border-line ${c} ${i > 0 ? 'border-l' : ''}`}
        />
      ))}
    </div>
  )
}

function Tag({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="border border-line bg-white px-3.5 py-1.5 text-sm text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
    >
      {children}
    </button>
  )
}
