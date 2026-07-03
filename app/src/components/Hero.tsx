import { useState } from 'react'
import { Ico } from './Ico'
import { VIBES } from '../lib/labels'
import type { Vibe } from '../lib/types'

export function Hero({
  onSearch,
  onVibe,
  onBrowse,
}: {
  onSearch: (text: string) => void
  onVibe: (v: Vibe) => void
  onBrowse: () => void
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
          Tell us the vibe.
          <br />
          <span className="text-accent">We'll find the match.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-base text-zinc-400">
          No menus to scroll, no jargon to decode. Say what you want in plain words.
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 animate-fade-up">
        <div className="group flex items-center gap-2 rounded-2xl border border-ink-line bg-ink-card p-2 pl-4 transition focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10">
          <Ico name="search" className="h-5 w-5 shrink-0 text-zinc-500" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="something mellow for a movie night…"
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

      <div className="mt-6 animate-fade-up">
        <div className="flex flex-wrap justify-center gap-2">
          {VIBES.slice(0, 6).map((v) => (
            <button
              key={v.key}
              onClick={() => onVibe(v.key)}
              className="rounded-full border border-ink-line bg-ink-soft px-3.5 py-1.5 text-sm text-zinc-300 transition hover:border-accent/50 hover:text-white"
            >
              <span className="mr-1">{v.emoji}</span>
              {v.label}
            </button>
          ))}
        </div>
        <button
          onClick={onBrowse}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent-soft transition hover:text-white"
        >
          or browse by vibe <Ico name="arrow" className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}
