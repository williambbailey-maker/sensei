import { Ico } from './Ico'
import { vibeLabel } from '../lib/labels'
import type { Product } from '../lib/types'

const TIER_STYLE: Record<string, string> = {
  mild: 'bg-emerald-500/15 text-emerald-300',
  medium: 'bg-amber-500/15 text-amber-300',
  strong: 'bg-rose-500/15 text-rose-300',
}

export function ProductCard({ p }: { p: Product }) {
  const name = p.clean_name ?? p.name ?? 'Unknown'
  const brand = p.clean_brand ?? p.brand
  const price = p.price_min != null ? `$${formatPrice(p.price_min)}` : '—'
  const weights = p.variants?.map((v) => v.weight).filter(Boolean) as string[]

  return (
    <div className="group flex gap-4 rounded-xl2 border border-ink-line bg-ink-card p-3 transition hover:border-zinc-600">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-ink-soft">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-medium leading-tight">{name}</h3>
            {brand && <p className="truncate text-sm text-zinc-400">{brand}</p>}
          </div>
          <div className="shrink-0 text-right">
            <div className="font-semibold">{price}</div>
            {weights?.length > 0 && (
              <div className="text-[11px] text-zinc-500">{weights.join(' · ')}</div>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {p.potency_tier && (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize ${
                TIER_STYLE[p.potency_tier] ?? 'bg-zinc-700/40 text-zinc-300'
              }`}
            >
              {p.potency_tier}
              {p.thc_pct != null && p.category !== 'edibles' ? ` · ${p.thc_pct}% THC` : ''}
            </span>
          )}
          {p.strain_type && (
            <span className="rounded-md bg-zinc-700/40 px-1.5 py-0.5 text-[11px] text-zinc-300">
              {p.strain_type}
            </span>
          )}
          {(p.vibes ?? []).slice(0, 2).map((v) => (
            <span key={v} className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent-soft">
              {vibeLabel(v)}
            </span>
          ))}
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="truncate text-xs text-zinc-500">
            {p.store?.name ?? p.store?.slug}
            {p.store?.borough ? ` · ${p.store.borough}` : ''}
          </p>
          {p.url && (
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 rounded-lg border border-ink-line px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:border-accent/50 hover:text-white"
            >
              View <Ico name="external" className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function formatPrice(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(2)
}
