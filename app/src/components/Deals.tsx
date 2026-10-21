import type { Deal } from '../lib/types'

export function Deals({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) return null
  return (
    <section id="deals" className="wrap">
      <div className="rule" />
      <p className="k" style={{ marginTop: 26 }}>
        Worth a look
        <small>this week</small>
      </p>
      <div className="board" style={{ marginTop: 18 }}>
        {deals.map((d) => (
          <a
            key={d.id}
            href={d.url ?? '#'}
            target={d.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="board-row"
          >
            <span className="min-w-0 truncate">{d.title}</span>
            <span className="dim truncate">
              {[d.store?.name, d.store?.borough].filter(Boolean).join(' · ') || d.description || '→'}
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
