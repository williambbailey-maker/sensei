import type { Deal } from '../lib/types'

export function Deals({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) return null
  return (
    <section id="deals" className="mx-auto max-w-2xl px-6 pt-14">
      <h2 className="poster">Worth a look</h2>
      <div className="rule mt-3">
        <span>{String(deals.length).padStart(2, '0')}</span>
      </div>
      <div className="mt-4">
        {deals.map((d, i) => (
          <a
            key={d.id}
            href={d.url ?? '#'}
            target={d.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="row"
          >
            <span className="row-l">
              <span className={`marker ${d.featured || i === 0 ? 'marker-on' : ''}`} />
              <span className="min-w-0">
                <span className="label block truncate">{d.title}</span>
                <span className="meta block truncate">
                  {[d.store?.name, d.store?.borough, d.description].filter(Boolean).join(' · ')}
                </span>
              </span>
            </span>
            <span className="label shrink-0" aria-hidden="true">
              →
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
