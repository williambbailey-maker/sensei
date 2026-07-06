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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/95 px-6 backdrop-blur">
      <div className="w-full max-w-sm rounded-[40px] border border-line bg-white p-10 text-center animate-scale-in">
        <p className="eyebrow">New York · Cannabis</p>
        <h1 className="display mt-4 text-4xl">Welcome to Sensei</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          You must be 21 or older to enter. Cannabis products are for adult use only in New York
          State.
        </p>
        <button
          onClick={onConfirm}
          className="mt-8 w-full rounded-full bg-accent px-5 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:scale-[1.02] hover:shadow-[0_7px_29px_rgba(46,74,59,0.28)]"
        >
          I'm 21 or older
        </button>
        <a
          href="https://www.google.com"
          className="mt-4 block text-xs uppercase tracking-wide text-muted transition hover:text-accent hover:underline"
        >
          I'm under 21
        </a>
      </div>
    </div>
  )
}
