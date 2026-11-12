'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import styles from '@/features/habits/habit-management.module.css'

export default function HabitsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[LifeOS] Habit workspace failed to render:', error.digest ?? 'unknown error')
  }, [error])

  return (
    <main className={styles.errorPage}>
      <p className={styles.kicker}>HABIT WORKSPACE</p>
      <h1>This page could not be loaded.</h1>
      <p>Your saved records were not changed. You can retry or return to the dashboard.</p>
      <div className={styles.errorActions}>
        <Button type="button" onClick={() => reset()}>Try again</Button>
        <Link href="/" className={styles.subtleLink}>Return to overview</Link>
      </div>
    </main>
  )
}
