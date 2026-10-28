import { useEffect, useRef } from 'react'
import { track } from '../lib/analytics'
import { prettyStore } from '../lib/labels'
import { WAYS, type Way } from './Ways'
import type { Cart } from '../lib/types'

// What a menu row does: one of the four ways in, or a screen in the app.
export type MenuTarget = Way | 'deals' | 'cart'

type Item = {
  n?: string
  bullet?: { letter: string; color: string; dark?: boolean }
  title: string
  desc: string
  target?: MenuTarget
  href?: string
}

// The menu: a full-screen sheet on the field, four groups of rows. The Find
// group carries the same lettered line bullets as the home screen.
export function Menu({
  open,
  onClose,
  current,
  storeCount,
  hoodCount,
  cart,
  onGo,
}: {
  open: boolean
  onClose: () => void
  current: MenuTarget | null
  storeCount: number | null
  hoodCount: number | null
  cart: Cart | null
  onGo: (t: MenuTarget) => void
}) {
  // Body scroll lock, Escape, and the browser back button all close it. The
  // close handler is read through a ref so a new function identity on each
  // render doesn't re-run (and un-push) the history entry.
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    const onPop = () => closeRef.current()
    window.addEventListener('keydown', onKey)
    try {
      history.pushState({ menu: true }, '')
      window.addEventListener('popstate', onPop)
    } catch {
      /* history unavailable — Escape and the X still work */
    }
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', onPop)
      try {
        if (history.state?.menu) history.back()
      } catch {
        /* ignore */
      }
    }
  }, [open])

  if (!open) return null

  const cartCount = cart?.items.reduce((n, i) => n + i.qty, 0) ?? 0
  const cartDesc = cart
    ? `${cartCount} item${cartCount === 1 ? '' : 's'} · ${cart.store.name ?? prettyStore(cart.store.slug)}`
    : 'Empty'

  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Find',
      items: WAYS.map((w) => ({
        bullet: { letter: w.letter, color: w.color, dark: w.dark },
        title: w.title,
        desc: w.key === 'search' ? 'Strain, brand, price or neighborhood' : w.desc,
        target: w.key,
      })),
    },
    {
      title: 'Browse',
      items: [
        {
          title: 'Neighborhoods',
          desc: `${hoodCount ?? '—'} areas · ${storeCount ?? '—'} shops`,
          href: '/neighborhoods/',
        },
        { title: 'Brands', desc: 'Ayrloom, MFNY, Ruby Farms…', href: '/brands/' },
        { title: 'Products', desc: 'Flower · pre-rolls · vapes · edibles', href: '/nyc/' },
      ],
    },
    {
      title: 'You',
      items: [{ title: 'Cart', desc: cartDesc, target: 'cart' }],
    },
  ]

  // Closing steps history back off the menu's entry, and that step lands
  // after this render. Open the new screen once it has, or the step back
  // would undo the screen and return to where the menu was opened.
  const pick = (it: Item) => {
    track('menu_pick', { item: it.title.toLowerCase() })
    if (!it.target) return
    const to = it.target !== current ? it.target : null
    let onMenuEntry = false
    try {
      onMenuEntry = !!history.state?.menu
    } catch {
      /* history unavailable */
    }
    if (to && onMenuEntry) {
      let done = false
      const go = () => {
        if (done) return
        done = true
        window.removeEventListener('popstate', go)
        onGo(to)
      }
      window.addEventListener('popstate', go)
      setTimeout(go, 500)
    }
    onClose()
    if (to && !onMenuEntry) onGo(to)
  }

  return (
    <div className="menu menu-in" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="wrap" style={{ padding: 0 }}>
        <div className="top">
          <span className="wm">Sensei</span>
          <button type="button" onClick={onClose} className="mnu" aria-label="Close menu">
            Close ✕
          </button>
        </div>

        <div className="menu-groups">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="k" style={{ marginTop: 30 }}>
              {g.title}
            </p>
            <div className="mt-2" style={{ borderTop: '2px solid #fff' }}>
              {g.items.map((it) => {
                const inner = (
                  <>
                    <span className="mi-l">
                      {it.bullet && (
                        <span className={`mb s ${it.bullet.dark ? 'y' : ''}`} style={{ background: it.bullet.color }}>
                          {it.bullet.letter}
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="mi-t">{it.title}</span>
                        <span className="mi-d">{it.desc}</span>
                      </span>
                    </span>
                    <span className="mi-a" aria-hidden="true">
                      →
                    </span>
                  </>
                )
                const cls = `mi ${it.target && it.target === current ? 'mi-now' : ''}`
                return it.href ? (
                  <a key={it.title} href={it.href} className={cls} onClick={() => track('menu_pick', { item: it.title.toLowerCase() })}>
                    {inner}
                  </a>
                ) : (
                  <button key={it.title} type="button" className={cls} onClick={() => pick(it)}>
                    {inner}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        </div>

        <div className="menu-extra">
          <div>
            <p className="k" style={{ marginTop: 30 }}>
              About
            </p>
            <p className="copy mt-2" style={{ color: 'rgba(255,255,255,.6)' }}>
              Sensei is an independent guide to New York's licensed dispensaries. Prices and stock come from each
              shop's live menu and refresh nightly. We don't sell anything (<u>including your personal information</u>); you
              order on the dispensary's own site.
            </p>
            <p className="meta mt-4">21+ only · adults in New York State</p>
          </div>
        </div>
      </div>
    </div>
  )
}
