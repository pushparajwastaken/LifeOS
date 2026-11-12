'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { signInAction, signUpAction, type AuthFormState } from '@/app/auth/actions'

type AuthFormProps = {
  mode: 'login' | 'sign-up'
}

const initialState: AuthFormState = {}

export function AuthForm({ mode }: AuthFormProps) {
  const isSignUp = mode === 'sign-up'
  const action = isSignUp ? signUpAction : signInAction
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <form action={formAction} className="auth-form">
      {isSignUp && (
        <label className="auth-field" htmlFor="displayName">
          <span>Name <span className="auth-optional">Optional</span></span>
          <input id="displayName" name="displayName" type="text" autoComplete="name" maxLength={120} placeholder="How should we address you?" />
        </label>
      )}
      <label className="auth-field" htmlFor="email">
        <span>Email address</span>
        <input id="email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} placeholder="you@example.com" required />
      </label>
      <label className="auth-field" htmlFor="password">
        <span>Password</span>
        <input id="password" name="password" type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={isSignUp ? 8 : undefined} required />
      </label>
      {!isSignUp && <Link className="auth-forgot-link" href="/forgot-password">Forgot password?</Link>}

      {state.error && <p className="auth-error" role="alert">{state.error}</p>}

      <button className="auth-submit" type="submit" disabled={pending}>
        {pending ? (isSignUp ? 'Creating your account…' : 'Signing in…') : (isSignUp ? 'Create account' : 'Sign in')}
      </button>
      {isSignUp && <p className="auth-confirmation">We&apos;ll email you a confirmation link before your private workspace is ready.</p>}
    </form>
  )
}
