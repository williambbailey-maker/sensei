// The sign masthead: the mark, a subtitle, a short description of what
// Sensei does, and one line of real counts. Used on the home view; the age
// gate reuses the top of the stack.

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
    <section className="mx-auto max-w-2xl px-6 pt-10 text-center">
      <Mark />
      <p className="poster mt-4">A guide to New York</p>
      <p className="copy sentence mx-auto mt-4 max-w-[36ch] text-center" style={{ fontSize: 16 }}>
        Every licensed dispensary menu in NYC, in one place. Say where you are and what you're after, and
        we'll show the cheapest and strongest options near you.
      </p>
      <p className="meta mt-6" style={{ fontSize: 14 }}>
        {storeCount ?? '—'} licensed shops · {boroughs ?? '—'} boroughs · {neighborhoods ?? '—'} neighborhoods
      </p>
    </section>
  )
}
