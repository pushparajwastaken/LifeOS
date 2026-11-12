import type { Metadata } from 'next'
import { AuthPage } from '@/features/auth/components/auth-page'

export const metadata: Metadata = {
  title: 'Forgot password',
  description: 'Request a secure password recovery link for your LifeOS account.',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return <AuthPage mode="forgot-password" />
}
