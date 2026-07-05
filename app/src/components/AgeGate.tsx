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
      <div className="w-full max-w-sm rounded-3xl bg-white p-9 text-center shadow-[0_2px_24px_rgba(0,0,0,0.12)] animate-fade-up">
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-sand"
          aria-hidden="true"
        >
          <span className="display text-2xl text-paper">先</span>
        </div>
        <p className="eyebrow">New York · Cannabis</p>
        <h1 className="display mt-3 text-4xl text-black">Welcome to Sensei</h1>
        <p className="mt-3 text-sm leading-relaxed text-black/60">
          You must be 21 or older to enter. Cannabis products are for adult use only in New York
          State.
        </p>
        <button
          onClick={onConfirm}
          className="mt-7 w-full rounded-full bg-black px-5 py-3 font-medium text-paper transition hover:bg-neutral-800"
        >
          I'm 21 or older
        </button>
        <a
          href="https://www.google.com"
          className="mt-3 block text-xs text-black/40 transition hover:text-accent"
        >
          I'm under 21
        </a>
      </div>
    </div>
  )
}
