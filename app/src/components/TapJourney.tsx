import { useState } from 'react'
import { Ico } from './Ico'
import { BOROUGHS, BUDGETS, FORMATS, STRAINS } from '../lib/labels'
import { EMPTY_FILTERS, type Filters } from '../lib/types'

// The core experience: a pure tap-through selection journey.
// Borough → Neighborhood → Product type → Strain → Price → the product list.
// One tap advances each step; every step is skippable.
export function TapJourney({
  initial,
  neighborhoodsByBorough,
  onDone,
  onClose,
}: {
  initial: Filters
  neighborhoodsByBorough: Record<string, string[]>
  onDone: (f: Filters) => void
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const [f, setF] = useState<Filters>({ ...EMPTY_FILTERS, ...initial })

  const STEPS = ['Borough', 'Neighborhood', 'Product type', 'Strain', 'Price']
  const LAST = STEPS.length - 1

  const hoodsFor = (borough: string | null) =>
    borough ? (neighborhoodsByBorough[borough] ?? []) : []

  // Move forward, skipping the neighborhood step when the chosen borough has
  // none (or was skipped). Past the last step, hand off to the product list.
  const advance = (from: number, draft: Filters) => {
    let n = from + 1
    if (n === 1 && hoodsFor(draft.borough).length === 0) n = 2
    if (n > LAST) return onDone(draft)
    setStep(n)
  }
  const goBack = (from: number) => {
    let p = from - 1
    if (p === 1 && hoodsFor(f.borough).length === 0) p = 0
    if (p < 0) return onClose()
    setStep(p)
  }

  // A selection writes its filter, then advances.
  const pick = (patch: Partial<Filters>) => {
    const draft = { ...f, ...patch }
    setF(draft)
    advance(step, draft)
  }
  const skip = () => advance(step, f)

  const neighborhoods = hoodsFor(f.borough)

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        {step === 0 ? (
          <span className="label text-[12px] text-muted">Step 1 of {LAST + 1}</span>
        ) : (
          <button
            onClick={() => goBack(step)}
            className="inline-flex items-center gap-1.5 label text-[12px] text-muted transition hover:text-ink"
          >
            <Ico name="back" className="h-4 w-4" /> Back
          </button>
        )}
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full transition ${i <= step ? 'bg-ink' : 'bg-line'}`}
            />
          ))}
        </div>
        <button onClick={() => onDone(f)} className="label text-[12px] text-muted transition hover:text-ink">
          See all →
        </button>
      </div>

      {step === 0 && (
        <Step title="Where are you?" hint="Pick a borough — or see all of NYC.">
          <div className="grid grid-cols-1 gap-3">
            {BOROUGHS.map((b) => (
              <Card key={b} active={f.borough === b} onClick={() => pick({ borough: b, neighborhood: null })}>
                {b}
              </Card>
            ))}
          </div>
        </Step>
      )}

      {step === 1 && (
        <Step title={`Where in ${f.borough}?`} hint="Choose a neighborhood — or all of them.">
          <div className="grid grid-cols-2 gap-3">
            <Card active={f.neighborhood === null} onClick={() => pick({ neighborhood: null })}>
              All {f.borough}
            </Card>
            {neighborhoods.map((n) => (
              <Card key={n} active={f.neighborhood === n} onClick={() => pick({ neighborhood: n })}>
                {n}
              </Card>
            ))}
          </div>
        </Step>
      )}

      {step === 2 && (
        <Step title="What are you after?" hint="Pick a product type — or any.">
          <div className="grid grid-cols-2 gap-3">
            {FORMATS.map((fmt) => (
              <Card key={fmt.key} active={f.format === fmt.key} onClick={() => pick({ format: fmt.key })}>
                {fmt.label}
              </Card>
            ))}
          </div>
        </Step>
      )}

      {step === 3 && (
        <Step title="Which strain?" hint="Indica, sativa, hybrid — or any.">
          <div className="grid grid-cols-1 gap-3">
            {STRAINS.map((s) => (
              <Card key={s} active={f.strain === s} onClick={() => pick({ strain: s })}>
                {s}
              </Card>
            ))}
          </div>
        </Step>
      )}

      {step === 4 && (
        <Step title="What's your budget?" hint="Per item — or no limit.">
          <div className="grid grid-cols-2 gap-3">
            {BUDGETS.map((b) => (
              <Card
                key={b.label}
                active={f.priceCeiling === b.ceiling}
                onClick={() => pick({ priceCeiling: b.ceiling, priceBand: b.band })}
              >
                {b.label}
              </Card>
            ))}
          </div>
        </Step>
      )}

      <button
        onClick={skip}
        className="pop-press mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-ink bg-panel px-5 py-3.5 label text-sm text-ink transition hover:bg-ice"
      >
        {step < LAST ? 'Skip this step →' : 'Show my products →'}
      </button>
    </div>
  )
}

function Step({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="display text-[clamp(1.9rem,6vw,2.75rem)] text-ink">{title}</h2>
      <p className="mb-7 mt-2 text-sm font-semibold text-muted">{hint}</p>
      {children}
    </div>
  )
}

function Card({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[76px] items-center justify-center rounded-2xl border border-ink p-4 text-center label text-sm transition ${
        active ? 'bg-ink text-white' : 'bg-panel text-ink hover:bg-ice'
      }`}
    >
      {children}
    </button>
  )
}
