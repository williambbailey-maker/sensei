import { useState } from 'react'
import { StickerCookie, StickerLeaf, StickerStar } from './pop'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-cobalt px-6">
      <StickerCookie className="absolute left-8 top-16 h-20 w-20 rotate-12" />
      <StickerStar className="absolute right-10 top-24 h-14 w-14 -rotate-6" />
      <StickerLeaf className="absolute bottom-20 left-12 h-16 w-16 rotate-6" />
      <div className="relative w-full max-w-sm rounded-3xl border-3 border-ink bg-white p-9 text-center shadow-[6px_6px_0_#111]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-3 border-ink bg-cobalt font-display text-[28px] leading-none text-white">
          先
        </span>
        <h1 className="display mt-5 text-4xl text-cobalt">Welcome to Sensei</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-muted">
          You must be 21 or older to enter. Cannabis products are for adult use only in New York State.
        </p>
        <button
          onClick={onConfirm}
          className="mt-7 w-full rounded-full border-3 border-ink bg-magenta px-5 py-3.5 display text-xl text-white shadow-[4px_4px_0_#111] transition hover:-translate-y-0.5"
        >
          I'm 21 or older
        </button>
        <a
          href="https://www.google.com"
          className="mt-4 block label text-[12px] text-muted transition hover:text-magenta"
        >
          I'm under 21
        </a>
      </div>
    </div>
  )
}
