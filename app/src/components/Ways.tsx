import { BOROUGHS } from '../lib/labels'

// The four ways in, as lettered line bullets in their real MTA colors
// (letters, not numbers: they are doors, not steps). The menu's Find group
// uses the same bullets.
export type Way = 'near' | 'borough' | 'search' | 'all'

export const WAYS: { key: Way; letter: string; title: string; desc: string; color: string; dark?: boolean }[] = [
  { key: 'near', letter: 'N', title: 'Shops near me', desc: 'Share location · closest shops first', color: 'var(--y)', dark: true },
  { key: 'borough', letter: 'B', title: 'Pick a borough', desc: BOROUGHS.join(' · '), color: 'var(--o)' },
  { key: 'search', letter: 'S', title: 'Search in your words', desc: '"Sativa pre-rolls under $10"', color: 'var(--s)' },
  { key: 'all', letter: 'E', title: 'See everything', desc: 'Every product · cheapest first', color: 'var(--b)' },
]

export function wayTitle(key: Way): string {
  return WAYS.find((w) => w.key === key)?.title ?? ''
}

export function Ways({ onPick, busy, error }: { onPick: (w: Way) => void; busy?: Way | null; error?: string }) {
  return (
    <section className="wrap">
      <div className="rule" />
      <h2 className="poster" style={{ marginTop: 30, textAlign: 'center' }}>
        Start here
      </h2>
      <p className="meta text-center" style={{ marginTop: 10 }}>
        Four ways in
      </p>
      {error && (
        <p className="meta text-center text-ink" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
      <div className="ways ways-big" style={{ marginTop: 22 }}>
        {WAYS.map((w) => (
          <button key={w.key} type="button" onClick={() => onPick(w.key)} disabled={busy != null} className="way">
            <span className="way-l">
              <span className={`mb ${w.dark ? 'y' : ''}`} style={{ background: w.color }}>
                {w.letter}
              </span>
              <span className="min-w-0">
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
