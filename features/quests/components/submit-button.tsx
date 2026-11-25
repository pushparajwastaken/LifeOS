'use client'

import { useFormStatus } from 'react-dom'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import styles from '../quests.module.css'

type SubmitButtonProps = {
  children: React.ReactNode
  pendingLabel: string
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost'
  size?: 'default' | 'sm'
  className?: string
  ariaLabel?: string
}

export function SubmitButton({ children, pendingLabel, variant = 'default', size = 'default', className, ariaLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={className} aria-label={ariaLabel}>
      {pending ? <LoaderCircle data-icon="inline-start" className={styles.submitSpinner} aria-hidden="true" /> : null}
      {pending ? pendingLabel : children}
    </Button>
  )
}
