import { useEffect, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
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
