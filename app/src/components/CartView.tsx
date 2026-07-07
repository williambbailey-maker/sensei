import { Ico } from './Ico'
import { cleanTitle, prettyStore } from '../lib/labels'
import type { Cart } from '../lib/types'

// The dummy cart: one store, quantities, a running minimum total, and the
// hand-off to Dutchie (which can't accept prefilled carts from outside).
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
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 label text-[13px] text-cobalt transition hover:text-magenta"
        >
          <Ico name="back" className="h-4 w-4" /> Keep shopping
        </button>
        <button
          onClick={onClear}
          className="rounded-full border-3 border-ink bg-white px-4 py-1.5 label text-[12px] text-ink transition hover:bg-tomato hover:text-white"
        >
          Clear cart
        </button>
      </div>

      <p className="eyebrow text-magenta">Your cart · {storeName}</p>
      <h1 className="display mt-2 text-[clamp(2.75rem,9vw,5rem)] text-cobalt">
        {count} item{count === 1 ? '' : 's'}
      </h1>

      <div className="mt-6 flex flex-col gap-3">
        {cart.items.map(({ product: p, qty }) => (
          <div key={p.id} className="flex items-center gap-4 rounded-2xl border-3 border-ink bg-white p-4 shadow-[4px_4px_0_#384166]">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-3 border-ink bg-ice">
              {p.image_url ? <img src={p.image_url} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="max-h-[2.6em] overflow-hidden text-[15px] font-bold leading-[1.3] text-ink">
                {cleanTitle(p.clean_name ?? p.name ?? 'Unknown')}
              </h3>
              <p className="mt-1 label text-[10px] text-muted">
                {p.price_min != null ? `$${p.price_min} each` : 'price at store'}
                {p.url && (
                  <>
                    {' · '}
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-magenta hover:underline">
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
                className="flex h-9 w-9 items-center justify-center rounded-full border-3 border-ink bg-white text-lg text-ink transition hover:bg-ice"
              >
                −
              </button>
              <span className="w-6 text-center display text-lg text-cobalt">{qty}</span>
              <button
                onClick={() => onQty(p.id, 1)}
                aria-label="Add one"
                className="flex h-9 w-9 items-center justify-center rounded-full border-3 border-ink bg-white text-lg text-ink transition hover:bg-ice"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-2xl border-3 border-ink bg-sun px-6 py-4 shadow-[4px_4px_0_#384166]">
        <span className="label text-[13px] text-ink">Estimated minimum</span>
        <span className="display text-3xl text-cobalt">${total.toFixed(2).replace(/\.00$/, '')}</span>
      </div>

      <a
        href={menuUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="pop-press mt-6 flex w-full items-center justify-center gap-2 rounded-full border-3 border-ink bg-cobalt px-5 py-4 display text-xl text-white"
      >
        Order at {storeName} on Dutchie →
      </a>
      <p className="mt-3 text-center text-xs font-medium text-muted">
        Dutchie doesn't accept carts filled from outside yet — use this list on their menu; each item
        links straight to its page. Prices shown are menu minimums; final pricing and sizes are
        confirmed at checkout.
      </p>
    </div>
  )
}
