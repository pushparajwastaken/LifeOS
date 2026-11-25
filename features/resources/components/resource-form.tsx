import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/features/quests/components/submit-button'
import styles from '@/features/quests/quests.module.css'
import { RESOURCE_LIMITS, RESOURCE_TYPES, RESOURCE_TYPE_LABELS } from '../resource-domain'
import type { Resource } from '../resource-service'

type ResourceFormProps = {
  action: (formData: FormData) => Promise<void>
  returnTo: string
  resource?: Resource
  questId?: string
  submitLabel: string
  compact?: boolean
}

export function ResourceForm({ action, returnTo, resource, questId, submitLabel, compact = false }: ResourceFormProps) {
  const prefix = resource ? `resource-${resource.id}` : questId ? `quest-resource-${questId}` : 'new-resource'
  return (
    <form action={action} className={styles.editorForm}>
      <input type="hidden" name="returnTo" value={returnTo} />
      {resource ? <input type="hidden" name="resourceId" value={resource.id} /> : null}
      {questId ? <input type="hidden" name="questId" value={questId} /> : null}
      <div className={styles.fieldGrid}>
        <Field className={styles.fieldWide}>
          <FieldLabel htmlFor={`${prefix}-url`}>Link</FieldLabel>
          <Input id={`${prefix}-url`} name="url" type="url" required maxLength={RESOURCE_LIMITS.url} defaultValue={resource?.url ?? ''} placeholder="https://" />
          {resource ? null : <FieldDescription>LifeOS does not visit the link. Saving a link you already have opens the existing one instead of creating a duplicate.</FieldDescription>}
        </Field>
        <Field className={compact ? styles.fieldWide : undefined}>
          <FieldLabel htmlFor={`${prefix}-title`}>Title</FieldLabel>
          <Input id={`${prefix}-title`} name="title" maxLength={RESOURCE_LIMITS.title} defaultValue={resource?.title ?? ''} placeholder={resource ? '' : 'Optional; derived from the link if empty'} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-type`}>Type</FieldLabel>
          <select id={`${prefix}-type`} name="resourceType" className={styles.nativeSelect} defaultValue={resource?.resource_type ?? ''}>
            {resource ? null : <option value="">Detect from link</option>}
            {RESOURCE_TYPES.map((type) => <option key={type} value={type}>{RESOURCE_TYPE_LABELS[type]}</option>)}
          </select>
        </Field>
        {compact ? null : (
          <>
            <Field>
              <FieldLabel htmlFor={`${prefix}-category`}>Category</FieldLabel>
              <Input id={`${prefix}-category`} name="category" maxLength={RESOURCE_LIMITS.category} defaultValue={resource?.category ?? ''} placeholder="Optional" />
            </Field>
            <Field className={styles.fieldWide}>
              <FieldLabel htmlFor={`${prefix}-notes`}>Notes</FieldLabel>
              <Textarea id={`${prefix}-notes`} name="notes" maxLength={RESOURCE_LIMITS.notes} defaultValue={resource?.notes ?? ''} />
            </Field>
          </>
        )}
      </div>
      <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton></div>
    </form>
  )
}
