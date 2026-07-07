import { Ico } from './Ico'
import { cleanTitle, prettyStore } from '../lib/labels'
import type { Cart } from '../lib/types'

// The dummy cart: one store, quantities, a running minimum total, and the
// hand-off to Dutchie. Dutchie doesn't accept prefilled carts from outside,
// so the hand-off is: open the store's menu (or a specific item) and add
// there — this list is the shopping list.
export function CartView({
  cart,
  onQty,
  onClear,
  onBack,
}: {
  cart: Cart
  onQty: (productId: string, delta: number) => void
  onClear: () => void
  onBack: () => void
}) {
  const storeName = cart.store.name ?? prettyStore(cart.store.slug)
  const count = cart.items.reduce((n, i) => n + i.qty, 0)
  const total = cart.items.reduce((s, i) => s + (i.product.price_min ?? 0) * i.qty, 0)
  const menuUrl = `https://dutchie.com/dispensary/${cart.store.slug}`

  return (
    <div className="mx-auto max-w-3xl px-[clamp(24px,6vw,120px)] py-[clamp(5vh,8vh,100px)]">
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 font-grotesk text-[0.72rem] uppercase tracking-label text-ink-soft transition-colors hover:text-accent"
        >
          <Ico name="back" className="h-4 w-4" /> Keep shopping
        </button>
        <button
          onClick={onClear}
          className="link-underline font-grotesk text-[0.72rem] uppercase tracking-label text-ink-soft"
        >
          Clear cart
        </button>
      </div>

      <p className="eyebrow">Your cart · {storeName}</p>
      <h1 className="display mt-3 text-[clamp(2.25rem,6vw,4rem)] leading-none">
        {count} item{count === 1 ? '' : 's'}
      </h1>

      <div className="mt-8 border-t border-hairline">
        {cart.items.map(({ product: p, qty }) => (
          <div key={p.id} className="flex items-center gap-4 border-b border-hairline py-5">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[2px] border border-hairline bg-paper-2">
              {p.image_url ? (
                <img src={p.image_url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="max-h-[2.6em] overflow-hidden font-sans text-[15px] font-medium leading-[1.3] text-ink">
                {cleanTitle(p.clean_name ?? p.name ?? 'Unknown')}
              </h3>
              <p className="mt-1 font-grotesk text-[0.68rem] uppercase tracking-label text-ink-soft">
                {p.price_min != null ? `$${p.price_min} each` : 'price at store'}
                {p.url && (
                  <>
                    {' · '}
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      view on Dutchie ↗
                    </a>
                  </>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => onQty(p.id, -1)}
                aria-label="Remove one"
                className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-hairline text-ink transition-colors hover:border-accent hover:text-accent"
              >
                −
              </button>
              <span className="w-6 text-center font-grotesk text-sm tabular-nums">{qty}</span>
              <button
                onClick={() => onQty(p.id, 1)}
                aria-label="Add one"
                className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-hairline text-ink transition-colors hover:border-accent hover:text-accent"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="font-grotesk text-[0.72rem] uppercase tracking-label text-ink-soft">
          Estimated minimum
        </span>
        <span className="display text-3xl text-ink">${total.toFixed(2).replace(/\.00$/, '')}</span>
      </div>

      <a
        href={menuUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group mt-8 flex w-full items-center justify-center gap-2 bg-accent px-5 py-4 font-grotesk text-[0.72rem] uppercase tracking-label text-paper transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent-soft"
      >
        Order at {storeName} on Dutchie
        <Ico name="external" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </a>
      <p className="prose-jp mt-4 text-center">
        Dutchie doesn't accept carts filled from outside yet — use this list on their menu; each item
        links straight to its page. Prices shown are menu minimums; final pricing and sizes are
        confirmed at checkout.
      </p>
    </div>
  )
}
