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

  // compact === the footer, which sits on the black band — everything here
  // needs to read against dark, not light.
  if (state === 'done') {
    return (
      <div
        className={`flex items-center gap-2 rounded-full px-5 py-3 label text-[12px] ${
          compact ? 'border border-line-dark text-white' : 'border border-line bg-panel text-ink'
        }`}
      >
        <Ico name="check" className="h-4 w-4" /> You're on the list. Talk soon.
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'rounded-3xl border border-ink bg-panel p-8 shadow-soft'}>
      {!compact && (
        <>
          <p className="eyebrow">Newsletter</p>
          <h3 className="display mt-2 text-2xl text-ink">The weekly drop</h3>
          <p className="mb-4 mt-1 text-sm font-semibold text-muted">
            New deals and standout products, once a week. No spam.
          </p>
        </>
      )}
      <form onSubmit={submit} className="flex items-center gap-2">
        <div
          className={`flex flex-1 items-center gap-2 rounded-full px-4 transition ${
            compact ? 'border border-line-dark' : 'border border-ink bg-white focus-within:bg-ice'
          }`}
        >
          <Ico name="mail" className={`h-4 w-4 shrink-0 ${compact ? 'text-steel' : 'text-muted'}`} />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className={`w-full bg-transparent py-2.5 text-sm font-semibold placeholder:text-muted/70 ${
              compact ? 'text-white' : 'text-ink'
            }`}
            aria-label="Email address"
          />
        </div>
        <button
          type="submit"
          disabled={state === 'loading'}
          className={`shrink-0 rounded-full px-5 py-2.5 label text-[11px] transition disabled:opacity-50 ${
            compact ? 'bg-white text-ink hover:opacity-85' : 'bg-ink text-white hover:opacity-85'
          }`}
        >
          {state === 'loading' ? '…' : 'Subscribe'}
        </button>
      </form>
      {state === 'error' && (
        <p className={`mt-2 label text-[11px] ${compact ? 'text-steel' : 'text-muted'}`}>
          Something went wrong — try again.
        </p>
      )}
    </div>
  )
}
