import { useEffect, useState } from 'react'
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

export function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  // Recorded so a visit that leaves here can be told from one that got past
  // the check and then left.
  useEffect(() => {
    track('age_gate_shown')
  }, [])
  // Nothing behind the gate is reachable, so the page must not scroll.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-field" style={{ touchAction: 'none' }}>
      <div className="wrap pb-16">
        <div className="top">
          <span className="wm">Sensei</span>
        </div>
        <h1 className="mark" style={{ marginTop: 54 }}>
          Are you
          <br />
          21 or
          <br />
          older?
        </h1>
        <p className="lede" style={{ marginTop: 22 }}>
          Cannabis products are for adults 21 and over in New York State.
        </p>
        <button
          type="button"
          onClick={() => {
            track('age_gate_yes')
            onConfirm()
          }}
          className="cta"
          style={{ marginTop: 34 }}
        >
          <span>Yes, I'm 21 or older</span>
        </button>
        <a
          href="https://www.google.com"
          className="ghost mt-6 inline-block"
          onClick={(e) => {
            // Leaving the site: give the event a moment to send first.
            e.preventDefault()
            track('age_gate_no')
            setTimeout(() => location.assign('https://www.google.com'), 250)
          }}
        >
          I'm under 21
        </a>
      </div>
    </div>
  )
}
