import { Ico } from './Ico'
import { vibeLabel } from '../lib/labels'
import type { Filters } from '../lib/types'

// Removable chips for the "soft" signals that come from vibe search or the
// journey. The objective filters (format/strain/price/borough) live in the
// RefineBar selects, so they're intentionally not duplicated here.
export function FilterChips({ f, onChange }: { f: Filters; onChange: (f: Filters) => void }) {
  const chips: { label: string; clear: () => void }[] = []

  if (f.userLoc)
    chips.push({
      label: `Near me${f.radiusMiles != null ? ` · ${f.radiusMiles} mi` : ''}`,
      clear: () => onChange({ ...f, userLoc: null, radiusMiles: null, sort: f.sort === 'distance' ? 'match' : f.sort }),
    })
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
    <div className="mt-3 flex flex-wrap items-center gap-2.5">
      {chips.map((c, i) => (
        <button
          key={i}
          onClick={c.clear}
          className="flex items-center gap-1.5 rounded-[2px] bg-accent px-3.5 py-1.5 font-grotesk text-[0.72rem] uppercase tracking-label text-paper transition-colors duration-300 hover:bg-accent-soft"
        >
          {c.label}
          <Ico name="close" className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
