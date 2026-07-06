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

  const steps = ['Where', 'Vibe', 'Format', 'Budget']
  const last = steps.length - 1
  const neighborhoods = f.borough ? (neighborhoodsByBorough[f.borough] ?? []) : []

  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
          className="flex items-center gap-1.5 text-sm uppercase tracking-wide text-muted transition hover:text-accent hover:underline"
        >
          <Ico name="back" className="h-4 w-4" /> {step === 0 ? 'Home' : 'Back'}
        </button>
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-8 rounded-full transition ${i <= step ? 'bg-accent' : 'bg-line'}`}
            />
          ))}
        </div>
        <button
          onClick={() => onDone(f)}
          className="text-sm uppercase tracking-wide text-muted transition hover:text-accent hover:underline"
        >
          Skip
        </button>
      </div>

      {step === 0 && (
        <Step title="Where are you?" hint="This narrows things down the most — or skip for all NYC.">
          <button
            onClick={nearMe}
            className={`mb-3 flex min-h-[64px] w-full items-center justify-center gap-2 rounded-[28px] border p-4 uppercase tracking-wide transition ${
              f.userLoc
                ? 'border-accent bg-accent text-white'
                : 'border-accent bg-white text-accent hover:scale-[1.01]'
            }`}
          >
            ◉ {locating ? 'Locating…' : f.userLoc ? 'Using your location' : 'Use my location'}
          </button>
          {locError && (
            <p className="mb-3 text-xs uppercase tracking-wide text-clay">{locError}</p>
          )}
          {f.userLoc ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow">Within</span>
              {RADII.map((r) => (
                <button
                  key={r}
                  onClick={() => setF((p) => ({ ...p, radiusMiles: r }))}
                  className={`rounded-full px-4 py-1.5 text-[13px] uppercase tracking-wide transition ${
                    f.radiusMiles === r
                      ? 'bg-accent text-white'
                      : 'border border-line bg-white text-black hover:border-accent hover:text-accent'
                  }`}
                >
                  {r} mi
                </button>
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
                      setF((p) => ({
                        ...p,
                        borough: p.borough === b ? null : b,
                        neighborhood: null,
                      }))
                    }
                  >
                    <span className="font-medium">{b}</span>
                  </Card>
                ))}
              </div>
              {neighborhoods.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="eyebrow">Narrow it</span>
                  {neighborhoods.map((n) => (
                    <button
                      key={n}
                      onClick={() =>
                        setF((p) => ({ ...p, neighborhood: p.neighborhood === n ? null : n }))
                      }
                      className={`rounded-full px-3.5 py-1 text-[13px] uppercase tracking-wide transition ${
                        f.neighborhood === n
                          ? 'bg-accent text-white'
                          : 'border border-line bg-white text-black hover:border-accent hover:text-accent'
                      }`}
                    >
                      {n}
                    </button>
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
                <span className="text-[15px] font-medium">{v.label}</span>
              </Card>
            ))}
          </div>
        </Step>
      )}

      {step === 2 && (
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

      {step === 3 && (
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

      <button
        onClick={step < last ? () => setStep((s) => s + 1) : () => onDone(f)}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition hover:scale-[1.02] hover:shadow-[0_7px_29px_rgba(46,74,59,0.28)]"
      >
        {step < last ? 'Next' : 'Show my matches'} <Ico name="arrow" className="h-4 w-4" />
      </button>
    </div>
  )
}

function Step({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="animate-fade-up">
      <h2 className="display text-5xl">{title}</h2>
      <p className="mb-6 mt-2 text-sm text-muted">{hint}</p>
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
      className={`flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-[28px] border p-4 text-center uppercase tracking-wide transition ${
        active
          ? 'border-accent bg-accent text-white'
          : 'border-line bg-white text-black hover:scale-[1.02] hover:border-accent hover:text-accent'
      }`}
    >
      {children}
    </button>
  )
}
