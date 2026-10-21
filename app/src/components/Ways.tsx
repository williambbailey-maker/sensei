import { BOROUGHS } from '../lib/labels'

// The ways in. The hero's white CTA is "Shops near me", so the "Start here"
// block lists the other three as lettered line bullets (letters, not
// numbers: they are doors, not steps). The menu uses the same letters.
export type Way = 'near' | 'borough' | 'search' | 'all'

export const WAYS: { key: Way; letter: string; title: string; desc: string; color: string; dark?: boolean }[] = [
  { key: 'near', letter: 'N', title: 'Near me', desc: 'Closest shops first', color: 'var(--r)' },
  { key: 'borough', letter: 'B', title: 'Pick a borough', desc: BOROUGHS.join(' · '), color: 'var(--b)' },
  { key: 'search', letter: 'S', title: 'Search in your words', desc: '"Sativa pre-rolls under $10"', color: 'var(--g)' },
  { key: 'all', letter: 'E', title: 'See everything', desc: 'Every product · cheapest first', color: 'var(--y)', dark: true },
]

export function wayTitle(key: Way): string {
  return WAYS.find((w) => w.key === key)?.title ?? ''
}

export function Ways({ onPick, busy }: { onPick: (w: Way) => void; busy?: Way | null }) {
  return (
    <section className="wrap">
      <div className="rule" />
      <h2 className="poster" style={{ marginTop: 30, textAlign: 'center' }}>
        Start here
      </h2>
      <p className="meta text-center" style={{ marginTop: 10 }}>
        Three more ways in
      </p>
      <div className="ways ways-big" style={{ marginTop: 22 }}>
        {WAYS.filter((w) => w.key !== 'near').map((w) => (
          <button key={w.key} type="button" onClick={() => onPick(w.key)} disabled={busy != null} className="way">
            <span className="way-l">
              <span className={`mb ${w.dark ? 'y' : ''}`} style={{ background: w.color }}>
                {w.letter}
              </span>
              <span className="min-w-0">
                <span className="way-t">{w.title}</span>
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
