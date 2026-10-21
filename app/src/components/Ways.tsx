import { BOROUGHS } from '../lib/labels'

// The ways in. The hero's white CTA is "Shops near me" (01), so the
// "Start here" block lists the other three as numbered line bullets; the
// menu lists all four with the same numbers.
export type Way = 'near' | 'borough' | 'search' | 'all'

const WAYS: { key: Way; title: string; desc: string; color: string; dark?: boolean }[] = [
  { key: 'near', title: 'Near me', desc: 'Closest shops first', color: 'var(--r)' },
  { key: 'borough', title: 'Pick a borough', desc: BOROUGHS.join(' · '), color: 'var(--b)' },
  { key: 'search', title: 'Search in your words', desc: '"Sativa pre-rolls under $10"', color: 'var(--g)' },
  { key: 'all', title: 'See everything', desc: 'Every product · cheapest first', color: 'var(--y)', dark: true },
]

export function wayIndex(key: Way): string {
  return String(WAYS.findIndex((w) => w.key === key) + 1).padStart(2, '0')
}
export function wayTitle(key: Way): string {
  return WAYS.find((w) => w.key === key)?.title ?? ''
}

export function Ways({ onPick, busy }: { onPick: (w: Way) => void; busy?: Way | null }) {
  return (
    <section className="wrap">
      <div className="rule" />
      <p className="k" style={{ marginTop: 26 }}>
        Start here
        <small>three more ways in</small>
      </p>
      <div className="ways" style={{ marginTop: 14 }}>
        {WAYS.filter((w) => w.key !== 'near').map((w, i) => (
          <button key={w.key} type="button" onClick={() => onPick(w.key)} disabled={busy != null} className="way">
            <span className="way-l">
              <span className={`mb s ${w.dark ? 'y' : ''}`} style={{ background: w.color }}>
                {i + 2}
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
