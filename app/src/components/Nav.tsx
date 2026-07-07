import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { StickerCookie, StickerLeaf, StickerStar } from './pop'

// Floating white pill nav in the PLAZA idiom: logo left, uppercase links with
// thin vertical dividers right. On mobile it collapses to a bars button that
// opens a full cobalt panel with oversized links and stickers.
const POP = [0.2, 0.8, 0.2, 1] as const

export type NavAction = { label: string; onClick: () => void }

export function Nav({ locationLabel, actions }: { locationLabel: string | null; actions: NavAction[] }) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()

  return (
    <>
      {/* Desktop: inline links with dividers. */}
      <nav className="hidden items-center gap-4 md:flex">
        {locationLabel && (
          <span className="label text-[12px] text-magenta">◉ {locationLabel}</span>
        )}
        {actions.map((a, i) => (
          <span key={a.label} className="flex items-center gap-4">
            {i > 0 && <span className="h-4 w-px bg-ink/30" />}
            <button
              onClick={a.onClick}
              className="label text-[13px] text-cobalt transition-colors hover:text-magenta"
            >
              {a.label}
            </button>
          </span>
        ))}
      </nav>

      {/* Mobile: bars button. */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="relative flex h-7 w-8 flex-col justify-center gap-[6px] md:hidden"
      >
        <motion.span
          className="block h-[3px] w-full rounded bg-cobalt"
          animate={open ? { rotate: 45, y: 9 } : { rotate: 0, y: 0 }}
          transition={{ duration: 0.35, ease: POP }}
        />
        <motion.span
          className="block h-[3px] w-full rounded bg-cobalt"
          animate={open ? { opacity: 0 } : { opacity: 1 }}
          transition={{ duration: 0.25 }}
        />
        <motion.span
          className="block h-[3px] w-full rounded bg-cobalt"
          animate={open ? { rotate: -45, y: -9 } : { rotate: 0, y: 0 }}
          transition={{ duration: 0.35, ease: POP }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col justify-center bg-cobalt px-8 md:hidden"
            initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : '-4%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : '-4%' }}
            transition={{ duration: 0.35, ease: POP }}
          >
            <StickerCookie className="absolute right-8 top-24 h-20 w-20 rotate-12" />
            <StickerStar className="absolute left-10 top-40 h-14 w-14 -rotate-6" />
            <StickerLeaf className="absolute bottom-24 right-12 h-16 w-16 rotate-6" />
            <nav className="flex flex-col gap-2">
              {actions.map((a, i) => (
                <motion.button
                  key={a.label}
                  onClick={() => {
                    a.onClick()
                    setOpen(false)
                  }}
                  className="display text-left text-6xl text-white transition-colors hover:text-magenta"
                  initial={{ opacity: 0, x: reduce ? 0 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, ease: POP, delay: 0.08 + i * 0.07 }}
                >
                  {a.label}
                </motion.button>
              ))}
            </nav>
            {locationLabel && (
              <p className="label mt-8 text-sm text-white/80">◉ {locationLabel}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
