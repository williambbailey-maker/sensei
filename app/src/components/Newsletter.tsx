import { useState } from 'react'
import { addSubscriber } from '../lib/supabase'
import { track } from '../lib/analytics'

export function Newsletter({ source, compact = false }: { source: string; compact?: boolean }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return
    setState('loading')
    try {
      await addSubscriber(email, source)
      track('signup', { placement: source })
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return <p className="meta text-ink">You're on the list. Talk soon.</p>
  }

  return (
    <div>
      {!compact && (
        <>
          <p className="k">The weekly drop</p>
          <p className="meta mt-1">Deals and standouts, once a week. No spam.</p>
        </>
      )}
      <form onSubmit={submit} className={`inp ${compact ? '' : 'mt-4'}`}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          aria-label="Email address"
        />
        <button type="submit" disabled={state === 'loading'} className="ghost shrink-0 disabled:opacity-50">
          {state === 'loading' ? '…' : 'Join'}
        </button>
      </form>
      {state === 'error' && <p className="meta mt-2">Something went wrong. Try again.</p>}
    </div>
  )
}
