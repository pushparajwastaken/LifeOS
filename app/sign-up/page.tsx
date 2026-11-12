import type { Metadata } from 'next'
import { AuthPage } from '@/features/auth/components/auth-page'

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Create a private LifeOS account.',
  robots: { index: false, follow: false },
}

export default function SignUpPage() {
  return <AuthPage mode="sign-up" />
}
