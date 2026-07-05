import { Ico } from './Ico'
import { vibeLabel } from '../lib/labels'
import type { Filters } from '../lib/types'

// Removable chips for the "soft" signals that come from vibe search or the
// journey. The objective filters (format/strain/price/borough) live in the
// RefineBar selects, so they're intentionally not duplicated here.
export function FilterChips({ f, onChange }: { f: Filters; onChange: (f: Filters) => void }) {
  const chips: { label: string; clear: () => void }[] = []

  for (const v of f.vibes) {
    chips.push({
      label: vibeLabel(v),
      clear: () => onChange({ ...f, vibes: f.vibes.filter((x) => x !== v) }),
    })
  }
  if (f.experience)
    chips.push({ label: f.experience, clear: () => onChange({ ...f, experience: null }) })
  if (f.priceBand) chips.push({ label: f.priceBand, clear: () => onChange({ ...f, priceBand: null }) })
  if (f.text) chips.push({ label: `"${f.text}"`, clear: () => onChange({ ...f, text: '' }) })

  if (chips.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((c, i) => (
        <button
          key={i}
          onClick={c.clear}
          className="flex items-center gap-1.5 border border-stone-900 bg-stone-900 px-3 py-1 text-sm capitalize text-paper transition hover:bg-stone-700"
        >
          {c.label}
          <Ico name="close" className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
