'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

/** Selects this device's timezone in the picker (the user still saves the form). */
export function DetectTimeZoneButton({ selectId }: { selectId: string }) {
  const [message, setMessage] = useState<string | null>(null)
  function detect() {
    const reported = Intl.DateTimeFormat().resolvedOptions().timeZone
    const select = document.getElementById(selectId) as HTMLSelectElement | null
    const options = select ? [...select.options].map((option) => option.value) : []
    // Browsers may report a legacy alias (for example Asia/Calcutta for Asia/Kolkata): match by what each option resolves to.
    const resolve = (value: string) => { try { return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone } catch { return null } }
    const zone = options.includes(reported) ? reported : options.find((value) => resolve(value) === reported)
    if (!zone || !select) {
      setMessage('This device did not report a timezone LifeOS recognises. Choose it from the list.')
      return
    }
    select.value = zone
    setMessage(`Selected ${zone}. Save to apply it.`)
  }
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <Button type="button" variant="outline" size="sm" onClick={detect}>Use this device’s timezone</Button>
      {message ? <span role="status" style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{message}</span> : null}
    </span>
  )
}
