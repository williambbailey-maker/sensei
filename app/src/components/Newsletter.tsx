import { useState } from 'react'
import { addSubscriber } from '../lib/supabase'
import { track } from '../lib/analytics'

// The weekly-drop sign-up. Always says what the address is for, so the
// field never reads as a login.
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
    return <p className="meta text-ink">You're on the list. The first drop lands next week.</p>
  }

  return (
    <div>
      <p className="k">
        {compact ? 'Get the weekly drop' : 'The weekly drop'}
        <small>a mailing list</small>
      </p>
      <p className="meta mt-1">Deals and standouts by email, once a week. No account, no spam, leave any time.</p>
      <form onSubmit={submit} className="inp mt-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email for the weekly drop"
          aria-label="Email address for the weekly drop mailing list"
          autoComplete="email"
        />
        <button type="submit" disabled={state === 'loading'} className="ghost shrink-0 disabled:opacity-50">
          {state === 'loading' ? '…' : 'Join the list'}
        </button>
      </form>
      {state === 'error' && <p className="meta mt-2">Something went wrong. Try again.</p>}
    </div>
  )
}
