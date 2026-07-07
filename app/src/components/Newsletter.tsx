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
      <div className="flex items-center gap-2 border-b border-hairline py-3 font-grotesk text-[0.72rem] uppercase tracking-label text-ink">
        <Ico name="check" className="h-4 w-4 text-slate" /> You're on the list. Talk soon.
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'border-t border-hairline pt-8'}>
      {!compact && (
        <>
          <p className="eyebrow">Newsletter</p>
          <h3 className="display mt-3 text-3xl">The weekly drop</h3>
          <p className="prose-jp mb-5 mt-2">New deals and standout products, once a week. No spam.</p>
        </>
      )}
      <form onSubmit={submit} className="flex gap-3">
        <div className="flex flex-1 items-center gap-2 border-b border-hairline transition-colors focus-within:border-accent">
          <Ico name="mail" className="h-4 w-4 shrink-0 text-ink-soft" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full bg-transparent py-2.5 text-sm text-ink placeholder:text-ink-soft/70"
            aria-label="Email address"
          />
        </div>
        <button
          type="submit"
          disabled={state === 'loading'}
          className="shrink-0 bg-accent px-5 py-2.5 font-grotesk text-[0.72rem] uppercase tracking-label text-paper transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-accent-soft disabled:opacity-50"
        >
          {state === 'loading' ? '…' : 'Subscribe'}
        </button>
      </form>
      {state === 'error' && <p className="mt-2 text-xs text-accent">Something went wrong — try again.</p>}
    </div>
  )
}
