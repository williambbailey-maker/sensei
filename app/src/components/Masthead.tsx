// The hero, exactly as design/subway-landing.html: headline, lede, six line
// bullets, the one white CTA, three stats. The age gate reuses Bullets.

// Three line bullets that spell THC, in three greens: the Lexington Avenue
// green, the Crosstown light green, and a deep green between them.
export function Bullets() {
  return (
    <div className="bullets" aria-hidden="true">
      <span className="mb" style={{ background: '#00933C' }}>
        T
      </span>
      <span className="mb" style={{ background: '#6CBE45' }}>
        H
      </span>
      <span className="mb" style={{ background: '#1B5E3A' }}>
        C
      </span>
    </div>
  )
}

// The footer sign-off: the "Sensei" wordmark in the header's subway type, with
// three line bullets spelling NYC underneath in the same greens as THC.
export function FooterMark() {
  const letters: { l: string; c: string }[] = [
    { l: 'N', c: '#00933C' },
    { l: 'Y', c: '#6CBE45' },
    { l: 'C', c: '#1B5E3A' },
  ]
  return (
    <div className="foot-mark" aria-label="Sensei NYC">
      <span className="wm">Sensei</span>
      <div className="bullets" aria-hidden="true">
        {letters.map((x) => (
          <span key={x.l} className="mb" style={{ background: x.c }}>
            {x.l}
          </span>
        ))}
      </div>
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
}: {
  storeCount: number | null
  productCount: number | null
  neighborhoods: number | null
}) {
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
        Stop checking menus one shop at a time. Every licensed dispensary in New York, side by side: price, THC
        and distance, updated nightly.
      </p>
      <div style={{ marginTop: 34 }}>
        <Bullets />
      </div>
      <div className="stats" style={{ marginTop: 34 }}>
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
