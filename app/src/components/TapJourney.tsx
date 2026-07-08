import { useState } from 'react'
import { Ico } from './Ico'
import { requestLocation } from '../lib/geo'
import { BOROUGHS, BUDGETS, FORMATS, RADII, VIBES } from '../lib/labels'
import { EMPTY_FILTERS, type Filters, type Format, type Vibe } from '../lib/types'

// 4 quick steps — location first. Big tappable cards, all skippable.
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
      vibes: prev.vibes.includes(v) ? prev.vibes.filter((x) => x !== v) : [...prev.vibes, v].slice(0, 3),
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
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
          className="inline-flex items-center gap-1.5 label text-[12px] text-muted transition hover:text-ink"
        >
          <Ico name="back" className="h-4 w-4" /> {step === 0 ? 'Home' : 'Back'}
        </button>
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full transition ${i <= step ? 'bg-ink' : 'bg-line'}`}
            />
          ))}
        </div>
        <button onClick={() => onDone(f)} className="label text-[12px] text-muted transition hover:text-ink">
          Skip
        </button>
      </div>

      {step === 0 && (
        <Step title="Where are you?" hint="This narrows things down the most — or skip for all NYC.">
          <button
            onClick={nearMe}
            className={`mb-4 flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl border border-ink p-4 label text-sm transition ${
              f.userLoc ? 'bg-ink text-white' : 'bg-panel text-ink hover:bg-ice'
            }`}
          >
            ◉ {locating ? 'Locating…' : f.userLoc ? 'Using your location' : 'Use my location'}
          </button>
          {locError && <p className="mb-4 label text-[11px] text-ink">{locError}</p>}
          {f.userLoc ? (
            <div className="flex flex-wrap items-center gap-2">
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
                    onClick={() => setF((p) => ({ ...p, borough: p.borough === b ? null : b, neighborhood: null }))}
                  >
                    {b}
                  </Card>
                ))}
              </div>
              {neighborhoods.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-2">
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
        className="pop-press mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3.5 label text-sm text-white"
      >
        {step < last ? 'Next →' : 'Show my matches →'}
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border border-ink px-4 py-2 label text-[11px] transition ${
        active ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-ice'
      }`}
    >
      {children}
    </button>
  )
}
