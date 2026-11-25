import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { QUEST_PILLAR_LABELS } from '@/features/quests/quest-domain'
import styles from '@/features/quests/quests.module.css'
import { SESSION_LIMITS, SESSION_PILLARS, SESSION_TYPES, SESSION_TYPE_LABELS, utcToZonedParts } from '../learning-domain'
import type { ResourceOption } from '@/features/resources/resource-service'
import type { QuestOption, SessionRow } from '../learning-service'

type SessionFormProps = {
  action: (formData: FormData) => Promise<void>
  timeZone: string
  today: string
  returnTo: string
  quests?: QuestOption[]
  resources?: ResourceOption[]
  fixedQuestId?: string
  fixedResourceId?: string
  session?: SessionRow
  submitLabel: string
}

/** Create or edit a learning session. Date and time are entered in the user's profile timezone. */
export function SessionForm({ action, timeZone, today, returnTo, quests = [], resources = [], fixedQuestId, fixedResourceId, session, submitLabel }: SessionFormProps) {
  const prefix = session ? `session-${session.id}` : fixedQuestId ? `quest-session-${fixedQuestId}` : 'new-session'
  const start = session ? utcToZonedParts(session.started_at, timeZone) : { date: today, time: utcToZonedParts(new Date().toISOString(), timeZone).time }
  return (
    <form action={action} className={styles.editorForm}>
      <input type="hidden" name="returnTo" value={returnTo} />
      {session ? <input type="hidden" name="sessionId" value={session.id} /> : null}
      {fixedQuestId ? <input type="hidden" name="questId" value={fixedQuestId} /> : null}
      {fixedResourceId ? <input type="hidden" name="resourceId" value={fixedResourceId} /> : null}
      <div className={styles.fieldGrid}>
        {fixedQuestId ? null : (
          <Field>
            <FieldLabel htmlFor={`${prefix}-quest`}>Side quest</FieldLabel>
            <select id={`${prefix}-quest`} name="questId" className={styles.nativeSelect} defaultValue={session?.quest_id ?? ''}>
              <option value="">No quest (standalone)</option>
              {session?.quest_id && !quests.some((quest) => quest.id === session.quest_id)
                ? <option value={session.quest_id}>Current quest (keep)</option>
                : null}
              {quests.map((quest) => <option key={quest.id} value={quest.id}>{quest.title}</option>)}
            </select>
          </Field>
        )}
        {fixedResourceId ? null : (
          <Field>
            <FieldLabel htmlFor={`${prefix}-resource`}>Resource</FieldLabel>
            <select id={`${prefix}-resource`} name="resourceId" className={styles.nativeSelect} defaultValue={session?.resource_id ?? ''}>
              <option value="">No resource</option>
              {session?.resource_id && !resources.some((resource) => resource.id === session.resource_id)
                ? <option value={session.resource_id}>Current resource (keep)</option>
                : null}
              {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.title}</option>)}
            </select>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor={`${prefix}-topic`}>Topic</FieldLabel>
          <Input id={`${prefix}-topic`} name="topic" maxLength={SESSION_LIMITS.topic} defaultValue={session?.topic ?? ''} placeholder={fixedQuestId ? 'Optional' : 'Required without a quest'} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-type`}>Type</FieldLabel>
          <select id={`${prefix}-type`} name="sessionType" className={styles.nativeSelect} defaultValue={session?.session_type ?? 'study'}>
            {SESSION_TYPES.map((type) => <option key={type} value={type}>{SESSION_TYPE_LABELS[type]}</option>)}
          </select>
        </Field>
        {fixedQuestId ? null : (
          <Field>
            <FieldLabel htmlFor={`${prefix}-pillar`}>Pillar</FieldLabel>
            <select id={`${prefix}-pillar`} name="pillar" className={styles.nativeSelect} defaultValue={session?.pillar ?? ''}>
              <option value="">Not set</option>
              {SESSION_PILLARS.map((pillar) => <option key={pillar} value={pillar}>{QUEST_PILLAR_LABELS[pillar]}</option>)}
            </select>
            <FieldDescription>Used for standalone sessions; quest sessions use the quest&apos;s pillar.</FieldDescription>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor={`${prefix}-date`}>Date</FieldLabel>
          <Input id={`${prefix}-date`} name="date" type="date" required defaultValue={start.date} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-time`}>Start time</FieldLabel>
          <Input id={`${prefix}-time`} name="time" type="time" required defaultValue={start.time} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-minutes`}>Duration (minutes)</FieldLabel>
          <Input id={`${prefix}-minutes`} name="durationMinutes" type="number" inputMode="numeric" required min={SESSION_LIMITS.minMinutes} max={SESSION_LIMITS.maxMinutes} step={1} defaultValue={session?.duration_minutes ?? ''} />
        </Field>
        <Field className={styles.fieldWide}>
          <FieldLabel htmlFor={`${prefix}-notes`}>Notes</FieldLabel>
          <Textarea id={`${prefix}-notes`} name="notes" maxLength={SESSION_LIMITS.notes} defaultValue={session?.notes ?? ''} placeholder="What did you work on?" />
        </Field>
      </div>
      <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton></div>
    </form>
  )
}
