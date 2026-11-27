'use client'

import { useFormStatus } from 'react-dom'
import styles from '../quests.module.css'

/** Square icon button for row actions; disabled while its form is submitting, so a double click sends once. */
export function IconSubmitButton({ label, children, done }: { label: string; children: React.ReactNode; done?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={styles.iconButton} data-done={done ? 'true' : undefined} aria-label={label} title={label} disabled={pending} aria-busy={pending || undefined}>
      {children}
    </button>
  )
}
