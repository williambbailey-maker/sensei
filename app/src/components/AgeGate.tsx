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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 px-6 backdrop-blur">
      <div className="w-full max-w-sm rounded-xl2 border border-ink-line bg-ink-card p-8 text-center animate-fade-up">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-2xl font-semibold text-accent">
          先
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Sensei</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          You must be 21 or older to enter. Cannabis products are for adult use only in New York
          State.
        </p>
        <button
          onClick={onConfirm}
          className="mt-6 w-full rounded-xl bg-accent px-5 py-3 font-medium text-ink transition hover:bg-accent-soft"
        >
          I'm 21 or older
        </button>
        <a
          href="https://www.google.com"
          className="mt-3 block text-xs text-zinc-500 transition hover:text-zinc-300"
        >
          I'm under 21
        </a>
      </div>
    </div>
  )
}
