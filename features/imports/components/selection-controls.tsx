'use client'

import { Button } from '@/components/ui/button'

/** Select or clear all candidate checkboxes in the import form (new items only, or everything). */
export function SelectionControls({ formId }: { formId: string }) {
  const setAll = (checked: boolean, onlyNew: boolean) => {
    const form = document.getElementById(formId)
    if (!form) return
    form.querySelectorAll<HTMLInputElement>('input[name="candidate"]').forEach((input) => {
      if (onlyNew && input.dataset.existing === 'true') {
        input.checked = false
        return
      }
      input.checked = checked
    })
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <Button type="button" variant="outline" size="sm" onClick={() => setAll(true, true)}>Select all new</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setAll(true, false)}>Select everything</Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setAll(false, false)}>Clear selection</Button>
    </div>
  )
}
