import { useState } from 'react'
import { Ico } from './Ico'
import { addSubscriber } from '../lib/supabase'

export function Newsletter({ source, compact = false }: { source: string; compact?: boolean }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return
    setState('loading')
    try {
      await addSubscriber(email, source)
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="flex items-center gap-2 rounded-full border-3 border-ink bg-white px-5 py-3.5 label text-[12px] text-cobalt">
        <Ico name="check" className="h-4 w-4 text-slate" /> You're on the list. Talk soon.
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'rounded-3xl border-3 border-ink bg-white p-8 shadow-[4px_4px_0_#384166]'}>
      {!compact && (
        <>
          <p className="eyebrow text-magenta">Newsletter</p>
          <h3 className="display mt-2 text-3xl text-cobalt">The weekly drop</h3>
          <p className="mb-4 mt-1 text-sm font-semibold text-muted">
            New deals and standout products, once a week. No spam.
          </p>
        </>
      )}
      <form onSubmit={submit} className="flex gap-2.5">
        <div className="flex flex-1 items-center gap-2 rounded-full border-3 border-ink bg-white px-4 transition focus-within:bg-ice">
          <Ico name="mail" className="h-4 w-4 shrink-0 text-cobalt" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full bg-transparent py-2.5 text-sm font-semibold text-ink placeholder:text-muted/70"
            aria-label="Email address"
          />
        </div>
        <button
          type="submit"
          disabled={state === 'loading'}
          className="shrink-0 rounded-full border-3 border-ink bg-cobalt px-5 py-2.5 display text-base text-white transition hover:bg-cobalt-deep disabled:opacity-50"
        >
          {state === 'loading' ? '…' : 'Subscribe'}
        </button>
      </form>
      {state === 'error' && <p className="mt-2 label text-[11px] text-tomato">Something went wrong — try again.</p>}
    </div>
  )
}
