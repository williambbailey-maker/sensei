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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-onyx px-6">
      <div className="glass w-full max-w-sm rounded-[32px] p-9 text-center shadow-soft-lg">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow display text-[26px] font-black leading-none text-onyx">
          S
        </span>
        <h1 className="display mt-5 text-3xl font-black text-white">Welcome to sensei</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-muted">
          You must be 21 or older to enter. Cannabis products are for adult use only in New York State.
        </p>
        <button
          onClick={onConfirm}
          className="pop-press mt-7 w-full rounded-full bg-yellow px-5 py-3.5 label text-sm text-onyx"
        >
          I'm 21 or older
        </button>
        <a
          href="https://www.google.com"
          className="mt-4 block label text-[12px] text-muted transition hover:text-ink"
        >
          I'm under 21
        </a>
      </div>
    </div>
  )
}
