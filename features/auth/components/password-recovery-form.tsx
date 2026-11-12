'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestPasswordResetAction, type RecoveryFormState } from '@/app/auth/actions'

const initialState: RecoveryFormState = {}

export function PasswordRecoveryForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState)

  if (state.sent) {
    return (
      <div className="auth-recovery-result" role="status" aria-live="polite">
        <p>If an account matches that email address, you&apos;ll receive a password recovery link shortly. Check your inbox and spam folder.</p>
        <Link className="auth-submit" href="/login">Return to sign in</Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="auth-form">
      <label className="auth-field" htmlFor="recovery-email">
        <span>Email address</span>
        <input id="recovery-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} placeholder="you@example.com" required />
      </label>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      <button className="auth-submit" type="submit" disabled={pending}>
        {pending ? 'Sending link…' : 'Send recovery link'}
      </button>
    </form>
  )
}
