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
    <section className="mx-auto max-w-6xl px-6 pt-20 sm:pt-28">
      {/* Splash: giant lowercase display wordmark + vertical label with a
          thin rule and arrow — the reference's hero composition. */}
      <div className="flex items-stretch justify-center gap-6 sm:gap-10">
        <h1 className="display animate-scale-in text-7xl sm:text-8xl lg:text-[10rem]">sensei</h1>
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

      <form onSubmit={submit} className="mx-auto mt-16 max-w-xl animate-fade-up">
        <div className="flex items-center gap-2 rounded-full border border-line bg-white py-1.5 pl-5 pr-1.5 transition focus-within:border-accent">
          <Ico name="search" className="h-5 w-5 shrink-0 text-muted" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="MELLOW FLOWER UNDER $50 IN BROOKLYN…"
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
      </form>

      {/* Two equal ways in: by feel, and by the numbers. */}
      <div className="mt-20 grid gap-10 border-t border-line pt-10 animate-fade-up sm:grid-cols-2">
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
