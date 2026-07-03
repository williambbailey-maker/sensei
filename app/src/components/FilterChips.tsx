import { Ico } from './Ico'
import { formatLabel, vibeLabel } from '../lib/labels'
import type { Filters } from '../lib/types'

// Inline, editable filter chips shown above results. Each chip removes itself.
export function FilterChips({ f, onChange }: { f: Filters; onChange: (f: Filters) => void }) {
  const chips: { label: string; clear: () => void }[] = []

  for (const v of f.vibes) {
    chips.push({
      label: vibeLabel(v),
      clear: () => onChange({ ...f, vibes: f.vibes.filter((x) => x !== v) }),
    })
  }
  if (f.format) chips.push({ label: formatLabel(f.format), clear: () => onChange({ ...f, format: null }) })
  if (f.strain) chips.push({ label: f.strain, clear: () => onChange({ ...f, strain: null }) })
  if (f.experience)
    chips.push({ label: f.experience, clear: () => onChange({ ...f, experience: null }) })
  if (f.priceCeiling != null)
    chips.push({ label: `Under $${f.priceCeiling}`, clear: () => onChange({ ...f, priceCeiling: null }) })
  if (f.priceBand) chips.push({ label: f.priceBand, clear: () => onChange({ ...f, priceBand: null }) })
  if (f.text) chips.push({ label: `"${f.text}"`, clear: () => onChange({ ...f, text: '' }) })

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c, i) => (
        <button
          key={i}
          onClick={c.clear}
          className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-sm capitalize text-accent-soft transition hover:bg-accent/20"
        >
          {c.label}
          <Ico name="close" className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
