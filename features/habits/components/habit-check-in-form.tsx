import { Check, Circle, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { saveHabitCheckInAction } from '../habit-actions'
import { displayHabitLogNote, type Habit, type HabitLog } from '../habit-domain'
import { HabitSubmitButton } from './habit-submit-button'
import styles from '../habit-management.module.css'

type CheckInHabit = Pick<Habit, 'id' | 'name' | 'tracking_type' | 'target_value' | 'unit' | 'schedule'>
type CheckInLog = Pick<HabitLog, 'value' | 'duration_seconds'> & { status: string; note?: string | null }

export function HabitCheckInForm({
  habit,
  date,
  log,
  origin,
  compact = false,
}: {
  habit: CheckInHabit
  date: string
  log?: CheckInLog
  origin: 'dashboard' | 'overview' | 'detail'
  compact?: boolean
}) {
  const durationUnit = habit.tracking_type === 'duration' ? getDurationUnit(habit.unit) : null
  const existingValue = habit.tracking_type === 'duration'
    ? log?.duration_seconds === null || log?.duration_seconds === undefined || !durationUnit
      ? ''
      : Math.round((log.duration_seconds / durationUnit.secondsPerUnit) * 100) / 100
    : log?.value ?? ''
  const hasMinimum = Boolean(habit.schedule.behavior.twoMinuteVersion || habit.schedule.behavior.smallestCompletion)
  const isComplete = log?.status === 'completed'
  const isPartial = log?.status === 'partial'

  return (
    <div className={`${styles.checkIn} ${compact ? styles.checkInCompact : ''}`}>
      {habit.schedule.behavior.twoMinuteVersion ? (
        <p className={styles.minimumPrompt}>
          <span>On a hard day</span>
          {habit.schedule.behavior.twoMinuteVersion}
        </p>
      ) : null}
      <form action={saveHabitCheckInAction} className={styles.checkInForm}>
        <input type="hidden" name="habitId" value={habit.id} />
        <input type="hidden" name="logDate" value={date} />
        <input type="hidden" name="origin" value={origin} />
        {habit.tracking_type !== 'boolean' ? (
          <Field className={styles.measurementField}>
            <FieldLabel htmlFor={`checkin-${habit.id}-${date}`}>
              {habit.tracking_type === 'duration' ? `Time in ${durationUnit?.label ?? 'minutes'}` : `Amount in ${habit.unit ?? 'units'}`}
            </FieldLabel>
            <Input
              id={`checkin-${habit.id}-${date}`}
              name="value"
              type="number"
              min="0"
              max={durationUnit?.maxPerDay ?? 1_000_000}
              step={durationUnit?.step ?? 'any'}
              defaultValue={existingValue}
              required
            />
            {habit.target_value !== null ? (
              <FieldDescription>Full target: {habit.target_value} {habit.unit}</FieldDescription>
            ) : null}
          </Field>
        ) : null}
        {!compact ? (
          <details className={styles.checkInNotes}>
            <summary>Add a note</summary>
            <Field>
              <FieldLabel htmlFor={`checkin-note-${habit.id}-${date}`}>What would you like to remember?</FieldLabel>
              <Textarea
                id={`checkin-note-${habit.id}-${date}`}
                name="note"
                maxLength={3000}
                defaultValue={displayHabitLogNote(log?.note ?? null) ?? ''}
              />
            </Field>
          </details>
        ) : null}
        <div className={styles.checkInActions}>
          <HabitSubmitButton
            pendingLabel="Saving…"
            className={styles.actionButton}
            disabled={habit.tracking_type === 'boolean' && isComplete}
          >
            <Check data-icon="inline-start" aria-hidden="true" />
            {isComplete ? 'Completed' : habit.tracking_type === 'boolean' ? 'Mark complete' : 'Save check-in'}
          </HabitSubmitButton>
          {habit.tracking_type === 'boolean' && hasMinimum ? (
            <Button type="submit" variant="outline" name="mode" value="minimum" className={styles.actionButton} disabled={isPartial}>
              <Circle data-icon="inline-start" aria-hidden="true" />
              {isPartial ? 'Minimum done' : 'Log the small version'}
            </Button>
          ) : habit.tracking_type !== 'boolean' && hasMinimum ? (
            <Button type="submit" variant="outline" name="mode" value="minimum" className={styles.actionButton}>
              <Circle data-icon="inline-start" aria-hidden="true" />
              Log a smaller amount
            </Button>
          ) : null}
          {log ? (
            <Button type="submit" formNoValidate variant="ghost" name="mode" value="undo" className={styles.undoButton} aria-label={`Undo ${habit.name} check-in for ${date}`}>
              <Undo2 data-icon="inline-start" aria-hidden="true" /> Undo
            </Button>
          ) : null}
        </div>
      </form>
      {log ? (
        <p className={styles.checkInStatus} role="status">
          <Badge variant={isComplete ? 'secondary' : 'outline'}>
            {isComplete ? 'Full target met' : isPartial ? 'Partial progress' : log.status === 'skipped' ? 'Reflection saved' : 'Rest recorded'}
          </Badge>
          {isPartial && habit.schedule.behavior.smallestCompletion ? <span>{habit.schedule.behavior.smallestCompletion}</span> : null}
        </p>
      ) : null}
    </div>
  )
}

function getDurationUnit(unit: string | null) {
  const normalized = unit?.trim().toLowerCase()
  if (['hour', 'hours', 'hr', 'hrs', 'h'].includes(normalized ?? '')) {
    return { label: unit?.trim() || 'hours', secondsPerUnit: 3600, maxPerDay: 24, step: 0.25 }
  }
  if (['second', 'seconds', 'sec', 'secs', 's'].includes(normalized ?? '')) {
    return { label: unit?.trim() || 'seconds', secondsPerUnit: 1, maxPerDay: 86400, step: 1 }
  }
  return { label: unit?.trim() || 'minutes', secondsPerUnit: 60, maxPerDay: 1440, step: 1 }
}
