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
      <div className="flex items-center gap-2 border border-line bg-panel px-5 py-4 text-sm text-stone-700">
        <Ico name="check" className="h-4 w-4 text-accent" /> You're on the list. Talk soon.
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'border border-line bg-panel p-7'}>
      {!compact && (
        <>
          <p className="eyebrow">Newsletter</p>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-stone-900">
            The weekly drop
          </h3>
          <p className="mb-4 mt-1 text-sm text-stone-500">
            New deals and standout products, once a week. No spam.
          </p>
        </>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 border border-line bg-white px-3.5">
          <Ico name="mail" className="h-4 w-4 shrink-0 text-stone-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full bg-transparent py-2.5 text-sm text-stone-900 placeholder:text-stone-400"
            aria-label="Email address"
          />
        </div>
        <button
          type="submit"
          disabled={state === 'loading'}
          className="shrink-0 bg-stone-900 px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-stone-700 disabled:opacity-50"
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
