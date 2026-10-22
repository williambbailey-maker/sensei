import { useState } from 'react'
import { addSubscriber } from '../lib/supabase'
import { track } from '../lib/analytics'

// The weekly-drop sign-up: a small title over one underlined field and an
// arrow. The title says what the address is for, so it never reads as a login.
export function Newsletter({ source }: { source: string }) {
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
    return <p className="signup-msg">You're on the list. The first drop lands next week.</p>
  }

  return (
    <div>
      <p className="signup-k">The weekly drop</p>
      <form onSubmit={submit} className="inp signup-inp">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          aria-label="Email address for the weekly drop mailing list"
          autoComplete="email"
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className="signup-go disabled:opacity-50"
          aria-label="Join the weekly drop"
        >
          {state === 'loading' ? '…' : '→'}
        </button>
      </form>
      {state === 'error' && <p className="signup-msg">Something went wrong. Try again.</p>}
    </div>
  )
}
