import { useCallback, useState } from 'react'
import { ProductDetail } from './ProductDetail'
import { eventProps } from './ProductCard'
import { cleanTitle } from '../lib/labels'
import { track } from '../lib/analytics'
import type { Deal, Product } from '../lib/types'

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`

// The deals board on the home: the top of the pick refresh_deals() makes in
// Supabase after every scrape, five rows from five different shops, then a
// link to the whole list (/deals). A row opens the product detail; the
// products arrive separately (`products`), and a row whose product hasn't
// loaded opens the item on the shop's menu instead. Hand-typed deals (kind
// 'manual') show their title as written and always link out.
export function Deals({
  deals,
  products,
  onAll,
  onAdd,
}: {
  deals: Deal[]
  products: Product[]
  onAll: () => void
  onAdd?: (p: Product) => void
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const top = topFive(deals)
  const items = top.map((d) => (d.product_id ? products.find((p) => p.id === d.product_id) : undefined))
  const openable = items.filter((p): p is Product => !!p)
  const stepDetail = useCallback(
    (delta: 1 | -1) =>
      setOpenIndex((i) => {
        if (i == null) return i
        const n = i + delta
        if (n < 0 || n >= openable.length) return i
        track('product_view', { ...eventProps(openable[n]), via: 'arrow' })
        return n
      }),
    [openable],
  )

  if (top.length === 0) return null
  const open = openIndex != null ? openable[openIndex] : null

  return (
    <section id="deals" className="wrap">
      <p className="k" style={{ marginTop: 26 }}>
        Deals
        <small>on the menu now</small>
      </p>
      <div className="board" style={{ marginTop: 18 }}>
        {top.map((d, i) => {
          const name = d.kind === 'sale' ? cleanTitle(d.title, d.description) : d.title
          const sub = [d.kind === 'sale' ? d.description : null, d.store?.name, d.store?.borough].filter(Boolean).join(' · ')
          const p = items[i]
          const body = (
            <>
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
            </>
          )
          return p ? (
            <button
              key={d.id}
              type="button"
              className="board-row"
              onClick={() => {
                track('deal_open', { ...eventProps(p), where: 'home', rank: d.sort, pct: d.pct })
                setOpenIndex(openable.indexOf(p))
              }}
            >
              {body}
            </button>
          ) : (
            <a
              key={d.id}
              href={d.url ?? '#'}
              target={d.url ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="board-row"
              onClick={() =>
                track('deal_click', {
                  dispensary: d.store?.slug ?? null,
                  brand: d.kind === 'sale' ? d.description : null,
                  url: d.url,
                  pct: d.pct,
                  rank: d.sort,
                })
              }
            >
              {body}
            </a>
          )
        })}
      </div>
      <button
        type="button"
        className="board-all"
        onClick={() => {
          track('deals_all', { where: 'home' })
          onAll()
        }}
      >
        <span>See all deals</span>
        <span aria-hidden="true">→</span>
      </button>
      {open && openIndex != null && (
        <ProductDetail
          p={open}
          index={openIndex}
          total={openable.length}
          alsoAt={null}
          lowest={null}
          onClose={() => setOpenIndex(null)}
          onStep={stepDetail}
          onAdd={onAdd}
        />
      )}
    </section>
  )
}

// The first five of the pick from five different shops (the pick allows up
// to ten per shop further down the list). Hand-typed deals keep their place.
export function topFive(deals: Deal[]): Deal[] {
  const seen = new Set<string>()
  const out: Deal[] = []
  for (const d of deals) {
    const shop = d.store?.slug ?? d.store?.name ?? d.id
    if (d.kind === 'sale' && seen.has(shop)) continue
    seen.add(shop)
    out.push(d)
    if (out.length === 5) break
  }
  return out
}
