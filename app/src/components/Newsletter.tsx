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
      <div className="flex items-center gap-2 rounded-full border-2 border-black bg-white px-5 py-4 text-sm uppercase tracking-wide text-black">
        <Ico name="check" className="h-4 w-4 text-slate" /> You're on the list. Talk soon.
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'rounded-2xl border-2 border-black bg-white p-8 shadow-[4px_4px_0_#111]'}>
      {!compact && (
        <>
          <p className="eyebrow">Newsletter</p>
          <h3 className="display mt-2 text-3xl">The weekly drop</h3>
          <p className="mb-4 mt-1 text-sm normal-case text-muted">
            New deals and standout products, once a week. No spam.
          </p>
        </>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full border-2 border-black bg-white px-4 transition focus-within:border-accent">
          <Ico name="mail" className="h-4 w-4 shrink-0 text-muted" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full bg-transparent py-2.5 text-sm text-black placeholder:text-muted/70"
            aria-label="Email address"
          />
        </div>
        <button
          type="submit"
          disabled={state === 'loading'}
          className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:scale-105 shadow-[3px_3px_0_#111] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#111] disabled:opacity-50"
        >
          {state === 'loading' ? '…' : 'Subscribe'}
        </button>
      </form>
      {state === 'error' && (
        <p className="mt-2 text-xs text-clay">Something went wrong — try again.</p>
      )}
    </div>
  )
}
