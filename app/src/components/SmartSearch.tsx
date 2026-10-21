import { useMemo, useState } from 'react'
import { buildNeighborhoodIndex, parseQuery } from '../lib/parseQuery'
import { EMPTY_FILTERS, type Filters } from '../lib/types'
import { track } from '../lib/analytics'

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
  autoFocus = false,
}: {
  neighborhoodsByBorough: Record<string, string[]>
  onSearch: (f: Filters) => void
  autoFocus?: boolean
}) {
  const [q, setQ] = useState('')
  const index = useMemo(() => buildNeighborhoodIndex(neighborhoodsByBorough), [neighborhoodsByBorough])
  // Rotate the placeholder so the input advertises what it understands.
  const [ex] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])

  const submit = () => {
    const text = q.trim()
    if (!text) return
    const parsed = parseQuery(text, index)
    track('search', { query: text })
    onSearch({ ...EMPTY_FILTERS, ...parsed })
  }

  return (
    <div id="search" className="wrap" style={{ paddingTop: 34 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="inp"
      >
        <input
          id="search-input"
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={ex}
          aria-label="Search the menu in plain language"
          enterKeyHint="search"
        />
        <button type="submit" className="ghost shrink-0">
          Go
        </button>
      </form>
      <p className="meta" style={{ marginTop: 10 }}>
        Strain, brand, price or neighborhood
      </p>
    </div>
  )
}
