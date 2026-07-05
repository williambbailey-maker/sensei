import { BUDGETS, FORMATS, SORTS, STRAINS } from '../lib/labels'
import type { Filters, Format, SortKey, Strain } from '../lib/types'

// Objective controls that sit on equal footing with the vibe search: format,
// strain, price, borough, and sort. Native selects keep it compact and reliable
// on mobile without extra dependencies.
export function RefineBar({
  f,
  onChange,
  boroughs,
}: {
  f: Filters
  onChange: (f: Filters) => void
  boroughs: string[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        label="Format"
        value={f.format ?? ''}
        onChange={(v) => onChange({ ...f, format: (v || null) as Format | null })}
        options={[{ value: '', label: 'Any format' }, ...FORMATS.map((x) => ({ value: x.key, label: x.label }))]}
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
      {boroughs.length > 0 && (
        <Select
          label="Borough"
          value={f.borough ?? ''}
          onChange={(v) => onChange({ ...f, borough: v || null })}
          options={[{ value: '', label: 'All boroughs' }, ...boroughs.map((b) => ({ value: b, label: b }))]}
          active={f.borough != null}
        />
      )}
      <div className="ml-auto">
        <Select
          label="Sort"
          value={f.sort}
          onChange={(v) => onChange({ ...f, sort: v as SortKey })}
          options={SORTS.map((s) => ({ value: s.key, label: s.label }))}
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
        className={`appearance-none rounded-full border px-3 py-1.5 pr-7 text-sm transition focus:outline-none focus:ring-2 focus:ring-accent/30 ${
          active
            ? 'border-accent/40 bg-accent/10 text-accent-soft'
            : 'border-ink-line bg-ink-soft text-zinc-300 hover:border-zinc-600'
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink text-zinc-100">
            {o.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  )
}
