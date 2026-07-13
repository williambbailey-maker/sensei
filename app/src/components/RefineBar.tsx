import { BOROUGHS, BUDGETS, FORMATS, RADII, SORTS, STRAINS } from '../lib/labels'
import type { Filters, Format, SortKey, Strain } from '../lib/types'

// Objective controls on the results screen. Location leads: borough →
// neighborhood (data-driven), or a mile radius when the user shared position.
export function RefineBar({
  f,
  onChange,
  neighborhoodsByBorough,
}: {
  f: Filters
  onChange: (f: Filters) => void
  neighborhoodsByBorough: Record<string, string[]>
}) {
  const neighborhoods = f.borough ? (neighborhoodsByBorough[f.borough] ?? []) : []
  const sorts = f.userLoc ? SORTS : SORTS.filter((s) => s.key !== 'distance')

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {f.userLoc ? (
        <Select
          label="Distance"
          value={f.radiusMiles == null ? '' : String(f.radiusMiles)}
          onChange={(v) => onChange({ ...f, radiusMiles: v ? Number(v) : null })}
          options={[
            { value: '', label: 'Any distance' },
            ...RADII.map((r) => ({ value: String(r), label: `Within ${r} mi` })),
          ]}
          active={f.radiusMiles != null}
        />
      ) : (
        <Select
          label="Borough"
          value={f.borough ?? ''}
          onChange={(v) => onChange({ ...f, borough: v || null, neighborhood: null })}
          options={[{ value: '', label: 'All boroughs' }, ...BOROUGHS.map((b) => ({ value: b, label: b }))]}
          active={f.borough != null}
        />
      )}
      {neighborhoods.length > 0 && !f.userLoc && (
        <Select
          label="Neighborhood"
          value={f.neighborhood ?? ''}
          onChange={(v) => onChange({ ...f, neighborhood: v || null })}
          options={[{ value: '', label: `All ${f.borough}` }, ...neighborhoods.map((n) => ({ value: n, label: n }))]}
          active={f.neighborhood != null}
        />
      )}
      <Select
        label="Product type"
        value={f.format ?? ''}
        onChange={(v) => onChange({ ...f, format: (v || null) as Format | null })}
        options={[{ value: '', label: 'Any product type' }, ...FORMATS.map((x) => ({ value: x.key, label: x.label }))]}
        active={f.format != null}
      />
      <Select
        label="Strain"
        value={f.strain ?? ''}
        onChange={(v) => onChange({ ...f, strain: (v || null) as Strain | null })}
        options={[{ value: '', label: 'Any strain' }, ...STRAINS.map((s) => ({ value: s, label: s }))]}
        active={f.strain != null}
      />
      <Select
        label="Price"
        value={f.priceCeiling == null ? '' : String(f.priceCeiling)}
        onChange={(v) => onChange({ ...f, priceCeiling: v ? Number(v) : null })}
        options={[
          { value: '', label: 'Any price' },
          ...BUDGETS.filter((b) => b.ceiling != null).map((b) => ({ value: String(b.ceiling), label: b.label })),
        ]}
        active={f.priceCeiling != null}
      />
      <div className="ml-auto">
        <Select
          label="Sort"
          value={f.sort}
          onChange={(v) => onChange({ ...f, sort: v as SortKey })}
          options={sorts.map((s) => ({ value: s.key, label: s.label }))}
          active={f.sort !== 'match'}
        />
      </div>
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  active,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  active: boolean
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none rounded-full border border-ink px-4 py-2 pr-8 label text-[11px] transition focus:outline-none ${
          active ? 'bg-sage text-white' : 'bg-white text-ink hover:bg-sage-soft'
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-white text-ink">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className={`pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 ${active ? 'text-white' : 'text-ink'}`}
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  )
}
