'use client'

import Link from 'next/link'
import { useState, useActionState } from 'react'
import { updatePasswordAction, type PasswordUpdateState } from '@/app/auth/actions'

const initialState: PasswordUpdateState = {}

export function PasswordUpdateForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  return (
    <form action={formAction} className="auth-form">
      <div className="auth-field">
        <label htmlFor="new-password">New password</label>
        <span className="auth-password-control">
          <input id="new-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={256} required />
          <button className="auth-password-toggle" type="button" aria-label={showPassword ? 'Hide new password' : 'Show new password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button>
        </span>
      </div>
      <div className="auth-field">
        <label htmlFor="confirm-password">Confirm new password</label>
        <span className="auth-password-control">
          <input id="confirm-password" name="confirmPassword" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={256} required />
          <button className="auth-password-toggle" type="button" aria-label={showConfirmation ? 'Hide password confirmation' : 'Show password confirmation'} aria-pressed={showConfirmation} onClick={() => setShowConfirmation(value => !value)}>{showConfirmation ? 'Hide' : 'Show'}</button>
        </span>
      </div>
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      <button className="auth-submit" type="submit" disabled={pending}>
        {pending ? 'Updating password…' : 'Update password'}
      </button>
      <p className="auth-confirmation">Use at least 8 characters. Your password is changed securely through your account.</p>
      <Link className="auth-inline-link" href="/login">Cancel and return to sign in</Link>
    </form>
  )
}
