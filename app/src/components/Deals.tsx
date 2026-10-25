import { cleanTitle } from '../lib/labels'
import type { Deal } from '../lib/types'

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`

// The deals board on the home: the biggest real markdowns on the live menu
// right now, picked by refresh_deals() in Supabase after every scrape (one
// per shop, spread across product types). A row opens the item on the shop's
// menu. Hand-typed deals (kind 'manual') show their title as written.
export function Deals({ deals }: { deals: Deal[] }) {
  if (deals.length === 0) return null
  return (
    <section id="deals" className="wrap">
      <p className="k" style={{ marginTop: 26 }}>
        Deals
        <small>on the menu now</small>
      </p>
      <div className="board" style={{ marginTop: 18 }}>
        {deals.map((d) => {
          const name = d.kind === 'sale' ? cleanTitle(d.title, d.description) : d.title
          const sub = [d.kind === 'sale' ? d.description : null, d.store?.name, d.store?.borough].filter(Boolean).join(' · ')
          return (
            <a
              key={d.id}
              href={d.url ?? '#'}
              target={d.url ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="board-row"
            >
              <span className="min-w-0">
                <span className="block truncate">{name}</span>
                {sub && <span className="dim block truncate">{sub}</span>}
              </span>
              {d.price != null ? (
                <span className="deal-price">
                  {d.pct != null && d.pct > 0 && <span className="deal-pct">−{d.pct}%</span>}
                  {d.price_was != null && <span className="was">{money(d.price_was)}</span>}
                  <span>{money(d.price)}</span>
                </span>
              ) : (
                <span className="dim">→</span>
              )}
            </a>
          )
        })}
      </div>
    </section>
  )
}
