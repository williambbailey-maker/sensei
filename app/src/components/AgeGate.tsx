import { useState } from 'react'

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
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-field">
      {/* A 10px white strip like .bar, without being a second .bar in the DOM. */}
      <div style={{ height: 10, background: '#fff' }} />
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
        <button type="button" onClick={onConfirm} className="cta" style={{ marginTop: 34 }}>
          <span>Yes, I'm 21 or older</span>
        </button>
        <a href="https://www.google.com" className="ghost mt-6 inline-block">
          I'm under 21
        </a>
      </div>
    </div>
  )
}
