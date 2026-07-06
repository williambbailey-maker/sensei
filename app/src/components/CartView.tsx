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
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm uppercase tracking-wide text-muted transition hover:text-accent hover:underline"
        >
          <Ico name="back" className="h-4 w-4" /> Keep shopping
        </button>
        <button
          onClick={onClear}
          className="rounded-full border border-line px-4 py-1.5 text-[13px] uppercase tracking-wide text-muted transition hover:border-clay hover:text-clay"
        >
          Clear cart
        </button>
      </div>

      <p className="eyebrow">Your cart · {storeName}</p>
      <h1 className="display mt-1 text-5xl">
        {count} item{count === 1 ? '' : 's'}
      </h1>

      <div className="mt-6 flex flex-col gap-3">
        {cart.items.map(({ product: p, qty }) => (
          <div
            key={p.id}
            className="flex items-center gap-4 rounded-[28px] border border-line bg-white p-4"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px] border border-line bg-paper">
              {p.image_url ? (
                <img src={p.image_url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 font-medium leading-tight text-black">
                {cleanTitle(p.clean_name ?? p.name ?? 'Unknown')}
              </h3>
              <p className="mt-0.5 text-xs uppercase tracking-wide text-muted">
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
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-black transition hover:border-accent hover:text-accent"
              >
                −
              </button>
              <span className="w-6 text-center font-medium">{qty}</span>
              <button
                onClick={() => onQty(p.id, 1)}
                aria-label="Add one"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-black transition hover:border-accent hover:text-accent"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-[28px] border border-line bg-white px-6 py-4">
        <span className="text-[13px] uppercase tracking-wide text-muted">Estimated minimum</span>
        <span className="display text-2xl">${total.toFixed(2).replace(/\.00$/, '')}</span>
      </div>

      <a
        href={menuUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-4 text-sm font-bold uppercase tracking-wide text-white transition hover:scale-[1.02] hover:shadow-[0_7px_29px_rgba(0,0,139,0.2)]"
      >
        Order at {storeName} on Dutchie <Ico name="external" className="h-4 w-4" />
      </a>
      <p className="mt-3 text-center text-xs text-muted">
        Dutchie doesn't accept carts filled from outside yet — use this list on their menu; each
        item links straight to its page. Prices shown are menu minimums; final pricing and sizes
        are confirmed at checkout.
      </p>
    </div>
  )
}
