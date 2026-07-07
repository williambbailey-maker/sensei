import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

// PLAZA-pop building blocks: an infinite marquee ticker band, plus a set of
// original thick-outline sticker mascots (our own art, in the reference's
// flat-pop style). All pure SVG/CSS — no external assets.

// Organic float: each sticker bobs and tilts on its own gentle rhythm, so a
// cluster feels alive rather than uniformly animated. Params vary by `seed`.
export function FloatSticker({
  children,
  seed = 0,
  className,
}: {
  children: ReactNode
  seed?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  const amp = 7 + (seed % 3) * 3 // 7–13px
  const dur = 3.4 + (seed % 4) * 0.55 // 3.4–5.05s
  const tilt = 2.5 + (seed % 3) * 1.5 // 2.5–5.5deg
  const delay = (seed % 5) * 0.35
  const dir = seed % 2 === 0 ? 1 : -1
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -amp, 0, amp * 0.5, 0], rotate: [0, tilt * dir, 0, -tilt * dir, 0] }}
      transition={{ duration: dur, ease: 'easeInOut', repeat: Infinity, delay }}
      style={{ willChange: 'transform' }}
    >
      {children}
    </motion.div>
  )
}

export function Marquee({
  text = 'SENSEI · EVERY MENU · ONE COUNTER · HEARTS UP!',
  variant = 'ice',
  fast = false,
}: {
  text?: string
  variant?: 'ice' | 'cobalt' | 'magenta'
  fast?: boolean
}) {
  const skin =
    variant === 'cobalt'
      ? 'bg-cobalt text-white'
      : variant === 'magenta'
        ? 'bg-magenta text-white'
        : 'bg-ice text-cobalt'
  const item = (
    <span className="flex items-center">
      <span className="label whitespace-nowrap px-4 text-[13px] sm:text-sm">{text}</span>
      <Pennant className="h-3.5 w-3.5 shrink-0" />
    </span>
  )
  // Two identical tracks; the group translates -50% for a seamless loop.
  return (
    <div className={`w-full overflow-hidden border-y-3 border-ink py-2 ${skin}`}>
      <div className={`flex w-max ${fast ? 'animate-marquee-fast' : 'animate-marquee'}`}>
        <div className="flex">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="flex">
              {item}
            </span>
          ))}
        </div>
        <div className="flex" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="flex">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Pennant({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <path d="M5 3v18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M5 4h13l-3 4 3 4H5z" fill="currentColor" />
    </svg>
  )
}

// ---- Sticker mascots (original) --------------------------------------------
// Simple, friendly, thick-outlined. Sized by the wrapper's width/height.

const OUT = { stroke: '#111', strokeWidth: 4, strokeLinejoin: 'round' as const }

export function StickerLeaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <path
        d="M50 6C30 20 16 40 20 66c2 16 14 26 30 26s28-10 30-26C84 40 70 20 50 6z"
        fill="#3BA55C"
        {...OUT}
      />
      <path d="M50 26v54M50 44l-16-12M50 60l16-12M50 60l-16-12M50 44l16-12" stroke="#111" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <circle cx="41" cy="70" r="4.5" fill="#111" />
      <circle cx="59" cy="70" r="4.5" fill="#111" />
      <path d="M43 80c4 4 10 4 14 0" stroke="#111" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function StickerCookie({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <path
        d="M50 8c23 0 42 19 42 42S73 92 50 92 8 73 8 50c0-8 6-9 6-16s-6-8-6-14C8 12 27 8 50 8z"
        fill="#C88A4B"
        {...OUT}
      />
      <circle cx="34" cy="40" r="6" fill="#7A4A22" />
      <circle cx="66" cy="34" r="5" fill="#7A4A22" />
      <circle cx="70" cy="62" r="6" fill="#7A4A22" />
      <circle cx="38" cy="66" r="5" fill="#7A4A22" />
      <circle cx="42" cy="50" r="4.5" fill="#111" />
      <circle cx="60" cy="50" r="4.5" fill="#111" />
      <path d="M40 64c6 6 14 6 20 0" stroke="#111" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function StickerStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <path
        d="M50 6l12 26 28 3-21 19 6 28-25-14-25 14 6-28L16 35l28-3z"
        fill="#FFC93C"
        {...OUT}
      />
      <circle cx="43" cy="48" r="4" fill="#111" />
      <circle cx="57" cy="48" r="4" fill="#111" />
      <path d="M44 58c4 3 8 3 12 0" stroke="#111" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function StickerJar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <rect x="30" y="10" width="40" height="12" rx="4" fill="#EC1C92" {...OUT} />
      <path
        d="M26 28c0-3 3-6 6-6h36c3 0 6 3 6 6v52c0 6-5 10-11 10H37c-6 0-11-4-11-10z"
        fill="#8FD0FF"
        {...OUT}
      />
      <circle cx="42" cy="54" r="4.5" fill="#111" />
      <circle cx="58" cy="54" r="4.5" fill="#111" />
      <path d="M42 66c5 5 11 5 16 0" stroke="#111" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function StickerBolt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <path d="M56 6L22 56h22l-8 38 42-54H54z" fill="#F0562E" {...OUT} />
    </svg>
  )
}
