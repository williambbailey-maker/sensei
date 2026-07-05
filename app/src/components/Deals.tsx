import { Ico } from './Ico'
import type { Deal } from '../lib/types'

export function Deals({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) return null
  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <p className="eyebrow">Selected · This week</p>
      <h2 className="display mt-2 text-4xl text-black">Worth a look</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {deals.map((d) => (
          <a
            key={d.id}
            href={d.url ?? '#'}
            target={d.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-4 rounded-2xl bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {d.featured && <span className="eyebrow text-accent">Featured</span>}
              </div>
              <h3 className="mt-1 truncate font-medium text-black">{d.title}</h3>
              {d.description && (
                <p className="mt-0.5 truncate text-sm text-black/55">{d.description}</p>
              )}
              {d.store?.name && (
                <p className="mt-1.5 text-xs text-black/40">
                  {d.store.name}
                  {d.store.borough ? ` · ${d.store.borough}` : ''}
                </p>
              )}
            </div>
            <Ico
              name="arrow"
              className="h-5 w-5 shrink-0 text-black/25 transition group-hover:text-accent"
            />
          </a>
        ))}
      </div>
    </section>
  )
}
