import type { ReactNode } from 'react'

// Motion removed per request — these are now static passthroughs so existing
// call sites keep working without any animation.
export function useLenis() {}

export function Reveal({ children, className }: { children: ReactNode; className?: string; delay?: number }) {
  return <div className={className}>{children}</div>
}

export function PopIn({ children, className }: { children: ReactNode; className?: string; stagger?: number; delay?: number }) {
  return <div className={className}>{children}</div>
}

export function PopItem({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}
