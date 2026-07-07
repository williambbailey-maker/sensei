import { Ico } from './Ico'
import { Reveal } from './motion'
import type { Deal } from '../lib/types'

export function Deals({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) return null
  return (
    <section className="mx-auto max-w-[1240px] px-[clamp(24px,6vw,120px)] pt-[clamp(6vh,9vh,120px)]">
      <Reveal className="border-t border-hairline pt-12">
        <p className="eyebrow">Selected · This week</p>
        <h2 className="display mt-3 text-[clamp(2rem,5vw,3.25rem)]">Worth a look</h2>
        <div className="mt-8 grid grid-cols-1 gap-px bg-hairline sm:grid-cols-2">
          {deals.map((d) => (
            <a
              key={d.id}
              href={d.url ?? '#'}
              target={d.url ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-4 bg-paper p-7 transition-colors duration-300 hover:bg-paper-2"
            >
              <div className="min-w-0">
                {d.featured && (
                  <span className="font-grotesk text-[0.68rem] uppercase tracking-label text-accent">
                    Featured
                  </span>
                )}
                <h3 className="mt-1 truncate font-sans text-lg font-medium text-ink">{d.title}</h3>
                {d.description && (
                  <p className="mt-0.5 truncate text-sm text-ink-soft">{d.description}</p>
                )}
                {d.store?.name && (
                  <p className="mt-2 font-grotesk text-[0.68rem] uppercase tracking-label text-ink-soft">
                    {d.store.name}
                    {d.store.borough ? ` · ${d.store.borough}` : ''}
                  </p>
                )}
              </div>
              <Ico
                name="arrow"
                className="h-5 w-5 shrink-0 text-ink-soft transition-all duration-300 group-hover:translate-x-1 group-hover:text-accent"
              />
            </a>
          ))}
        </div>
      </Reveal>
    </section>
  )
}
