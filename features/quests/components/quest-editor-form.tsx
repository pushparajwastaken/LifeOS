import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  QUEST_DIFFICULTIES,
  QUEST_DIFFICULTY_LABELS,
  QUEST_LIMITS,
  QUEST_PILLARS,
  QUEST_PILLAR_LABELS,
  QUEST_STRUCTURES,
  QUEST_STRUCTURE_LABELS,
} from '../quest-domain'
import type { Quest } from '../quest-service'
import styles from '../quests.module.css'
import { SubmitButton } from './submit-button'

type QuestEditorFormProps = {
  action: (formData: FormData) => Promise<void>
  quest?: Quest
  submitLabel: string
  pendingLabel: string
}

export function QuestEditorForm({ action, quest, submitLabel, pendingLabel }: QuestEditorFormProps) {
  const prefix = quest ? `quest-${quest.id}` : 'new-quest'
  return (
    <form action={action} className={styles.editorForm}>
      {quest ? <input type="hidden" name="questId" value={quest.id} /> : null}
      <div className={styles.fieldGrid}>
        <Field className={styles.fieldWide}>
          <FieldLabel htmlFor={`${prefix}-title`}>What do you want to become capable of?</FieldLabel>
          <Input id={`${prefix}-title`} name="title" required maxLength={QUEST_LIMITS.title} defaultValue={quest?.title ?? ''} placeholder="e.g. Computer architecture" />
        </Field>
        <Field className={styles.fieldWide}>
          <FieldLabel htmlFor={`${prefix}-description`}>Description</FieldLabel>
          <Textarea id={`${prefix}-description`} name="description" maxLength={QUEST_LIMITS.description} defaultValue={quest?.description ?? ''} placeholder="Why this matters to you, and what “capable” would look like." />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-structure`}>Structure</FieldLabel>
          <select id={`${prefix}-structure`} name="structure" className={styles.nativeSelect} defaultValue={quest?.structure ?? 'exploratory'}>
            {QUEST_STRUCTURES.map((value) => <option key={value} value={value}>{QUEST_STRUCTURE_LABELS[value]}</option>)}
          </select>
          <FieldDescription>Structured quests track milestone progress. Exploratory quests stay open-ended, with no percentage.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-pillar`}>Pillar</FieldLabel>
          <select id={`${prefix}-pillar`} name="pillar" className={styles.nativeSelect} defaultValue={quest?.pillar ?? 'intellectual'}>
            {QUEST_PILLARS.map((value) => <option key={value} value={value}>{QUEST_PILLAR_LABELS[value]}</option>)}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-category`}>Category</FieldLabel>
          <Input id={`${prefix}-category`} name="category" maxLength={QUEST_LIMITS.category} defaultValue={quest?.category ?? ''} placeholder="e.g. Systems" />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-difficulty`}>Difficulty</FieldLabel>
          <select id={`${prefix}-difficulty`} name="difficulty" className={styles.nativeSelect} defaultValue={quest?.difficulty ?? ''}>
            <option value="">Not set</option>
            {QUEST_DIFFICULTIES.map((value) => <option key={value} value={value}>{QUEST_DIFFICULTY_LABELS[value]}</option>)}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-weekly`}>Weekly learning target (minutes)</FieldLabel>
          <Input id={`${prefix}-weekly`} name="weeklyTargetMinutes" type="number" inputMode="numeric" min={1} max={QUEST_LIMITS.weeklyTargetMinutes} step={1} defaultValue={quest?.weekly_target_minutes ?? ''} placeholder="Optional" />
          <FieldDescription>Optional. Progress against it appears once learning sessions are available.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${prefix}-target`}>Target date</FieldLabel>
          <Input id={`${prefix}-target`} name="targetDate" type="date" defaultValue={quest?.target_date ?? ''} />
        </Field>
      </div>
      <div className={styles.editorFooter}>
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </form>
  )
}
