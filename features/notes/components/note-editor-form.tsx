import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/features/quests/components/submit-button'
import styles from '@/features/quests/quests.module.css'
import { NOTE_LIMITS, NOTE_TYPES, NOTE_TYPE_LABELS, type NoteType } from '../note-domain'

type NoteEditorFormProps = {
  action: (formData: FormData) => Promise<void>
  note?: { id: string; title: string; note_type: NoteType; body: string; source_url: string | null }
  submitLabel: string
}

export function NoteEditorForm({ action, note, submitLabel }: NoteEditorFormProps) {
  const prefix = note ? `note-${note.id}` : 'new-note'
  return (
    <form action={action} className={styles.editorForm}>
      {note ? <input type="hidden" name="noteId" value={note.id} /> : <input type="hidden" name="returnTo" value="/knowledge" />}
      <div className={styles.fieldGrid}>
        <Field className={styles.fieldWide}>
          <FieldLabel htmlFor={`${prefix}-title`}>Title</FieldLabel>
          <Input id={`${prefix}-title`} name="title" required maxLength={NOTE_LIMITS.title} defaultValue={note?.title ?? ''} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-type`}>Type</FieldLabel>
          <select id={`${prefix}-type`} name="noteType" className={styles.nativeSelect} defaultValue={note?.note_type ?? 'idea'}>
            {NOTE_TYPES.map((type) => <option key={type} value={type}>{NOTE_TYPE_LABELS[type]}</option>)}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-source`}>Source link</FieldLabel>
          <Input id={`${prefix}-source`} name="sourceUrl" type="url" maxLength={NOTE_LIMITS.sourceUrl} defaultValue={note?.source_url ?? ''} placeholder="https://" />
          <FieldDescription>Optional. Only http and https links are saved.</FieldDescription>
        </Field>
        <Field className={styles.fieldWide}>
          <FieldLabel htmlFor={`${prefix}-body`}>Note</FieldLabel>
          <Textarea id={`${prefix}-body`} name="body" rows={12} maxLength={NOTE_LIMITS.body} defaultValue={note?.body ?? ''} />
        </Field>
      </div>
      <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton></div>
    </form>
  )
}
