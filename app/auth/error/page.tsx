import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <main className="auth-layout auth-layout-centered">
      <section className="auth-main" aria-labelledby="auth-error-title">
        <div className="auth-card confirmation-card">
          <p className="eyebrow">SIGN-IN LINK</p>
          <h1 id="auth-error-title">That link could not be used.</h1>
          <p className="confirmation-copy">It may have expired or already been used. Request a fresh confirmation email and try again.</p>
          <Link className="auth-submit confirmation-link" href="/sign-up">Create an account</Link>
          <p className="auth-privacy">Already confirmed? <Link href="/login">Sign in</Link></p>
        </div>
      </section>
    </main>
  )
}
