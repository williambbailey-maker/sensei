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
    <section className="mx-auto max-w-6xl px-6 pt-10 sm:pt-14">
      {/* Split headline around a center circle — the reference site's hero. */}
      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto_1fr] sm:gap-6">
        <h1 className="display animate-fade-up whitespace-nowrap text-center text-6xl sm:justify-self-end sm:text-right sm:text-7xl lg:text-8xl">
          Sensei
        </h1>
        <div className="relative mx-auto flex aspect-square w-40 items-center justify-center sm:w-48 lg:w-56">
          <span className="absolute inset-0 animate-circle-in rounded-full bg-sand" />
          <span className="display relative z-10 text-5xl text-paper sm:text-6xl" aria-hidden="true">
            先
          </span>
        </div>
        <h1 className="display animate-fade-up whitespace-nowrap text-center text-6xl sm:justify-self-start sm:text-left sm:text-7xl lg:text-8xl">
          New York
        </h1>
      </div>

      <div className="mt-6 grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <p className="hidden text-sm text-black/60 sm:block">/ˈsen.seɪ/ (noun)</p>
        <p className="mx-auto max-w-sm text-center text-[15px] leading-relaxed">
          Every licensed dispensary menu in New York, one place. Search by feel — or by
          price, format, strain, borough.
        </p>
        <p className="hidden items-center justify-end gap-1.5 text-sm text-black/60 sm:flex">
          Discover the menu <Ico name="arrow" className="h-4 w-4 rotate-90" />
        </p>
      </div>

      <form onSubmit={submit} className="mx-auto mt-10 max-w-xl animate-fade-up">
        <div className="flex items-center gap-2 rounded-full border border-black/15 bg-white py-1.5 pl-5 pr-1.5 transition focus-within:border-black">
          <Ico name="search" className="h-5 w-5 shrink-0 text-black/40" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="mellow flower under $50 in Brooklyn…"
            className="w-full bg-transparent py-2 text-[15px] placeholder:text-black/40"
            autoComplete="off"
            aria-label="Describe what you want"
          />
          <button
            type="submit"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-neutral-800 disabled:opacity-30"
            disabled={!text.trim()}
          >
            Search <Ico name="arrow" className="h-4 w-4" />
          </button>
        </div>
      </form>

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
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-black transition hover:text-accent"
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
      className="rounded-full border border-black/15 bg-white px-4 py-1.5 text-sm text-black transition hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  )
}
