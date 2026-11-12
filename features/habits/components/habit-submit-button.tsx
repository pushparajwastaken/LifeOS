'use client'

import { useFormStatus } from 'react-dom'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import styles from '../habit-management.module.css'

type HabitSubmitButtonProps = {
  children: React.ReactNode
  pendingLabel: string
  variant?: 'default' | 'outline' | 'secondary'
  className?: string
  disabled?: boolean
}

export function HabitSubmitButton({
  children,
  pendingLabel,
  variant = 'default',
  className,
  disabled = false,
}: HabitSubmitButtonProps) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} disabled={pending || disabled} className={className}>
      {pending ? <LoaderCircle data-icon="inline-start" className={styles.submitSpinner} aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </Button>
  )
}
