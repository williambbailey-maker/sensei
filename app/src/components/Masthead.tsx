// The hero, exactly as design/subway-landing.html: headline, lede, six line
// bullets, the one white CTA, three stats. The age gate reuses Bullets.

// Three line bullets that spell THC.
export function Bullets() {
  return (
    <div className="bullets" aria-hidden="true">
      <span className="mb" style={{ background: 'var(--r)' }}>
        T
      </span>
      <span className="mb" style={{ background: 'var(--b)' }}>
        H
      </span>
      <span className="mb" style={{ background: 'var(--g)' }}>
        C
      </span>
    </div>
  )
}

function short(n: number | null): string {
  if (n == null) return '—'
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

export function Masthead({
  storeCount,
  productCount,
  neighborhoods,
  onNear,
  locating,
  error,
}: {
  storeCount: number | null
  productCount: number | null
  neighborhoods: number | null
  onNear: () => void
  locating: boolean
  error?: string
}) {
  const n = storeCount == null ? 'All' : `All ${storeCount}`
  return (
    <section className="wrap">
      <h1 className="mark" style={{ marginTop: 54 }}>
        Every
        <br />
        menu.
        <br />
        One stop.
      </h1>
      <p className="lede" style={{ marginTop: 22 }}>
        {n} licensed dispensaries in New York, compared nightly. Price and potency as labeled.
      </p>
      <div style={{ marginTop: 34 }}>
        <Bullets />
      </div>
      <button type="button" onClick={onNear} disabled={locating} className="cta" style={{ marginTop: 28 }}>
        <span>{locating ? 'Locating' : 'Shops near me'}</span>
      </button>
      {error && <p className="meta mt-3">{error}</p>}
      <div className="stats" style={{ marginTop: 30 }}>
        <div>
          <span className="stat-v">{storeCount ?? '—'}</span>
          <span className="stat-k">licensed shops</span>
        </div>
        <div>
          <span className="stat-v">{short(productCount)}</span>
          <span className="stat-k">items in stock</span>
        </div>
        <div>
          <span className="stat-v">{neighborhoods ?? '—'}</span>
          <span className="stat-k">neighborhoods</span>
        </div>
      </div>
    </section>
  )
}
