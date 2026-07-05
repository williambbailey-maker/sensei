import { Ico } from './Ico'
import type { Deal } from '../lib/types'

export function Deals({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) return null
  return (
    <section className="mx-auto max-w-5xl px-6 py-14">
      <p className="eyebrow">Selected · This week</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">Worth a look</h2>
      <div className="mt-6 grid gap-px border border-line bg-line sm:grid-cols-2">
        {deals.map((d) => (
          <a
            key={d.id}
            href={d.url ?? '#'}
            target={d.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-4 bg-white p-5 transition hover:bg-panel"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {d.featured && <span className="eyebrow text-accent">Featured</span>}
              </div>
              <h3 className="mt-1 truncate font-medium text-stone-900">{d.title}</h3>
              {d.description && (
                <p className="mt-0.5 truncate text-sm text-stone-500">{d.description}</p>
              )}
              {d.store?.name && (
                <p className="mt-1.5 text-xs text-stone-400">
                  {d.store.name}
                  {d.store.borough ? ` · ${d.store.borough}` : ''}
                </p>
              )}
            </div>
            <Ico
              name="arrow"
              className="h-5 w-5 shrink-0 text-stone-300 transition group-hover:text-stone-900"
            />
          </a>
        ))}
      </div>
    </section>
  )
}
