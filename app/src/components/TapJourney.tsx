import { useState } from 'react'
import { Ico } from './Ico'
import { BUDGETS, FORMATS, VIBES } from '../lib/labels'
import { EMPTY_FILTERS, type Filters, type Format, type Vibe } from '../lib/types'

// 3 quick steps, big tappable cards, all skippable. Prefilled from `initial`
// (e.g. a vibe tapped on the hero).
export function TapJourney({
  initial,
  boroughs,
  onDone,
  onClose,
}: {
  initial: Filters
  boroughs: string[]
  onDone: (f: Filters) => void
  onClose: () => void
}) {
  const [step, setStep] = useState(0)
  const [f, setF] = useState<Filters>({ ...EMPTY_FILTERS, ...initial })

  const toggleVibe = (v: Vibe) =>
    setF((prev) => ({
      ...prev,
      vibes: prev.vibes.includes(v)
        ? prev.vibes.filter((x) => x !== v)
        : [...prev.vibes, v].slice(0, 3),
    }))

  // Location only earns a step once we actually have boroughs to offer.
  const hasBoroughs = boroughs.length > 0
  const steps = hasBoroughs ? ['Vibe', 'Format', 'Budget', 'Where'] : ['Vibe', 'Format', 'Budget']
  const last = steps.length - 1

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
          className="flex items-center gap-1.5 text-sm text-black/55 transition hover:text-accent"
        >
          <Ico name="back" className="h-4 w-4" /> {step === 0 ? 'Home' : 'Back'}
        </button>
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full transition ${i <= step ? 'bg-black' : 'bg-sand/50'}`}
            />
          ))}
        </div>
        <button
          onClick={() => onDone(f)}
          className="text-sm text-black/55 transition hover:text-accent"
        >
          Skip
        </button>
      </div>

      {step === 0 && (
        <Step title="What's the vibe?" hint="Pick up to 3 — or skip.">
          <div className="grid grid-cols-2 gap-3">
            {VIBES.map((v) => (
              <Card key={v.key} active={f.vibes.includes(v.key)} onClick={() => toggleVibe(v.key)}>
                <span className="text-[15px] font-medium">{v.label}</span>
              </Card>
            ))}
          </div>
        </Step>
      )}

      {step === 1 && (
        <Step title="What form?" hint="One pick, or skip for all.">
          <div className="grid grid-cols-2 gap-3">
            {FORMATS.map((fmt) => (
              <Card
                key={fmt.key}
                active={f.format === fmt.key}
                onClick={() =>
                  setF((p) => ({ ...p, format: p.format === fmt.key ? null : (fmt.key as Format) }))
                }
              >
                <span className="text-[15px] font-medium">{fmt.label}</span>
              </Card>
            ))}
          </div>
        </Step>
      )}

      {step === 2 && (
        <Step title="Budget?" hint="Per item.">
          <div className="grid grid-cols-2 gap-3">
            {BUDGETS.map((b) => (
              <Card
                key={b.label}
                active={f.priceCeiling === b.ceiling}
                onClick={() => setF((p) => ({ ...p, priceCeiling: b.ceiling, priceBand: b.band }))}
              >
                <span className="text-lg font-semibold">{b.label}</span>
              </Card>
            ))}
          </div>
        </Step>
      )}

      {step === 3 && hasBoroughs && (
        <Step title="Where?" hint="One pick, or skip for all NYC.">
          <div className="grid grid-cols-2 gap-3">
            {boroughs.map((b) => (
              <Card
                key={b}
                active={f.borough === b}
                onClick={() => setF((p) => ({ ...p, borough: p.borough === b ? null : b }))}
              >
                <span className="font-medium">{b}</span>
              </Card>
            ))}
          </div>
        </Step>
      )}

      <button
        onClick={step < last ? () => setStep((s) => s + 1) : () => onDone(f)}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-black px-5 py-3.5 font-medium text-paper transition hover:bg-neutral-800"
      >
        {step < last ? 'Next' : 'Show my matches'} <Ico name="arrow" className="h-4 w-4" />
      </button>
    </div>
  )
}

function Step({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="animate-fade-up">
      <h2 className="display text-5xl text-black">{title}</h2>
      <p className="mb-6 mt-2 text-sm text-black/55">{hint}</p>
      {children}
    </div>
  )
}

function Card({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-2xl p-4 text-center transition ${
        active
          ? 'bg-black text-paper'
          : 'bg-white text-black hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)]'
      }`}
    >
      {children}
    </button>
  )
}
