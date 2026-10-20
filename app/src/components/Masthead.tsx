// The sign masthead: kanji pair, the mark, a subtitle, a short description of
// what Sensei does, and one line of real counts. Used on the home view; the
// age gate reuses the top of the stack.

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
}: {
  storeCount: number | null
  boroughs: number | null
  neighborhoods: number | null
}) {
  return (
    <section className="mx-auto max-w-2xl px-6 pt-6 text-center">
      <Kanji />
      <div className="mt-6">
        <Mark />
      </div>
      <p className="poster mt-4">A guide to New York</p>
      <p className="copy sentence mx-auto mt-4 max-w-[34ch] text-center">
        Every licensed dispensary menu in NYC, in one place. Say where you are and what you're after, and
        we'll show the cheapest and strongest options near you.
      </p>
      <p className="meta mt-6">
        {storeCount ?? '—'} licensed shops · {boroughs ?? '—'} boroughs · {neighborhoods ?? '—'} neighborhoods
      </p>
    </section>
  )
}
