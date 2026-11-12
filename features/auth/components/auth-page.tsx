import Link from 'next/link'
import { ArrowUpRight, Compass, ShieldCheck, Sparkles } from 'lucide-react'
import { AuthForm } from '@/features/auth/components/auth-form'
import { PasswordRecoveryForm } from '@/features/auth/components/password-recovery-form'
import { PasswordUpdateForm } from '@/features/auth/components/password-update-form'

type AuthPageProps = {
  mode: 'login' | 'sign-up' | 'forgot-password' | 'update-password'
  recoveryState?: 'ready' | 'invalid' | 'updated'
}

export function AuthPage({ mode, recoveryState = 'ready' }: AuthPageProps) {
  const isSignUp = mode === 'sign-up'
  const isForgotPassword = mode === 'forgot-password'
  const isUpdatePassword = mode === 'update-password'

  return (
    <main className="auth-layout">
      <aside className="auth-story" aria-label="About LifeOS">
        <Link href="/" className="auth-brand" aria-label="LifeOS">
          <span className="auth-brand-mark"><Compass size={20} aria-hidden="true" /></span>
          <span>life<span>OS</span></span>
        </Link>
        <div className="auth-story-copy">
          <p className="eyebrow">A PRACTICE, NOT A FINISH LINE</p>
          <h1>Make room for the life you&apos;re building.</h1>
          <p>One thoughtful system for your habits, learning, work, health and the small promises that move you forward.</p>
        </div>
        <div className="auth-story-note">
          <span><Sparkles size={16} aria-hidden="true" /></span>
          <p>Start with today. The rest can grow from there.</p>
        </div>
        <span className="auth-story-orbit auth-story-orbit-one" aria-hidden="true" />
        <span className="auth-story-orbit auth-story-orbit-two" aria-hidden="true" />
      </aside>

      <section className="auth-main" aria-labelledby="auth-title">
        <div className="auth-card">
          <div className="auth-mobile-brand"><span className="auth-brand-mark"><Compass size={19} aria-hidden="true" /></span><span>life<span>OS</span></span></div>
          <div className="auth-heading">
            <span className="auth-heading-icon"><ShieldCheck size={18} aria-hidden="true" /></span>
            <p className="eyebrow">{isUpdatePassword ? 'SECURE ACCOUNT RECOVERY' : isForgotPassword ? 'ACCOUNT RECOVERY' : 'YOUR PRIVATE WORKSPACE'}</p>
            <h2 id="auth-title">{isSignUp ? 'Create your space.' : isForgotPassword ? 'Reset your password.' : isUpdatePassword ? recoveryState === 'updated' ? 'Password updated.' : recoveryState === 'invalid' ? 'Recovery link expired.' : 'Choose a new password.' : 'Welcome back.'}</h2>
            <p>{isSignUp ? 'A calmer way to make steady progress, one day at a time.' : isForgotPassword ? 'Enter the email address linked to your LifeOS account and we’ll send a recovery link if an account matches.' : isUpdatePassword ? recoveryState === 'updated' ? 'Your password has been changed. Sign in with your new password to continue.' : recoveryState === 'invalid' ? 'This recovery link is invalid or expired. Request a new link to continue.' : 'Create a new password for your private LifeOS workspace.' : 'Pick up where you left off, one intentional step at a time.'}</p>
          </div>

          {(mode === 'login' || isSignUp) && <AuthForm mode={isSignUp ? 'sign-up' : 'login'} />}
          {isForgotPassword && <PasswordRecoveryForm />}
          {isUpdatePassword && recoveryState === 'ready' && <PasswordUpdateForm />}
          {isUpdatePassword && recoveryState !== 'ready' && <Link className="auth-submit recovery-status-link" href="/login">Return to sign in</Link>}

          {!isUpdatePassword && <p className="auth-switch">
            {isSignUp ? 'Already have an account?' : isForgotPassword ? 'Remember your password?' : 'New to LifeOS?'}{' '}
            <Link href={isSignUp || isForgotPassword ? '/login' : '/sign-up'}>
              {isSignUp || isForgotPassword ? 'Sign in' : 'Create an account'} <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </p>}
          <p className="auth-privacy">Your records are private and protected by your account.</p>
        </div>
      </section>
    </main>
  )
}
