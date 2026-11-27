import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import styles from '@/features/quests/quests.module.css'
import { GOAL_LIMITS, GOAL_PERIODS, GOAL_PERIOD_LABELS, GOAL_PILLARS, GOAL_PILLAR_LABELS } from '../goal-domain'
import type { GoalRow } from '../goal-service'

/** Fields shared by the create and edit goal forms. */
export function GoalFields({ prefix, goal, today }: { prefix: string; goal?: GoalRow; today: string }) {
  return (
    <div className={styles.fieldGrid}>
      <Field style={{ gridColumn: '1 / -1' }}>
        <FieldLabel htmlFor={`${prefix}-title`}>Goal</FieldLabel>
        <Input id={`${prefix}-title`} name="title" required maxLength={GOAL_LIMITS.title} defaultValue={goal?.title ?? ''} placeholder="For example: Run 300 km this quarter" />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-pillar`}>Pillar</FieldLabel>
        <select id={`${prefix}-pillar`} name="pillar" required className={styles.nativeSelect} defaultValue={goal?.pillar ?? 'personal'}>
          {GOAL_PILLARS.map((pillar) => <option key={pillar} value={pillar}>{GOAL_PILLAR_LABELS[pillar]}</option>)}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-period`}>Length</FieldLabel>
        <select id={`${prefix}-period`} name="period" className={styles.nativeSelect} defaultValue={goal?.period ?? '90_day'}>
          {GOAL_PERIODS.map((period) => <option key={period} value={period}>{GOAL_PERIOD_LABELS[period]}</option>)}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-start`}>Starts</FieldLabel>
        <Input id={`${prefix}-start`} name="startsOn" type="date" required defaultValue={goal?.starts_on ?? today} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-end`}>Ends (custom length only)</FieldLabel>
        <Input id={`${prefix}-end`} name="endsOn" type="date" defaultValue={goal?.period === 'custom' ? goal.ends_on : ''} />
        <FieldDescription>30 days, 90 days and one year are counted from the start date.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-target`}>Target (optional)</FieldLabel>
        <Input id={`${prefix}-target`} name="targetValue" inputMode="decimal" maxLength={14} defaultValue={goal?.target_value ?? ''} placeholder="300" />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-unit`}>Unit</FieldLabel>
        <Input id={`${prefix}-unit`} name="unit" maxLength={GOAL_LIMITS.unit} defaultValue={goal?.unit ?? ''} placeholder="km" />
        <FieldDescription>Without a target, progress comes from milestones.</FieldDescription>
      </Field>
      <Field style={{ gridColumn: '1 / -1' }}>
        <FieldLabel htmlFor={`${prefix}-description`}>Why it matters (optional)</FieldLabel>
        <Textarea id={`${prefix}-description`} name="description" maxLength={GOAL_LIMITS.description} defaultValue={goal?.description ?? ''} />
      </Field>
    </div>
  )
}
