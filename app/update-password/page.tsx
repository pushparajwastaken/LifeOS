import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { AuthPage } from '@/features/auth/components/auth-page'
import { RECOVERY_COOKIE } from '@/lib/supabase/recovery'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Update password',
  description: 'Choose a new password for your LifeOS account.',
  robots: { index: false, follow: false },
}

type UpdatePasswordPageProps = {
  searchParams: Promise<{ updated?: string; error?: string }>
}

export default async function UpdatePasswordPage({ searchParams }: UpdatePasswordPageProps) {
  const params = await searchParams
  if (params.updated === '1') return <AuthPage mode="update-password" recoveryState="updated" />
  if (params.error === 'invalid-link') return <AuthPage mode="update-password" recoveryState="invalid" />

  const cookieStore = await cookies()
  const hasRecoveryMarker = cookieStore.get(RECOVERY_COOKIE)?.value === 'verified'
  if (!hasRecoveryMarker) return <AuthPage mode="update-password" recoveryState="invalid" />

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return <AuthPage mode="update-password" recoveryState="invalid" />

  return <AuthPage mode="update-password" recoveryState="ready" />
}
