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
      <div className="flex items-center justify-center gap-2 rounded-xl2 border border-accent/30 bg-accent/10 px-5 py-4 text-sm text-accent-soft">
        <Ico name="check" className="h-4 w-4" /> You're on the list. Talk soon.
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'rounded-xl2 border border-ink-line bg-ink-soft p-6'}>
      {!compact && (
        <>
          <h3 className="text-lg font-semibold tracking-tight">Get the weekly drop</h3>
          <p className="mb-4 mt-1 text-sm text-zinc-400">
            New deals and standout products, once a week. No spam.
          </p>
        </>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-ink-line bg-ink-card px-3.5">
          <Ico name="mail" className="h-4 w-4 shrink-0 text-zinc-500" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full bg-transparent py-2.5 text-sm placeholder:text-zinc-500"
            aria-label="Email address"
          />
        </div>
        <button
          type="submit"
          disabled={state === 'loading'}
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-accent-soft disabled:opacity-50"
        >
          {state === 'loading' ? '…' : 'Subscribe'}
        </button>
      </form>
      {state === 'error' && (
        <p className="mt-2 text-xs text-rose-400">Something went wrong — try again.</p>
      )}
    </div>
  )
}
