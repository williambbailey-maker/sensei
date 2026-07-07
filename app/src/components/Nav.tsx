import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

// Custom nav per the TRANS×HOME brief: three bars that morph to a close mark,
// opening a full-paper panel whose items stagger in. Items map to the app's
// real actions rather than anchor links (this is a single-view tool).
const EXPO = [0.16, 1, 0.3, 1] as const
const QUINT = [0.83, 0, 0.17, 1] as const

export type NavAction = { label: string; sub: string; onClick: () => void }

export function Nav({
  locationLabel,
  actions,
}: {
  locationLabel: string | null
  actions: NavAction[]
}) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion()

  return (
    <>
      <div className="flex items-center gap-4">
        {locationLabel && (
          <span className="hidden font-grotesk text-[0.72rem] uppercase tracking-label text-accent sm:block">
            ◉ {locationLabel}
          </span>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="relative flex h-6 w-7 flex-col justify-center gap-[5px]"
        >
          <motion.span
            className="block h-px w-full bg-ink"
            animate={open ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.4, ease: QUINT }}
          />
          <motion.span
            className="block h-px w-full bg-ink"
            animate={open ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.3, ease: QUINT }}
          />
          <motion.span
            className="block h-px w-full bg-ink"
            animate={open ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.4, ease: QUINT }}
          />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 bg-paper"
            initial={{ clipPath: reduce ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0 0)' }}
            exit={{ clipPath: reduce ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)', opacity: reduce ? 0 : 1 }}
            transition={{ duration: 0.7, ease: QUINT }}
          >
            <div className="mx-auto flex h-full max-w-[1240px] flex-col justify-center px-[clamp(24px,6vw,120px)]">
              <p className="eyebrow mb-10">Menu</p>
              <nav className="flex flex-col">
                {actions.map((a, i) => (
                  <motion.button
                    key={a.label}
                    onClick={() => {
                      a.onClick()
                      setOpen(false)
                    }}
                    className="group flex items-baseline gap-5 border-t border-hairline py-6 text-left last:border-b"
                    initial={{ opacity: 0, y: reduce ? 0 : 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: EXPO, delay: 0.15 + i * 0.09 }}
                  >
                    <span className="display text-4xl transition-colors group-hover:text-accent sm:text-6xl">
                      {a.label}
                    </span>
                    <span className="font-grotesk text-[0.72rem] uppercase tracking-label text-ink-soft">
                      {a.sub}
                    </span>
                  </motion.button>
                ))}
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
