import { useState } from 'react'
import { FloatSticker, StickerCookie, StickerLeaf, StickerStar } from './pop'

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
      <FloatSticker seed={1} className="absolute left-8 top-16 h-20 w-20">
        <StickerCookie className="h-full w-full rotate-12" />
      </FloatSticker>
      <FloatSticker seed={3} className="absolute right-10 top-24 h-14 w-14">
        <StickerStar className="h-full w-full -rotate-6" />
      </FloatSticker>
      <FloatSticker seed={2} className="absolute bottom-20 left-12 h-16 w-16">
        <StickerLeaf className="h-full w-full rotate-6" />
      </FloatSticker>
      <div className="relative w-full max-w-sm rounded-3xl border-3 border-ink bg-white p-9 text-center shadow-[6px_6px_0_#384166]">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-3 border-ink bg-cobalt display text-[28px] leading-none text-white">
          S
        </span>
        <h1 className="display mt-5 text-4xl text-cobalt">Welcome to Sensei</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-muted">
          You must be 21 or older to enter. Cannabis products are for adult use only in New York State.
        </p>
        <button
          onClick={onConfirm}
          className="pop-press mt-7 w-full rounded-full border-3 border-ink bg-magenta px-5 py-3.5 display text-xl text-white"
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
