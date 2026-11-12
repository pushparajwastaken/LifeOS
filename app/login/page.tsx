import type { Metadata } from 'next'
import { AuthPage } from '@/features/auth/components/auth-page'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your private LifeOS workspace.',
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return <AuthPage mode="login" />
}
