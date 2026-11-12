import Link from 'next/link'
import { MailCheck } from 'lucide-react'

export default function SignUpSuccessPage() {
  return (
    <main className="auth-layout auth-layout-centered">
      <section className="auth-main" aria-labelledby="confirmation-title">
        <div className="auth-card confirmation-card">
          <span className="confirmation-icon"><MailCheck size={24} aria-hidden="true" /></span>
          <p className="eyebrow">ONE LAST STEP</p>
          <h1 id="confirmation-title">Check your inbox.</h1>
          <p className="confirmation-copy">If this address can receive a confirmation email, you&apos;ll find a link there to activate your private LifeOS workspace.</p>
          <Link className="auth-submit confirmation-link" href="/login">Return to sign in</Link>
          <p className="auth-privacy">No email yet? Check your spam folder or try again in a few minutes.</p>
        </div>
      </section>
    </main>
  )
}
