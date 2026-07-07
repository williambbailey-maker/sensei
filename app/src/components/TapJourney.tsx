import { useState } from 'react'
import { Ico } from './Ico'
import { requestLocation } from '../lib/geo'
import { BOROUGHS, BUDGETS, FORMATS, RADII, VIBES } from '../lib/labels'
import { EMPTY_FILTERS, type Filters, type Format, type Vibe } from '../lib/types'

// 4 quick steps — location first, since "where are you" narrows results the
// most. Big tappable cards, all skippable. Prefilled from `initial`.
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
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')

  const toggleVibe = (v: Vibe) =>
    setF((prev) => ({
      ...prev,
      vibes: prev.vibes.includes(v)
        ? prev.vibes.filter((x) => x !== v)
        : [...prev.vibes, v].slice(0, 3),
    }))

  const nearMe = () => {
    setLocError('')
    setLocating(true)
    requestLocation(
      (loc) => {
        setLocating(false)
        setF((p) => ({ ...p, userLoc: loc, radiusMiles: p.radiusMiles ?? 2, borough: null, neighborhood: null }))
      },
      (msg) => {
        setLocating(false)
        setLocError(msg)
      },
    )
  }

  const steps = ['Where', 'Vibe', 'Product type', 'Budget']
  const last = steps.length - 1
  const neighborhoods = f.borough ? (neighborhoodsByBorough[f.borough] ?? []) : []

  return (
    <div className="mx-auto max-w-2xl px-[clamp(24px,6vw,120px)] py-[clamp(6vh,9vh,120px)]">
      <div className="mb-10 flex items-center justify-between">
        <button
          onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
          className="inline-flex items-center gap-1.5 font-grotesk text-[0.72rem] uppercase tracking-label text-ink-soft transition-colors hover:text-accent"
        >
          <Ico name="back" className="h-4 w-4" /> {step === 0 ? 'Home' : 'Back'}
        </button>
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-px w-8 transition-colors duration-500 ${i <= step ? 'bg-accent' : 'bg-hairline'}`}
            />
          ))}
        </div>
        <button
          onClick={() => onDone(f)}
          className="link-underline font-grotesk text-[0.72rem] uppercase tracking-label text-ink-soft"
        >
          Skip
        </button>
      </div>

      {step === 0 && (
        <Step title="Where are you?" hint="This narrows things down the most — or skip for all NYC.">
          <button
            onClick={nearMe}
            className={`mb-4 flex min-h-[64px] w-full items-center justify-center gap-2 rounded-[2px] border p-4 font-grotesk text-[0.72rem] uppercase tracking-label transition-colors duration-300 ${
              f.userLoc
                ? 'border-accent bg-accent text-paper'
                : 'border-accent text-accent hover:bg-accent hover:text-paper'
            }`}
          >
            ◉ {locating ? 'Locating…' : f.userLoc ? 'Using your location' : 'Use my location'}
          </button>
          {locError && <p className="mb-4 text-xs text-accent">{locError}</p>}
          {f.userLoc ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="eyebrow mr-1">Within</span>
              {RADII.map((r) => (
                <Chip key={r} active={f.radiusMiles === r} onClick={() => setF((p) => ({ ...p, radiusMiles: r }))}>
                  {r} mi
                </Chip>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {BOROUGHS.map((b) => (
                  <Card
                    key={b}
                    active={f.borough === b}
                    onClick={() =>
                      setF((p) => ({ ...p, borough: p.borough === b ? null : b, neighborhood: null }))
                    }
                  >
                    {b}
                  </Card>
                ))}
              </div>
              {neighborhoods.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <span className="eyebrow mr-1">Narrow it</span>
                  {neighborhoods.map((n) => (
                    <Chip
                      key={n}
                      active={f.neighborhood === n}
                      onClick={() => setF((p) => ({ ...p, neighborhood: p.neighborhood === n ? null : n }))}
                    >
                      {n}
                    </Chip>
                  ))}
                </div>
              )}
            </>
          )}
        </Step>
      )}

      {step === 1 && (
        <Step title="What's the vibe?" hint="Pick up to 3 — or skip.">
          <div className="grid grid-cols-2 gap-3">
            {VIBES.map((v) => (
              <Card key={v.key} active={f.vibes.includes(v.key)} onClick={() => toggleVibe(v.key)}>
                {v.label}
              </Card>
            ))}
          </div>
        </Step>
      )}

      {step === 2 && (
        <Step title="Product type?" hint="One pick, or skip for all.">
          <div className="grid grid-cols-2 gap-3">
            {FORMATS.map((fmt) => (
              <Card
                key={fmt.key}
                active={f.format === fmt.key}
                onClick={() => setF((p) => ({ ...p, format: p.format === fmt.key ? null : (fmt.key as Format) }))}
              >
                {fmt.label}
              </Card>
            ))}
          </div>
        </Step>
      )}

      {step === 3 && (
        <Step title="Budget?" hint="Per item.">
          <div className="grid grid-cols-2 gap-3">
            {BUDGETS.map((b) => (
              <Card
                key={b.label}
                active={f.priceCeiling === b.ceiling}
                onClick={() => setF((p) => ({ ...p, priceCeiling: b.ceiling, priceBand: b.band }))}
              >
                {b.label}
              </Card>
            ))}
          </div>
        </Step>
      )}

      <button
        onClick={step < last ? () => setStep((s) => s + 1) : () => onDone(f)}
        className="group mt-10 flex w-full items-center justify-center gap-2 bg-accent px-5 py-4 font-grotesk text-[0.72rem] uppercase tracking-label text-paper transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent-soft"
      >
        {step < last ? 'Next' : 'Show my matches'}
        <Ico name="arrow" className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </button>
    </div>
  )
}

function Step({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="animate-fade-up">
      <h2 className="display text-[clamp(2rem,5vw,3.25rem)] leading-tight">{title}</h2>
      <p className="prose-jp mb-8 mt-3">{hint}</p>
      {children}
    </div>
  )
}

function Card({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[80px] items-center justify-center rounded-[2px] border p-4 text-center font-grotesk text-[0.8rem] uppercase tracking-label transition-colors duration-300 ${
        active
          ? 'border-accent bg-accent text-paper'
          : 'border-hairline text-ink hover:border-accent hover:text-accent'
      }`}
    >
      {children}
    </button>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[2px] border px-4 py-2 font-grotesk text-[0.72rem] uppercase tracking-label transition-colors duration-300 ${
        active
          ? 'border-accent bg-accent text-paper'
          : 'border-hairline text-ink hover:border-accent hover:text-accent'
      }`}
    >
      {children}
    </button>
  )
}
