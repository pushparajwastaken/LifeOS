import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveHabitCheckInAction } from '../habit-actions'
import {
  FAILURE_REASONS,
  getHabitEffectiveEndDate,
  getLatestUnloggedScheduledDate,
  type Habit,
  type HabitLog,
} from '../habit-domain'
import { HabitSubmitButton } from './habit-submit-button'
import styles from '../habit-management.module.css'

export function HabitReflectionForm({
  habit,
  logs,
  today,
  origin,
}: {
  habit: Habit
  logs: HabitLog[]
  today: string
  origin: 'overview' | 'detail'
}) {
  const end = getHabitEffectiveEndDate(habit, today, logs)
  const defaultDate = getLatestUnloggedScheduledDate(habit, logs, today)
  if (!defaultDate) {
    return <p className={styles.mutedNote}>There are no unrecorded scheduled opportunities to reflect on. Existing check-ins stay unchanged.</p>
  }
  const existingReflection = logs.find((log) => log.habit_id === habit.id && log.log_date === defaultDate && log.status === 'skipped')

  return (
    <details className={styles.reflectionDetails}>
      <summary>Reflect on a missed day</summary>
      <form action={saveHabitCheckInAction} className={styles.reflectionForm}>
        <input type="hidden" name="habitId" value={habit.id} />
        <input type="hidden" name="origin" value={origin} />
        <input type="hidden" name="mode" value="skip" />
        <FieldGroup className={styles.reflectionFields}>
          <Field>
            <FieldLabel htmlFor={`reflection-date-${habit.id}`}>Scheduled day</FieldLabel>
            <Input
              id={`reflection-date-${habit.id}`}
              name="logDate"
              type="date"
              min={habit.schedule.startDate}
              max={end < today ? end : today}
              defaultValue={defaultDate}
              required
            />
            <FieldDescription>Choose a scheduled day. Completed check-ins are never overwritten; an existing reflection can be edited.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`reflection-reason-${habit.id}`}>What got in the way?</FieldLabel>
            <Select name="skippedReason"               defaultValue={existingReflection?.skipped_reason ?? 'forgot'}>
              <SelectTrigger id={`reflection-reason-${habit.id}`} className={styles.selectTrigger}>
                <SelectValue placeholder="Choose the closest fit" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {FAILURE_REASONS.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field className={styles.fieldWide}>
            <FieldLabel htmlFor={`reflection-prevented-${habit.id}`}>What actually prevented this attempt?</FieldLabel>
            <Textarea id={`reflection-prevented-${habit.id}`} name="prevented" maxLength={1200} placeholder="A few words are enough; this is information, not a judgment." />
          </Field>
          <Field className={styles.fieldWide}>
            <FieldLabel htmlFor={`reflection-system-${habit.id}`}>Was it the cue, environment, timing, difficulty or reward?</FieldLabel>
            <Textarea id={`reflection-system-${habit.id}`} name="systemArea" maxLength={1200} placeholder="Notice which part of the system could change." />
          </Field>
          <Field className={styles.fieldWide}>
            <FieldLabel htmlFor={`reflection-adjustment-${habit.id}`}>What small adjustment could help next time?</FieldLabel>
            <Textarea id={`reflection-adjustment-${habit.id}`} name="adjustment" maxLength={1200} placeholder="Choose one experiment to try, not a promise to do everything differently." />
          </Field>
        </FieldGroup>
        <ul className={styles.experimentList} aria-label="Small experiments to consider">
          <li>Make the first step smaller.</li>
          <li>Move the cue or prepare the space the night before.</li>
          <li>Attach the habit to a routine that already happens.</li>
          <li>Try a more immediate, meaningful reward.</li>
        </ul>
        <HabitSubmitButton pendingLabel="Saving reflection…" variant="outline">
          Save reflection
        </HabitSubmitButton>
      </form>
    </details>
  )
}
