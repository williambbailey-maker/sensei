import { Ico } from './Ico'
import { FORMATS, formatLabel, prettyStore, sizeLabel, vibeLabel } from '../lib/labels'
import { track } from '../lib/analytics'
import type { Filters } from '../lib/types'

// Removable chips for the "soft" signals from vibe search or the journey.
export function FilterChips({ f, onChange }: { f: Filters; onChange: (f: Filters) => void }) {
  const chips: { label: string; clear: () => void }[] = []

  // Deep-link filters first: they're the headline of a page arrived at from
  // a brand or dispensary page, so they should be the first thing to clear.
  if (f.store)
    chips.push({
      label: f.storeName ?? prettyStore(f.store),
      clear: () => onChange({ ...f, store: null, storeName: null, borough: null, neighborhood: null }),
    })
  if (f.brand) chips.push({ label: f.brand, clear: () => onChange({ ...f, brand: null }) })
  // The three small categories have no option in the product-type select, so
  // they get a chip; the four journey formats are already visible there.
  if (f.format && !FORMATS.some((x) => x.key === f.format))
    chips.push({ label: formatLabel(f.format), clear: () => onChange({ ...f, format: null }) })
  if (f.userLoc)
    chips.push({
      label: `Near me${f.radiusMiles != null ? ` · ${f.radiusMiles} mi` : ''}`,
      clear: () => onChange({ ...f, userLoc: null, radiusMiles: null, sort: f.sort === 'distance' ? 'match' : f.sort }),
    })
  for (const v of f.vibes) {
    chips.push({ label: vibeLabel(v), clear: () => onChange({ ...f, vibes: f.vibes.filter((x) => x !== v) }) })
  }
  if (f.experience) chips.push({ label: f.experience, clear: () => onChange({ ...f, experience: null }) })
  if (f.priceBand) chips.push({ label: f.priceBand, clear: () => onChange({ ...f, priceBand: null }) })
  if (f.thcMin != null) chips.push({ label: `${f.thcMin}%+ THC`, clear: () => onChange({ ...f, thcMin: null }) })
  if (f.size) chips.push({ label: sizeLabel(f.size), clear: () => onChange({ ...f, size: null }) })
  if (f.text) chips.push({ label: `"${f.text}"`, clear: () => onChange({ ...f, text: '' }) })

  if (chips.length === 0) return null

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
      {chips.map((c, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            track('chip_tap', { label: c.label })
            c.clear()
          }}
          className="tab tab-on"
        >
          {c.label}
          <Ico name="close" className="h-3 w-3 text-mist" />
        </button>
      ))}
    </div>
  )
}
