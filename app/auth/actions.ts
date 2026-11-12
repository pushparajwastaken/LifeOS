'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RECOVERY_COOKIE } from '@/lib/supabase/recovery'

export type AuthFormState = {
  error?: string
}

export type RecoveryFormState = {
  error?: string
  sent?: boolean
}

export type PasswordUpdateState = {
  error?: string
}

function getRecoveryRedirectUrl() {
  const configuredRedirect = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const redirectUrl = new URL(configuredRedirect ?? '/auth/callback', siteUrl)
  redirectUrl.searchParams.set('flow', 'recovery')
  redirectUrl.searchParams.set('next', '/update-password')
  return redirectUrl.toString()
}

function getCredentials(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  return { email, password }
}

function loginErrorMessage(error: { code?: string; status?: number }): string {
  if (error.code === 'email_not_confirmed') {
    return 'Please confirm your email address. Check your inbox for the link.'
  }
  if (error.code === 'over_request_rate_limit' || error.status === 429) {
    return 'Too many attempts. Wait a moment, then try again.'
  }
  if (error.code === 'invalid_credentials') {
    return 'Invalid email or password.'
  }
  return 'Something went wrong. Please try again.'
}

function signUpErrorMessage(error: { code?: string; status?: number }): string {
  if (error.code === 'weak_password') {
    return 'Please choose a stronger password.'
  }
  if (error.code === 'email_address_invalid') {
    return 'Please enter a valid email address.'
  }
  if (error.code === 'email_address_not_authorized') {
    return 'Confirmation email could not be sent to that address. Try another address.'
  }
  if (error.code === 'over_email_send_rate_limit' || error.status === 429) {
    return 'Too many attempts. Wait a moment, then try again.'
  }
  return 'Unable to create your account. Please try again.'
}

export async function signInAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = getCredentials(formData)
  if (!email || !email.includes('@') || !password || email.length > 254) {
    return { error: 'Enter a valid email address and password.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: loginErrorMessage(error) }

  redirect('/')
}

export async function signUpAction(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password } = getCredentials(formData)
  const displayName = String(formData.get('displayName') ?? '').trim().slice(0, 120)

  if (!email || !email.includes('@') || !password || email.length > 254) {
    return { error: 'Enter a valid email address and password.' }
  }
  if (password.length < 8) {
    return { error: 'Use a password with at least 8 characters.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo:
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
        `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
      data: { display_name: displayName || 'Your space' },
    },
  })

  if (error) return { error: signUpErrorMessage(error) }
  redirect('/sign-up-success')
}

export async function requestPasswordResetAction(
  _previousState: RecoveryFormState,
  formData: FormData,
): Promise<RecoveryFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getRecoveryRedirectUrl(),
  })

  if (error) return { error: 'We could not process your request right now. Please try again shortly.' }
  return { sent: true }
}

export async function updatePasswordAction(
  _previousState: PasswordUpdateState,
  formData: FormData,
): Promise<PasswordUpdateState> {
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')
  if (password.length < 8) return { error: 'Use a password with at least 8 characters.' }
  if (password.length > 256) return { error: 'Choose a shorter password.' }
  if (password !== confirmPassword) return { error: 'The passwords do not match.' }

  const cookieStore = await cookies()
  if (cookieStore.get(RECOVERY_COOKIE)?.value !== 'verified') {
    return { error: 'This recovery link is invalid or expired. Request a new link to continue.' }
  }

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    cookieStore.delete(RECOVERY_COOKIE)
    return { error: 'This recovery link is invalid or expired. Request a new link to continue.' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    if (error.code === 'weak_password') return { error: 'Please choose a stronger password.' }
    return { error: 'Your password could not be updated. Request a new recovery link and try again.' }
  }

  await supabase.auth.signOut({ scope: 'local' })
  cookieStore.delete(RECOVERY_COOKIE)
  redirect('/update-password?updated=1')
}

export async function signOutAction() {
  'use server'

  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    await supabase.auth.signOut({ scope: 'local' })
  }

  redirect('/login')
}
