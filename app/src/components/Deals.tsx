import { Ico } from './Ico'
import { Reveal } from './motion'
import type { Deal } from '../lib/types'

export function Deals({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) return null
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
      <Reveal>
        <p className="eyebrow text-magenta">Selected · This week</p>
        <h2 className="display mt-2 text-[clamp(2.25rem,7vw,4rem)] text-cobalt">Worth a look</h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {deals.map((d) => (
            <a
              key={d.id}
              href={d.url ?? '#'}
              target={d.url ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-4 rounded-2xl border-3 border-ink bg-white p-6 shadow-[4px_4px_0_#111] transition hover:-translate-y-0.5"
            >
              <div className="min-w-0">
                {d.featured && <span className="label text-[10px] text-magenta">Featured</span>}
                <h3 className="mt-1 truncate text-lg font-bold text-ink">{d.title}</h3>
                {d.description && <p className="mt-0.5 truncate text-sm font-medium text-muted">{d.description}</p>}
                {d.store?.name && (
                  <p className="mt-2 label text-[10px] text-muted">
                    {d.store.name}
                    {d.store.borough ? ` · ${d.store.borough}` : ''}
                  </p>
                )}
              </div>
              <Ico name="arrow" className="h-5 w-5 shrink-0 text-cobalt transition group-hover:translate-x-1 group-hover:text-magenta" />
            </a>
          ))}
        </div>
      </Reveal>
    </section>
  )
}
