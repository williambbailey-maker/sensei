import { useEffect, useRef } from 'react'

export type Stop = { label: string; onClick?: () => void }

// The route trail: a round back button, then a green line with a stop for
// each choice so far, the current screen last. Tapping an earlier stop jumps
// back to it. Long trails scroll sideways, starting at the current stop.
export function Trail({
  stops,
  onBack,
  backLabel = 'Back',
}: {
  stops: Stop[]
  onBack: () => void
  backLabel?: string
}) {
  const line = useRef<HTMLDivElement>(null)
  const key = stops.map((s) => s.label).join('|')
  useEffect(() => {
    const el = line.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [key])

  return (
    <nav className="trail" aria-label="Where you are">
      <button type="button" onClick={onBack} className="trail-back" aria-label={backLabel}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5" />
          <path d="M11 6l-6 6 6 6" />
        </svg>
      </button>
      <div ref={line} className="trail-line">
        <ol className={`trail-stops ${stops.length < 2 ? 'one' : ''}`}>
          {stops.map((s, i) =>
            i === stops.length - 1 || !s.onClick ? (
              <li key={i} className={`trail-stop ${i === stops.length - 1 ? 'now' : ''}`} aria-current={i === stops.length - 1 ? 'step' : undefined}>
                <span className="trail-dot" />
                <span>{s.label}</span>
              </li>
            ) : (
              <li key={i} className="trail-stop">
                <button type="button" onClick={s.onClick}>
                  <span className="trail-dot" />
                  <span>{s.label}</span>
                </button>
              </li>
            ),
          )}
        </ol>
      </div>
    </nav>
  )
}
