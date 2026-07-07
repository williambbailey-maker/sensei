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
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-paper px-6">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[3px] bg-accent font-display text-[26px] leading-none text-paper">
          先
        </span>
        <h1 className="display mt-7 text-4xl">Welcome to Sensei</h1>
        <p className="prose-jp mx-auto mt-4 max-w-[46ch] text-center">
          You must be 21 or older to enter. Cannabis products are for adult use only in New York
          State.
        </p>
        <button
          onClick={onConfirm}
          className="mt-9 w-full max-w-xs bg-accent px-5 py-3.5 font-grotesk text-[0.72rem] uppercase tracking-label text-paper transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent-soft"
        >
          I'm 21 or older
        </button>
        <a
          href="https://www.google.com"
          className="link-underline mx-auto mt-5 block w-fit font-grotesk text-[0.72rem] uppercase tracking-label text-ink-soft"
        >
          I'm under 21
        </a>
      </div>
    </div>
  )
}
