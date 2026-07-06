import { Ico } from './Ico'
import type { Deal } from '../lib/types'

export function Deals({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) return null
  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <p className="eyebrow">Selected · This week</p>
      <h2 className="display mt-2 text-4xl">worth a look</h2>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {deals.map((d) => (
          <a
            key={d.id}
            href={d.url ?? '#'}
            target={d.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-4 rounded-[40px] border border-line bg-white p-6 transition hover:scale-[1.02]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {d.featured && <span className="eyebrow text-accent">Featured</span>}
              </div>
              <h3 className="mt-1 truncate font-medium text-black">{d.title}</h3>
              {d.description && (
                <p className="mt-0.5 truncate text-sm normal-case text-muted">{d.description}</p>
              )}
              {d.store?.name && (
                <p className="mt-1.5 text-xs text-muted">
                  {d.store.name}
                  {d.store.borough ? ` · ${d.store.borough}` : ''}
                </p>
              )}
            </div>
            <Ico
              name="arrow"
              className="h-5 w-5 shrink-0 text-line transition group-hover:text-accent"
            />
          </a>
        ))}
      </div>
    </section>
  )
}
