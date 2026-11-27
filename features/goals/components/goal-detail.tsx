import Link from 'next/link'
import { ArrowLeft, Check, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import {
  addGoalMilestoneAction,
  addProgressAction,
  deleteGoalAction,
  deleteGoalMilestoneAction,
  deleteProgressAction,
  setGoalStatusAction,
  toggleGoalMilestoneAction,
  updateGoalAction,
} from '../goal-actions'
import { GOAL_LIMITS, GOAL_PERIOD_LABELS, GOAL_PILLAR_LABELS, GOAL_STATUS_LABELS, formatGoalValue, type GoalIntent, type GoalPeriod, type GoalPillar } from '../goal-domain'
import type { getGoalDetail } from '../goal-service'
import { GoalFields } from './goal-fields'
import { periodLabel, progressLabel } from './goals-list'

type Detail = NonNullable<Awaited<ReturnType<typeof getGoalDetail>>>

const STATUS_ACTIONS: Record<string, Array<{ intent: GoalIntent; label: string }>> = {
  active: [{ intent: 'complete', label: 'Mark achieved' }, { intent: 'pause', label: 'Pause' }, { intent: 'abandon', label: 'Let it go' }],
  paused: [{ intent: 'resume', label: 'Resume' }, { intent: 'complete', label: 'Mark achieved' }, { intent: 'abandon', label: 'Let it go' }],
  completed: [{ intent: 'reopen', label: 'Reopen' }],
  abandoned: [{ intent: 'reopen', label: 'Reopen' }],
}

function Hidden({ goalId }: { goalId: string }) {
  return <input type="hidden" name="goalId" value={goalId} />
}

export function GoalDetail({ data, today, timeZone, notice }: { data: Detail; today: string; timeZone: string; notice?: string }) {
  const { goal, entries, milestones, progress } = data
  const message = resolveNotice(notice)
  const dateTime = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' })
  const dueFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
  const summary = { ...goal, progress, latest: entries[0] ?? null, milestoneCount: milestones.length }
  return (
    <div className={styles.page}>
      <Link href="/goals" className={styles.subtleLink}><ArrowLeft size={14} aria-hidden="true" /> Goals</Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>{GOAL_PILLAR_LABELS[goal.pillar as GoalPillar] ?? goal.pillar} · {GOAL_PERIOD_LABELS[goal.period as GoalPeriod] ?? goal.period} · {GOAL_STATUS_LABELS[goal.status].toUpperCase()}</p>
          <h1>{goal.title}</h1>
          {goal.description ? <p className={styles.heroCopy}>{goal.description}</p> : null}
          <p className={styles.itemMeta}>{periodLabel(goal.starts_on, goal.ends_on, today)}</p>
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some progress or milestones could not be loaded. Refresh to try again.</p> : null}

      <section className={styles.panel} aria-labelledby="progress-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>PROGRESS</p><h2 id="progress-title">{progressLabel(summary)}</h2></div></div>
        {progress.kind !== 'none' ? <Progress value={progress.percent} aria-label="Goal progress" style={{ maxWidth: 480 }} /> : null}
        <div className={styles.inlineForm} style={{ marginTop: 14 }}>
          {STATUS_ACTIONS[goal.status].map(({ intent, label }) => (
            <form key={intent} action={setGoalStatusAction} style={{ display: 'inline' }}>
              <Hidden goalId={goal.id} />
              <input type="hidden" name="intent" value={intent} />
              <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">{label}</SubmitButton>
            </form>
          ))}
        </div>
      </section>

      {goal.target_value !== null ? (
        <section className={styles.panel} id="log-progress" aria-labelledby="log-title">
          <div className={styles.sectionHeader}><div><p className={styles.kicker}>READINGS</p><h2 id="log-title">Log where you stand</h2></div></div>
          <p className={styles.mutedNote} style={{ marginTop: 0 }}>Enter your current total{goal.unit ? ` in ${goal.unit}` : ''}, not the amount added. The latest reading is compared with the target of {formatGoalValue(goal.target_value, goal.unit)}.</p>
          <form action={addProgressAction} className={styles.editorForm}>
            <Hidden goalId={goal.id} />
            <div className={styles.fieldGrid}>
              <Field>
                <FieldLabel htmlFor="progress-value">Current total{goal.unit ? ` (${goal.unit})` : ''}</FieldLabel>
                <Input id="progress-value" name="value" inputMode="decimal" required maxLength={14} />
              </Field>
              <Field>
                <FieldLabel htmlFor="progress-date">Date</FieldLabel>
                <Input id="progress-date" name="date" type="date" required max={today} defaultValue={today} />
              </Field>
              <Field style={{ gridColumn: '1 / -1' }}>
                <FieldLabel htmlFor="progress-note">Note (optional)</FieldLabel>
                <Input id="progress-note" name="note" maxLength={GOAL_LIMITS.note} />
              </Field>
            </div>
            <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…"><Plus size={15} aria-hidden="true" /> Log reading</SubmitButton></div>
          </form>
          {entries.length > 0 ? (
            <ul className={styles.itemList}>
              {entries.map((entry, index) => (
                <li key={entry.id} className={styles.checkItem}>
                  <span className={styles.statusBadge}>{formatGoalValue(entry.value, goal.unit)}</span>
                  <span className={styles.itemTitle}>{dateTime.format(new Date(entry.recorded_at))}{index === 0 ? ' · latest' : ''}{entry.note ? <span className={styles.itemMeta}>{entry.note}</span> : null}</span>
                  <form action={deleteProgressAction}>
                    <Hidden goalId={goal.id} />
                    <input type="hidden" name="entryId" value={entry.id} />
                    <button type="submit" className={styles.iconButton} aria-label={`Delete the reading from ${dateTime.format(new Date(entry.recorded_at))}`}><Trash2 size={14} aria-hidden="true" /></button>
                  </form>
                </li>
              ))}
            </ul>
          ) : <p className={styles.mutedNote}>No readings yet.</p>}
        </section>
      ) : null}

      <section className={styles.panel} id="milestones" aria-labelledby="milestones-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>MILESTONES</p><h2 id="milestones-title">Steps along the way</h2></div></div>
        {milestones.length > 0 ? (
          <ul className={styles.itemList}>
            {milestones.map((milestone) => (
              <li key={milestone.id} className={styles.checkItem} data-done={milestone.completed_at ? 'true' : undefined}>
                <form action={toggleGoalMilestoneAction}>
                  <Hidden goalId={goal.id} />
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <input type="hidden" name="done" value={milestone.completed_at ? 'false' : 'true'} />
                  <button type="submit" className={styles.iconButton} data-done={milestone.completed_at ? 'true' : undefined} aria-label={milestone.completed_at ? `Reopen “${milestone.title}”` : `Mark “${milestone.title}” reached`}>
                    {milestone.completed_at ? <RotateCcw size={14} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                  </button>
                </form>
                <span className={styles.itemTitle}>{milestone.title}<span className={styles.itemMeta}>{[milestone.due_on ? `Target ${dueFormat.format(new Date(`${milestone.due_on}T00:00:00Z`))}` : null, milestone.completed_at ? `Reached ${dateTime.format(new Date(milestone.completed_at))}` : null].filter(Boolean).join(' · ')}</span></span>
                <form action={deleteGoalMilestoneAction}>
                  <Hidden goalId={goal.id} />
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <button type="submit" className={styles.iconButton} aria-label={`Delete milestone “${milestone.title}”`}><Trash2 size={14} aria-hidden="true" /></button>
                </form>
              </li>
            ))}
          </ul>
        ) : <p className={styles.mutedNote}>No milestones yet. Break the goal into a few checkpoints if that helps.</p>}
        <form action={addGoalMilestoneAction} className={styles.searchForm} style={{ marginTop: 12 }}>
          <Hidden goalId={goal.id} />
          <label className="sr-only" htmlFor="milestone-title">Milestone</label>
          <Input id="milestone-title" name="title" required maxLength={GOAL_LIMITS.title} placeholder="Add a milestone" />
          <label className="sr-only" htmlFor="milestone-due">Target date</label>
          <Input id="milestone-due" name="dueOn" type="date" style={{ width: 'auto' }} />
          <SubmitButton variant="outline" size="sm" pendingLabel="Adding…"><Plus size={14} aria-hidden="true" /> Add</SubmitButton>
        </form>
      </section>

      <section className={styles.panel} id="edit-goal" aria-labelledby="edit-goal-heading">
        <details>
          <summary className={styles.sectionHeader}><div><p className={styles.kicker}>DETAILS</p><h2 id="edit-goal-heading">Edit goal</h2></div></summary>
          <form action={updateGoalAction} className={styles.editorForm}>
            <Hidden goalId={goal.id} />
            <GoalFields prefix="edit-goal" goal={goal} today={today} />
            <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…">Save goal</SubmitButton></div>
          </form>
        </details>
      </section>

      <section className={styles.panel} id="delete-goal" aria-labelledby="delete-goal-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>DANGER ZONE</p><h2 id="delete-goal-title">Delete goal</h2></div></div>
        <p className={styles.mutedNote} style={{ marginTop: 0 }}>Deleting removes the goal with all its readings and milestones. To stop working on it but keep the history, choose “Let it go” instead.</p>
        <form action={deleteGoalAction} className={styles.inlineForm}>
          <Hidden goalId={goal.id} />
          <label className={styles.itemMeta} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 0 }}>
            <input type="checkbox" name="confirm" value="delete" required /> Delete permanently (cannot be undone)
          </label>
          <SubmitButton variant="outline" size="sm" pendingLabel="Deleting…"><Trash2 size={13} aria-hidden="true" /> Delete goal</SubmitButton>
        </form>
      </section>
    </div>
  )
}
