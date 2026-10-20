import { useState } from 'react'
import { requestLocation } from '../lib/geo'
import { BOROUGHS, BUDGETS, FORMATS, SIZES, STRAINS } from '../lib/labels'
import { EMPTY_FILTERS, type Filters } from '../lib/types'
import { track } from '../lib/analytics'

// The core experience: a pure tap-through selection journey rendered as a
// list of rows with a marker, sign style.
// Borough → Neighborhood → Product type → Strain → Quantity (flower only) →
// Price → the product list. One tap advances each step; every step is skippable.
export function TapJourney({
  initial,
  neighborhoodsByBorough,
  boroughCounts,
  neighborhoodCounts,
  onDone,
  onClose,
}: {
  initial: Filters
  neighborhoodsByBorough: Record<string, string[]>
  boroughCounts: Record<string, number>
  neighborhoodCounts: Record<string, number>
  onDone: (f: Filters) => void
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const [f, setF] = useState<Filters>({ ...EMPTY_FILTERS, ...initial })
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')

  const STEPS = ['Borough', 'Neighborhood', 'Product type', 'Strain', 'Quantity', 'Price']
  const LAST = STEPS.length - 1

  const hoodsFor = (borough: string | null) =>
    borough ? (neighborhoodsByBorough[borough] ?? []) : []

  // Which steps apply to the current draft: the neighborhood step needs
  // neighborhoods to exist, and the quantity (pack size) step is flower-only.
  const stepVisible = (i: number, draft: Filters) => {
    if (i === 1) return hoodsFor(draft.borough).length > 0
    if (i === 4) return draft.format === 'flower'
    return true
  }

  // Move to the next/previous applicable step; past the last, hand off to the
  // product list.
  const advance = (from: number, draft: Filters) => {
    let n = from + 1
    while (n <= LAST && !stepVisible(n, draft)) n++
    if (n > LAST) {
      track('journey_step', { step: 'done' })
      return onDone(draft)
    }
    setStep(n)
  }
  const goBack = (from: number) => {
    let p = from - 1
    while (p >= 0 && !stepVisible(p, f)) p--
    if (p < 0) return onClose()
    setStep(p)
  }

  // A selection writes its filter, then advances.
  const pick = (patch: Partial<Filters>) => {
    const draft = { ...f, ...patch }
    track('journey_step', { step: STEPS[step].toLowerCase(), ...patch })
    setF(draft)
    advance(step, draft)
  }
  const skip = () => {
    track('journey_step', { step: STEPS[step].toLowerCase(), skipped: true })
    advance(step, f)
  }

  // Location-first: on a successful share, jump straight to results ordered by
  // distance (closest first). We deliberately don't hard-limit to a tight radius
  // up front — that produced empty screens for anyone not standing right next to
  // a shop. "Any distance" guarantees results; the Distance control on the
  // results screen lets them tighten to a mile radius. (Neighborhood step
  // self-skips with no borough set.)
  const locate = () => {
    setLocError('')
    setLocating(true)
    requestLocation(
      (loc) => {
        setLocating(false)
        const draft = {
          ...f,
          userLoc: loc,
          radiusMiles: null,
          sort: 'distance' as const,
          borough: null,
          neighborhood: null,
        }
        track('journey_step', { step: 'location', shared: true })
        setF(draft)
        advance(step, draft)
      },
      (msg) => {
        setLocating(false)
        setLocError(msg)
      },
    )
  }

  const neighborhoods = hoodsFor(f.borough)
  // Progress reflects only the steps that apply to the current path.
  const visibleSteps = STEPS.map((_, i) => i).filter((i) => stepVisible(i, f))
  const currentPos = visibleSteps.indexOf(step)
  const pad = (n: number) => String(n).padStart(2, '0')

  const shops = (n: number | undefined) => (n ? `${n} shop${n === 1 ? '' : 's'}` : undefined)

  return (
    <div id="journey" className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <button type="button" onClick={() => goBack(step)} className="ghost">
          {step === 0 ? 'Home' : 'Back'}
        </button>
        <span className="meta">
          {pad(currentPos + 1)} / {pad(visibleSteps.length)}
        </span>
        <button
          type="button"
          onClick={() => {
            track('journey_step', { step: 'see_all' })
            onDone(f)
          }}
          className="ghost"
        >
          See all
        </button>
      </div>

      {step === 0 && (
        <Step n={currentPos + 1} title="Where are you" hint="Tap a borough. Every step after this is skippable">
          {BOROUGHS.map((b) => (
            <Option
              key={b}
              label={b}
              caption={shops(boroughCounts[b])}
              active={f.borough === b}
              onClick={() => pick({ borough: b, neighborhood: null })}
            />
          ))}
        </Step>
      )}

      {step === 1 && (
        <Step n={currentPos + 1} title={`Where in ${f.borough}`} hint="Choose a neighborhood, or all of them">
          <Option label={`All ${f.borough}`} active={f.neighborhood === null} onClick={() => pick({ neighborhood: null })} />
          {neighborhoods.map((n) => (
            <Option
              key={n}
              label={n}
              caption={shops(neighborhoodCounts[n])}
              active={f.neighborhood === n}
              onClick={() => pick({ neighborhood: n })}
            />
          ))}
        </Step>
      )}

      {step === 2 && (
        <Step n={currentPos + 1} title="What are you after" hint="Pick a product type, or any">
          {FORMATS.map((fmt) => (
            <Option
              key={fmt.key}
              label={fmt.label}
              active={f.format === fmt.key}
              // Size only applies to flower; clear it when another type is chosen.
              onClick={() => pick({ format: fmt.key, ...(fmt.key === 'flower' ? {} : { size: null }) })}
            />
          ))}
        </Step>
      )}

      {step === 3 && (
        <Step n={currentPos + 1} title="Which strain" hint="Indica, sativa, hybrid, or any">
          {STRAINS.map((s) => (
            <Option key={s} label={s} active={f.strain === s} onClick={() => pick({ strain: s })} />
          ))}
        </Step>
      )}

      {step === 4 && (
        <Step n={currentPos + 1} title="How much" hint="Pick a size, or any amount">
          {SIZES.map((s) => (
            <Option key={s.key} label={s.label} active={f.size === s.key} onClick={() => pick({ size: s.key })} />
          ))}
        </Step>
      )}

      {step === 5 && (
        <Step n={currentPos + 1} title="Your budget" hint="Per item, or no limit">
          {BUDGETS.map((b) => (
            <Option
              key={b.label}
              label={b.label}
              active={f.priceCeiling === b.ceiling}
              onClick={() => pick({ priceCeiling: b.ceiling, priceBand: b.band })}
            />
          ))}
        </Step>
      )}

      <div className="mt-8 flex flex-col items-center gap-4">
        <button type="button" onClick={skip} className="ghost">
          {step < LAST ? 'Skip this step' : 'Show my products'}
        </button>
        {step === 0 && (
          <button type="button" onClick={locate} disabled={locating} className="ghost">
            {locating ? 'Locating' : 'Or share my location'}
          </button>
        )}
        {locError && <p className="meta text-ink">{locError}</p>}
      </div>
    </div>
  )
}

function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="poster">{title}</h2>
      <div className="rule mt-3">
        <span>{String(n).padStart(2, '0')}</span>
      </div>
      <p className="meta mb-6 mt-3 text-center">{hint}</p>
      {children}
    </div>
  )
}

// One option row: marker + label, with an optional shop count on the right.
function Option({
  label,
  caption,
  active,
  onClick,
}: {
  label: string
  caption?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="row w-full text-left">
      <span className="row-l">
        <span className={`marker ${active ? 'marker-on' : ''}`} />
        <span className="label">{label}</span>
      </span>
      {caption && <span className="label shrink-0 text-mist">{caption}</span>}
    </button>
  )
}
