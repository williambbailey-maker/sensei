import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import Lenis from 'lenis'

// Shared motion language for the TRANS×HOME re-skin: slow, confident expo/quint
// easing, transform/opacity only. Everything here degrades to instant final
// states under prefers-reduced-motion.

const EXPO = [0.16, 1, 0.3, 1] as const

// Smooth momentum scroll for the whole app. Disabled for reduced-motion.
export function useLenis() {
  const reduce = useReducedMotion()
  useEffect(() => {
    if (reduce) return
    const lenis = new Lenis({ lerp: 0.1 })
    let raf = 0
    const loop = (t: number) => {
      lenis.raf(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [reduce])
}

// Baseline entrance: fade + rise, fires once ~15% into view. Stagger children
// by passing `stagger` and wrapping items in <RevealItem>.
export function Reveal({
  children,
  className,
  delay = 0,
  stagger = 0,
  y = 32,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  delay?: number
  stagger?: number
  y?: number
  as?: 'div' | 'section' | 'span'
}) {
  const reduce = useReducedMotion()
  const MotionTag = motion[as]
  if (reduce) {
    const Tag = as
    return <Tag className={className}>{children}</Tag>
  }
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  }
  const single: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    show: { opacity: 1, y: 0, transition: { duration: 0.95, ease: EXPO, delay } },
  }
  return (
    <MotionTag
      className={className}
      variants={stagger ? container : single}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
    >
      {children}
    </MotionTag>
  )
}

// A staggered child inside a <Reveal stagger>.
export function RevealItem({ children, className, y = 28 }: { children: ReactNode; className?: string; y?: number }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EXPO } },
  }
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  )
}

// Kinetic label: an overflow-hidden wrapper whose inner text slides up from
// below (translateY 100% -> 0) — the "mask-up" reveal used for big labels.
export function MaskLabel({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <span className="mask inline-block align-bottom">
      <motion.span
        className={`inline-block ${className ?? ''}`}
        initial={{ y: reduce ? '0%' : '110%' }}
        whileInView={{ y: '0%' }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.9, ease: EXPO }}
      >
        {children}
      </motion.span>
    </span>
  )
}

// Image mask reveal: a panel wipes away left->right while the image inside
// settles from a slight scale-up. Reads as architectural, not decorative.
export function MaskImage({
  src,
  alt = '',
  className,
  imgClassName,
}: {
  src: string
  alt?: string
  className?: string
  imgClassName?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={`overflow-hidden ${className ?? ''}`}
      initial={{ clipPath: reduce ? 'inset(0 0 0 0)' : 'inset(0 0 0 100%)' }}
      whileInView={{ clipPath: 'inset(0 0 0 0)' }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 1.1, ease: EXPO }}
    >
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        className={imgClassName}
        initial={{ scale: reduce ? 1 : 1.08 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1.1, ease: EXPO }}
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    </motion.div>
  )
}

// Preloader: 00 -> 100 counter with a growing 1px rule, then an upward wipe
// revealing the app. Shows once per session; capped so it never hurts load.
export function Preloader() {
  const reduce = useReducedMotion()
  const [pct, setPct] = useState(0)
  const [done, setDone] = useState(() => {
    try {
      return reduce || sessionStorage.getItem('sensei_intro') === 'seen'
    } catch {
      return reduce
    }
  })
  const started = useRef(false)

  useEffect(() => {
    if (done || started.current) return
    started.current = true
    const start = performance.now()
    const DUR = 1000
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DUR)
      setPct(Math.round(t * 100))
      if (t < 1) raf = requestAnimationFrame(tick)
      else {
        try {
          sessionStorage.setItem('sensei_intro', 'seen')
        } catch {
          /* ignore */
        }
        setTimeout(() => setDone(true), 200)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [done])

  if (done) return null

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-paper"
      initial={{ y: 0 }}
      animate={pct >= 100 ? { y: '-100%' } : { y: 0 }}
      transition={{ duration: 1, ease: EXPO }}
      aria-hidden="true"
    >
      <div className="w-full max-w-[280px] px-6">
        <div className="flex items-end justify-between">
          <span className="label text-5xl text-ink">先</span>
          <span className="font-grotesk text-2xl tabular-nums text-ink">
            {String(pct).padStart(3, '0')}
          </span>
        </div>
        <div className="mt-4 h-px w-full bg-hairline">
          <div
            className="h-px bg-accent transition-[width] duration-150 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </motion.div>
  )
}
