import { useEffect, useRef, useState } from 'react'
import { track } from '../lib/analytics'

const KEY = 'sensei_age_ok'

export function useAgeGate(): [boolean, () => void] {
  const [ok, setOk] = useState<boolean>(() => localStorage.getItem(KEY) === 'true')
  const confirm = () => {
    localStorage.setItem(KEY, 'true')
    setOk(true)
  }
  return [ok, confirm]
}

// The 21+ question as a sheet pinned to the bottom of the screen. The page
// behind it renders at full strength from the first frame (so an ad visitor
// sees the product straight away) but can't be used until they answer: App
// marks everything else `inert`, and the page stays scrolled to the top.
// Events carry variant 'sheet' to tell them from the old full-screen gate.
export function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  const yes = useRef<HTMLButtonElement>(null)
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    track('age_gate_shown', { variant: 'sheet' })
    yes.current?.focus({ preventScroll: true })
  }, [])

  // Keep the page at the top and unscrollable while the sheet is up. The
  // scrollbar's space stays reserved, so nothing shifts on desktop when the
  // sheet closes and the scrollbar comes back.
  useEffect(() => {
    const html = document.documentElement
    const prev = { html: html.style.overflow, body: document.body.style.overflow, gutter: html.style.scrollbarGutter }
    html.style.scrollbarGutter = 'stable'
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    const top = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0)
    }
    top()
    window.addEventListener('scroll', top, { passive: true })
    return () => {
      html.style.overflow = prev.html
      html.style.scrollbarGutter = prev.gutter
      document.body.style.overflow = prev.body
      window.removeEventListener('scroll', top)
    }
  }, [])

  // Tab cycles between the two answers; focus never leaves the sheet. Any key
  // turns the focus ring on (see .agesheet[data-keys] in index.css).
  const trap = (e: React.KeyboardEvent) => {
    sheet.current?.setAttribute('data-keys', '')
    if (e.key !== 'Tab' || !sheet.current) return
    const items = [...sheet.current.querySelectorAll<HTMLElement>('button, a[href]')]
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div ref={sheet} className="agesheet" role="dialog" aria-modal="true" aria-labelledby="agesheet-q" onKeyDown={trap}>
      <div className="wrap">
        <div className="agesheet-in">
          <h2 id="agesheet-q" className="agesheet-q">
            Are you 21 or older?
          </h2>
          <p className="agesheet-note">Cannabis products are for adults 21 and over in New York State.</p>
          <div className="agesheet-row">
            <button
              ref={yes}
              type="button"
              onClick={() => {
                track('age_gate_yes', { variant: 'sheet' })
                onConfirm()
              }}
              className="cta"
            >
              <span>Yes, I'm 21 or older</span>
            </button>
            <a
              href="https://www.google.com"
              className="ghost"
              onClick={(e) => {
                // Leaving the site: give the event a moment to send first.
                e.preventDefault()
                track('age_gate_no', { variant: 'sheet' })
                setTimeout(() => location.assign('https://www.google.com'), 250)
              }}
            >
              I'm under 21
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
