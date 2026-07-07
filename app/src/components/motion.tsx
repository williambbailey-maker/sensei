import { useEffect, type ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import Lenis from 'lenis'

// Light motion for the PLAZA-pop re-skin: a snappy pop-in reveal plus smooth
// momentum scroll. Reduced-motion renders final states instantly.
const POP = [0.2, 0.8, 0.2, 1] as const

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

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: POP, delay }}
    >
      {children}
    </motion.div>
  )
}

// Springy staggered entrance for hero clusters — each child pops in with a
// gentle overshoot, one after another. Renders final state under reduced motion.
const POP_SPRING = { type: 'spring' as const, stiffness: 420, damping: 26, mass: 0.8 }

export function PopIn({
  children,
  className,
  stagger = 0.09,
  delay = 0.05,
}: {
  children: ReactNode
  className?: string
  stagger?: number
  delay?: number
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  }
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

export function PopItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  const item: Variants = {
    hidden: { opacity: 0, y: 26, scale: 0.94 },
    show: { opacity: 1, y: 0, scale: 1, transition: POP_SPRING },
  }
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  )
}
