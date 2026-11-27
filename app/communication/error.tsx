'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import styles from '@/features/quests/quests.module.css'

export default function CommunicationError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[LifeOS] Communication page failed to render:', error.digest ?? 'unknown error')
  }, [error])

  return (
    <main className={styles.errorPage}>
      <p className={styles.kicker}>COMMUNICATION</p>
      <h1>This page could not be loaded.</h1>
      <p className={styles.mutedNote}>Your records were not changed. You can retry or return to the overview.</p>
      <div className={styles.errorActions}>
        <Button type="button" onClick={() => reset()}>Try again</Button>
        <Link href="/" className={styles.subtleLink}>Return to overview</Link>
      </div>
    </main>
  )
}
