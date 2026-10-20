import { BOROUGHS } from '../lib/labels'

// The four ways in, as one conspicuous block under the masthead. Each row is
// a full-width tap target with heavy rules, a number, a title, a one-line
// description and an arrow.
export type Way = 'near' | 'borough' | 'search' | 'all'

const WAYS: { key: Way; title: string; desc: string }[] = [
  { key: 'near', title: 'Near me', desc: 'Share location · closest shops first' },
  { key: 'borough', title: 'Pick a borough', desc: BOROUGHS.join(' · ') },
  { key: 'search', title: 'Search in your words', desc: '"Sativa pre-rolls under $10"' },
  { key: 'all', title: 'See everything', desc: 'Every product · cheapest first' },
]

export function wayIndex(key: Way): string {
  return String(WAYS.findIndex((w) => w.key === key) + 1).padStart(2, '0')
}
export function wayTitle(key: Way): string {
  return WAYS.find((w) => w.key === key)?.title ?? ''
}

export function Ways({
  onPick,
  busy,
  error,
}: {
  onPick: (w: Way) => void
  busy?: Way | null
  error?: string
}) {
  return (
    <section className="mx-auto max-w-2xl px-6">
      <div className="rule mt-8">
        <span>Start here</span>
      </div>
      <p className="meta mt-2 text-center">Four ways in. Pick one.</p>
      {error && <p className="meta mt-2 text-center text-ink">{error}</p>}
      <div className="ways mt-6">
        {WAYS.map((w, i) => (
          <button key={w.key} type="button" onClick={() => onPick(w.key)} disabled={busy != null} className="way">
            <span className="way-l">
              <span className="way-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0 text-left">
                <span className="way-t">{busy === w.key ? 'Locating' : w.title}</span>
                <span className="way-d">{w.desc}</span>
              </span>
            </span>
            <span className="way-a" aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

// The row you picked, pinned at the top of the next screen so the path stays
// visible. `next` spells out what follows.
export function PinnedWay({ way, next }: { way: Way; next: string }) {
  return (
    <div className="mx-auto max-w-2xl px-6">
      <div className="ways">
        <div className="way way-on">
          <span className="way-l">
            <span className="way-n">{wayIndex(way)}</span>
            <span className="min-w-0 text-left">
              <span className="way-t">{wayTitle(way)}</span>
              <span className="way-d">{next}</span>
            </span>
          </span>
          <span className="way-a" aria-hidden="true">
            ↓
          </span>
        </div>
      </div>
    </div>
  )
}
