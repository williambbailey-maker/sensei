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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/90 px-6 backdrop-blur">
      <div className="w-full max-w-sm border border-line bg-white p-9 text-center animate-fade-up">
        <div className="mx-auto mb-6 grid grid-cols-2 gap-px" aria-hidden="true">
          <span className="h-4 w-4 bg-clay" />
          <span className="h-4 w-4 bg-sand" />
          <span className="h-4 w-4 bg-slate" />
          <span className="h-4 w-4 bg-accent" />
        </div>
        <p className="eyebrow">New York · Cannabis</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-stone-900">Welcome to Sensei</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          You must be 21 or older to enter. Cannabis products are for adult use only in New York
          State.
        </p>
        <button
          onClick={onConfirm}
          className="mt-7 w-full bg-stone-900 px-5 py-3 font-medium text-paper transition hover:bg-stone-700"
        >
          I'm 21 or older
        </button>
        <a
          href="https://www.google.com"
          className="mt-3 block text-xs text-stone-400 transition hover:text-stone-600"
        >
          I'm under 21
        </a>
      </div>
    </div>
  )
}
