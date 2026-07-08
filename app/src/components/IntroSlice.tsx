import { useEffect, useState } from 'react'
import './IntroSlice.css'

const SEEN_KEY = 'sensei_intro_seen'
const TOTAL_MS = 2320

// Pure read — safe to call more than once (React StrictMode double-invokes
// useState initializers in dev, so this must NOT also write the flag; a
// read-then-write initializer would see its own write on the second call
// and silently decide not to play).
function readShouldPlayIntro(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try {
    return sessionStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    return true
  }
}

// A katana sweeps across the wordmark, cuts it in half, then the page
// underneath is revealed. First-load only, once per tab session.
export function IntroSlice() {
  const [playing, setPlaying] = useState(readShouldPlayIntro)
  const [skipping, setSkipping] = useState(false)

  useEffect(() => {
    if (!playing) return
    // The write happens here, not in the initializer — effects are safe to
    // repeat (setItem is idempotent) even under StrictMode's double-fire.
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* storage unavailable — plays every load, just won't persist */
    }
    document.body.style.overflow = 'hidden'
    const done = setTimeout(() => setPlaying(false), TOTAL_MS)
    return () => {
      document.body.style.overflow = ''
      clearTimeout(done)
    }
  }, [playing])

  if (!playing) return null

  const skip = () => {
    setSkipping(true)
    document.body.style.overflow = ''
    setTimeout(() => setPlaying(false), 210)
  }

  return (
    <div className={skipping ? 'sen-intro sen-skip-out' : 'sen-intro'} aria-hidden="true">
      <div className="sen-intro-stage">
        <span className="sen-intro-word sen-half-a">SENSEI</span>
        <span className="sen-intro-word sen-half-b">SENSEI</span>
        <div className="sen-cut-glow" />
      </div>
      <div className="sen-blade">
        <svg viewBox="-60 0 470 40" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="senBladeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#eef0f3" />
              <stop offset="45%" stopColor="#fbfbfc" />
              <stop offset="55%" stopColor="#c7cad0" />
              <stop offset="100%" stopColor="#8f9298" />
            </linearGradient>
          </defs>
          <path d="M -6,20 Q170,4 400,16 L400,24 Q170,32 -6,20 Z" fill="url(#senBladeFill)" />
          <path d="M -6,20 Q170,4 400,16" stroke="#ffffff" strokeWidth="1.1" fill="none" opacity="0.85" />
          <rect x="-16" y="12" width="10" height="16" rx="3" fill="#1c1c1e" />
          <rect x="-56" y="14.5" width="42" height="11" rx="5.5" fill="#141416" />
          <line x1="-50" y1="20" x2="-20" y2="20" stroke="#3a3a3d" strokeWidth="1" />
        </svg>
      </div>
      <div className="sen-flash-screen" />
      <button type="button" className="sen-skip-btn" onClick={skip}>
        Skip intro
      </button>
    </div>
  )
}
