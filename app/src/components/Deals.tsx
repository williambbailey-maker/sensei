import { Ico } from './Ico'
import type { Deal } from '../lib/types'

export function Deals({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) return null
  return (
    <section className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-5 flex items-center gap-2">
        <Ico name="spark" className="h-5 w-5 text-accent" />
        <h2 className="text-xl font-semibold tracking-tight">Sparks &amp; Recs</h2>
      </div>
      <div className="grid gap-3">
        {deals.map((d) => (
          <a
            key={d.id}
            href={d.url ?? '#'}
            target={d.url ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-4 rounded-xl2 border border-ink-line bg-ink-card p-4 transition hover:border-accent/40"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {d.featured && (
                  <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[11px] font-medium text-accent-soft">
                    Featured
                  </span>
                )}
                <h3 className="truncate font-medium">{d.title}</h3>
              </div>
              {d.description && (
                <p className="mt-0.5 truncate text-sm text-zinc-400">{d.description}</p>
              )}
              {d.store?.name && (
                <p className="mt-1 text-xs text-zinc-500">
                  {d.store.name}
                  {d.store.borough ? ` · ${d.store.borough}` : ''}
                </p>
              )}
            </div>
            <Ico name="arrow" className="h-5 w-5 shrink-0 text-zinc-500" />
          </a>
        ))}
      </div>
    </section>
  )
}
