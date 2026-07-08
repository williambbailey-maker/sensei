import { Ico } from './Ico'
import type { Deal } from '../lib/types'

export function Deals({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) return null
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
      <p className="eyebrow">Selected · This week</p>
      <h2 className="display mt-2 text-[clamp(1.9rem,5vw,2.8rem)] text-ink">Worth a look</h2>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {deals.map((d) => (
          <a
            key={d.id}
            href={d.url ?? '#'}
            target={d.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-6 shadow-soft-sm transition hover:-translate-y-0.5"
          >
            <div className="min-w-0">
              {d.featured && <span className="label text-[10px] text-muted">Featured</span>}
              <h3 className="mt-1 truncate text-lg font-bold text-ink">{d.title}</h3>
              {d.description && <p className="mt-0.5 truncate text-sm font-medium text-muted">{d.description}</p>}
              {d.store?.name && (
                <p className="mt-2 label text-[10px] text-muted">
                  {d.store.name}
                  {d.store.borough ? ` · ${d.store.borough}` : ''}
                </p>
              )}
            </div>
            <Ico name="arrow" className="h-5 w-5 shrink-0 text-ink transition group-hover:translate-x-1" />
          </a>
        ))}
      </div>
    </section>
  )
}
