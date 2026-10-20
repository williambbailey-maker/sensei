// The directional-sign masthead: kanji pair, the mark, a subtitle, a
// double-headed arrow with a center divider, and two short columns that
// overlap the divider. Used on the home view; the age gate reuses the top of
// the stack.

export function Kanji() {
  return (
    <div className="kanji" aria-hidden="true">
      <span>先</span>
      <span>生</span>
    </div>
  )
}

export function Mark() {
  return <h1 className="mark">Sensei</h1>
}

export function Masthead({
  storeCount,
  boroughs,
  neighborhoods,
  onFind,
}: {
  storeCount: number | null
  boroughs: number | null
  neighborhoods: number | null
  onFind?: () => void
}) {
  const n = storeCount == null ? '—' : String(storeCount)
  return (
    <section className="mx-auto max-w-2xl px-6 pt-6 text-center">
      <Kanji />
      <div className="mt-6">
        <Mark />
      </div>
      <p className="poster mt-4">A guide to New York</p>
      <svg
        className="mt-6 block w-full"
        viewBox="0 0 320 150"
        aria-hidden="true"
        fill="none"
        stroke="#141414"
        strokeWidth="3"
      >
        <path d="M24 20 H296" />
        <path d="M8 20 l18 -8 l-4 8 l4 8 Z" fill="#141414" stroke="none" />
        <path d="M312 20 l-18 -8 l4 8 l-4 8 Z" fill="#141414" stroke="none" />
        <path d="M160 20 V150" />
      </svg>
      <div className="grid grid-cols-2 gap-6" style={{ marginTop: -104 }}>
        <p className="label text-center leading-tight" style={{ fontSize: 20 }}>
          {n} licensed
          <br />
          shops
          <br />
          live menus
        </p>
        <p className="label text-center leading-tight" style={{ fontSize: 20 }}>
          compare
          <br />
          price &amp;
          <br />
          potency
        </p>
      </div>
      <p className="meta mt-6">
        {boroughs ?? '—'} boroughs · {neighborhoods ?? '—'} neighborhoods
      </p>
      {onFind && (
        <div className="mt-6">
          <button type="button" onClick={onFind} className="dotcta">
            Find a shop
          </button>
        </div>
      )}
    </section>
  )
}
