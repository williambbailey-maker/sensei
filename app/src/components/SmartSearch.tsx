import { useMemo, useState } from 'react'
import { buildNeighborhoodIndex, parseQuery } from '../lib/parseQuery'
import { EMPTY_FILTERS, type Filters } from '../lib/types'

const EXAMPLES = [
  'sativa pre-rolls under $10 in Manhattan',
  'cheapest indica eighths in Williamsburg',
  'high-THC vapes in Brooklyn',
  'edibles under $25',
]

// A plain-language search that parses a sentence into the same structured
// filters the tap-journey builds, then jumps straight to results. Sits above
// the journey as a shortcut for people who'd rather type than tap.
export function SmartSearch({
  neighborhoodsByBorough,
  onSearch,
}: {
  neighborhoodsByBorough: Record<string, string[]>
  onSearch: (f: Filters) => void
}) {
  const [q, setQ] = useState('')
  const index = useMemo(() => buildNeighborhoodIndex(neighborhoodsByBorough), [neighborhoodsByBorough])
  // Rotate the placeholder so the input advertises what it understands.
  const [ex] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])

  const submit = () => {
    const text = q.trim()
    if (!text) return
    const parsed = parseQuery(text, index)
    onSearch({ ...EMPTY_FILTERS, ...parsed })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="glass flex items-center gap-2 rounded-full p-2 pl-5 shadow-soft-sm"
      >
        <span className="shrink-0 text-lg text-yellow">⌕</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Try: ${ex}`}
          aria-label="Search the menu in plain language"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] font-medium text-ink placeholder:text-muted focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-yellow px-5 py-2.5 label text-[12px] text-onyx transition active:scale-95"
        >
          Search
        </button>
      </form>
      <p className="mt-2 px-2 label text-[10px] text-muted">
        Type a strain, product, price, borough or neighborhood — or tap through below.
      </p>
    </div>
  )
}
