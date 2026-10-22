import { useState } from 'react'
import { addSubscriber } from '../lib/supabase'
import { track } from '../lib/analytics'

// The weekly-drop sign-up: one "Get the weekly drop →" link. Tapping it swaps
// in an underlined email field with a Join button. A /#drop link opens it.
export function Newsletter({ source }: { source: string }) {
  const [open, setOpen] = useState(() => window.location.hash === '#drop')
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

  if (!open) {
    return (
      <div className="signup-link-row">
        <button type="button" className="signup-link" onClick={() => setOpen(true)}>
          Get the weekly drop <span>→</span>
        </button>
      </div>
    )
  }

  return (
    <div>
      <form onSubmit={submit} className="inp">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          aria-label="Email address for the weekly drop mailing list"
          autoComplete="email"
          autoFocus
        />
        <button type="submit" disabled={state === 'loading'} className="signup-go disabled:opacity-50">
          {state === 'loading' ? '…' : 'Join'}
        </button>
      </form>
      {state === 'error' && <p className="signup-msg">Something went wrong. Try again.</p>}
    </div>
  )
}
