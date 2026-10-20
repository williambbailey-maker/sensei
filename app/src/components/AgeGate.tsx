import { useState } from 'react'
import { Kanji, Mark } from './Masthead'

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
    <div className="sign-surface fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <Kanji />
        <div className="mt-6">
          <Mark />
        </div>
        <p className="poster mt-4">Are you 21 or older?</p>
        <div className="rule mt-6">
          <span>NY</span>
        </div>
        <p className="meta mt-4">Cannabis products are for adult use only in New York State.</p>
        <div className="mt-8">
          <button type="button" onClick={onConfirm} className="dotcta">
            Yes, I'm 21 or older
          </button>
        </div>
        <a href="https://www.google.com" className="ghost mt-5 inline-block">
          I'm under 21
        </a>
      </div>
    </div>
  )
}
