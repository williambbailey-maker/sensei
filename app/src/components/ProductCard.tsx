import { Ico } from './Ico'
import { formatMiles, haversineMiles } from '../lib/geo'
import { prettyStore, vibeLabel } from '../lib/labels'
import type { LatLng, Product } from '../lib/types'

// Potency as a small colored dot: green mild, amber medium, red strong —
// straight from the reference palette.
const TIER_DOT: Record<string, string> = {
  mild: 'bg-slate',
  medium: 'bg-ochre',
  strong: 'bg-clay',
}

export function ProductCard({ p, userLoc }: { p: Product; userLoc?: LatLng | null }) {
  const name = p.clean_name ?? p.name ?? 'Unknown'
  const brand = p.clean_brand ?? p.brand
  const price = p.price_min != null ? `$${formatPrice(p.price_min)}` : '—'
  const weights = p.variants?.map((v) => v.weight).filter(Boolean) as string[]
  const miles =
    userLoc && p.store?.lat != null && p.store?.lng != null
      ? haversineMiles(userLoc, { lat: p.store.lat, lng: p.store.lng })
      : null

  return (
    <div className="group flex gap-4 rounded-[28px] border border-line bg-white p-4 transition hover:scale-[1.01]">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[18px] border border-line bg-paper">
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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-medium leading-tight text-black">{name}</h3>
            {brand && <p className="truncate text-sm text-muted">{brand}</p>}
          </div>
          <div className="shrink-0 text-right">
            <div className="display text-lg">{price}</div>
            {weights?.length > 0 && (
              <div className="text-[11px] text-muted">{weights.slice(0, 3).join(' · ')}</div>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] uppercase tracking-wide text-muted">
          {p.potency_tier && (
            <span className="inline-flex items-center gap-1.5 capitalize">
              <span
                className={`h-1.5 w-1.5 rounded-full ${TIER_DOT[p.potency_tier] ?? 'bg-line'}`}
              />
              {p.potency_tier}
              {p.thc_pct != null && p.category !== 'edibles' ? ` · ${p.thc_pct}% THC` : ''}
            </span>
          )}
          {p.strain_type && <span>{p.strain_type}</span>}
          {(p.vibes ?? []).slice(0, 2).map((v) => (
            <span key={v} className="text-accent">
              {vibeLabel(v)}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="truncate text-xs uppercase tracking-wide text-muted">
            {p.store?.name ?? (p.store?.slug ? prettyStore(p.store.slug) : 'Dispensary')}
            {p.store?.neighborhood
              ? ` · ${p.store.neighborhood}`
              : p.store?.borough
                ? ` · ${p.store.borough}`
                : ''}
            {miles != null && <span className="text-accent"> · {formatMiles(miles)}</span>}
          </p>
          {p.url && (
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-medium uppercase tracking-wide text-black transition hover:border-accent hover:text-accent"
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
