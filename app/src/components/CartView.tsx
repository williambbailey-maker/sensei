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
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <button type="button" onClick={onBack} className="ghost">
          Keep shopping
        </button>
        <button type="button" onClick={onClear} className="ghost">
          Clear cart
        </button>
      </div>

      <h1 className="poster">{storeName}</h1>
      <div className="rule mt-3">
        <span>{String(count).padStart(2, '0')}</span>
      </div>
      <p className="meta mt-3 text-center">
        {count} item{count === 1 ? '' : 's'} · estimated minimum ${total.toFixed(2).replace(/\.00$/, '')}
      </p>

      <div className="mt-8">
        {cart.items.map(({ product: p, qty }) => (
          <div key={p.id} className="row">
            <span className="row-l">
              <span className={`thumb ${p.image_url ? '' : 'thumb-empty'}`}>
                {p.image_url ? <img src={p.image_url} alt="" /> : null}
              </span>
              <span className="min-w-0">
                <span className="label block truncate">{cleanTitle(p.clean_name ?? p.name ?? 'Unknown')}</span>
                <span className="meta block truncate">
                  {p.price_min != null ? `$${p.price_min} each` : 'price at store'}
                  {p.url && (
                    <>
                      {' · '}
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-ink">
                        Dutchie
                      </a>
                    </>
                  )}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <button type="button" onClick={() => onQty(p.id, -1)} aria-label="Remove one" className="ghost">
                −
              </button>
              <span className="label w-5 text-center">{qty}</span>
              <button type="button" onClick={() => onQty(p.id, 1)} aria-label="Add one" className="ghost">
                +
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <a href={menuUrl} target="_blank" rel="noopener noreferrer" className="dotcta">
          Order at {storeName}
        </a>
      </div>
      <p className="copy sentence mt-5 text-center">
        Dutchie doesn't accept carts filled from outside yet. Use this list on their menu; each item links
        straight to its page. Prices shown are menu minimums; final pricing and sizes are confirmed at checkout.
      </p>
    </div>
  )
}
