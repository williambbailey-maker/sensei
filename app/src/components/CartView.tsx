import { cleanTitle, prettyStore } from '../lib/labels'
import type { Cart } from '../lib/types'
import { Trail } from './Trail'
import { track } from '../lib/analytics'

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
  // The shop's own menu; the Dutchie pattern only for a store row that predates menu_url.
  const menuUrl = cart.store.menu_url ?? `https://dutchie.com/dispensary/${cart.store.slug}`

  return (
    <div className="wrap wrap-mid" style={{ paddingTop: 28 }}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <Trail stops={[{ label: 'Results', onClick: onBack }, { label: 'Cart' }]} onBack={onBack} backLabel="Keep shopping" />
        </div>
        <button type="button" onClick={onClear} className="ghost shrink-0" style={{ marginTop: 12 }}>
          Clear cart
        </button>
      </div>

      <h1 className="poster" style={{ marginTop: 26 }}>
        {storeName}
      </h1>
      <p className="meta" style={{ marginTop: 10 }}>
        {count} item{count === 1 ? '' : 's'} · estimated minimum ${total.toFixed(2).replace(/\.00$/, '')}
      </p>

      <div style={{ marginTop: 20 }}>
        {cart.items.map(({ product: p, qty }) => (
          <div key={p.id} className="row">
            <span className="row-l">
              <span className="thumb">{p.image_url ? <img src={p.image_url} alt="" /> : null}</span>
              <span className="min-w-0">
                <span className="label block truncate">{cleanTitle(p.clean_name ?? p.name ?? 'Unknown', p.clean_brand ?? p.brand)}</span>
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

      <a
        href={menuUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="cta"
        style={{ marginTop: 28 }}
        onClick={() => track('order_click', { dispensary: cart.store.slug, url: menuUrl, items: count })}
      >
        <span>Order at {storeName}</span>
      </a>
      <p className="meta" style={{ marginTop: 14 }}>
        Shop menus don't accept carts filled from outside yet. Use this list on {storeName}'s menu; each
        item links straight to its page. Prices shown are menu minimums; final pricing and sizes are confirmed at checkout.
      </p>
    </div>
  )
}
