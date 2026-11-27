import Link from 'next/link'
import { ArrowRight, CalendarCheck, Check, ChevronLeft, ChevronRight, Plus, Undo2 } from 'lucide-react'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PILLAR_LABELS, type HabitPillar } from '@/features/habits/habit-domain'
import { formatDuration } from '@/features/learning/learning-domain'
import { IconSubmitButton } from '@/features/quests/components/icon-submit-button'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { createTaskPageAction, setTaskStatusAction } from '@/features/tasks/task-actions'
import { TASK_LIMITS, TASK_PRIORITY_LABELS, type TaskPriority } from '@/features/tasks/task-domain'
import { planTaskAction, saveDailyReviewAction } from '../planner-actions'
import { PLANNER_LIMITS, REVIEW_PROMPTS, addDays, plannedLoad, plannerHref, type PlanIntent } from '../planner-domain'
import type { PlannerData, PlannerTask } from '../planner-service'

type Props = { data: PlannerData; today: string; timeZone: string; notice?: string }

const HABIT_STATUS: Record<string, string> = { completed: 'Done', complete: 'Done', partial: 'Partly done', skipped: 'Skipped', rest: 'Rest day' }

function dayLabel(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(new Date(`${date}T00:00:00Z`))
}

function PlanButton({ task, intent, date, label, children }: { task: PlannerTask; intent: PlanIntent; date: string; label: string; children: React.ReactNode }) {
  return (
    <form action={planTaskAction} style={{ display: 'inline' }}>
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="expectedDue" value={task.dueAt ?? ''} />
      <IconSubmitButton label={label}>{children}</IconSubmitButton>
    </form>
  )
}

function CompleteButton({ task, returnTo }: { task: PlannerTask; returnTo: string }) {
  return (
    <form action={setTaskStatusAction}>
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="intent" value="complete" />
      <input type="hidden" name="returnTo" value={returnTo} />
      <IconSubmitButton label={`Mark “${task.title}” done`}><Check size={15} aria-hidden="true" /></IconSubmitButton>
    </form>
  )
}

function taskMeta(task: PlannerTask, timeZone: string, showDate = false) {
  const due = task.dueAt
    ? showDate
      ? `Was due ${new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(new Date(task.dueAt))}`
      : task.dueTime && task.dueTime !== '23:59' ? `At ${new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(task.dueAt))}` : null
    : null
  return [`${TASK_PRIORITY_LABELS[task.priority as TaskPriority] ?? task.priority} priority`, due, task.estimatedMinutes ? formatDuration(task.estimatedMinutes) : null].filter(Boolean).join(' · ')
}

export function DailyPlanner({ data, today, timeZone, notice }: Props) {
  const message = resolveNotice(notice)
  const { date } = data
  const returnTo = plannerHref(date, today)
  const isToday = date === today
  const isPast = date < today
  const load = plannedLoad(data.planned)
  const habitsDone = data.habits.filter((habit) => habit.status === 'completed' || habit.status === 'complete').length
  const learned = data.sessions.reduce((sum, session) => sum + session.minutes, 0)
  const relative = isToday ? 'Today' : date === addDays(today, 1) ? 'Tomorrow' : date === addDays(today, -1) ? 'Yesterday' : null

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>DAILY PLANNER{relative ? ` · ${relative.toUpperCase()}` : ''}</p>
          <h1>{dayLabel(date)}</h1>
          <p className={styles.heroCopy}>
            {data.planned.length} {data.planned.length === 1 ? 'task' : 'tasks'} planned
            {load.minutes ? ` · about ${formatDuration(load.minutes)} estimated${load.unestimated ? ` (+${load.unestimated} without an estimate)` : ''}` : ''}
            {data.habits.length ? ` · ${habitsDone} of ${data.habits.length} habits done` : ''}
            {learned ? ` · ${formatDuration(learned)} learning` : ''}
          </p>
        </div>
        <nav className={styles.inlineForm} aria-label="Change day" style={{ marginTop: 0 }}>
          <Link href={plannerHref(addDays(date, -1), today)} className={styles.subtleLink} aria-label="Previous day"><ChevronLeft size={16} aria-hidden="true" /> {dayLabel(addDays(date, -1), { weekday: 'short' })}</Link>
          {!isToday ? <Link href="/planner" className={styles.subtleLink}>Today</Link> : null}
          <Link href={plannerHref(addDays(date, 1), today)} className={styles.subtleLink} aria-label="Next day">{dayLabel(addDays(date, 1), { weekday: 'short' })} <ChevronRight size={16} aria-hidden="true" /></Link>
        </nav>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Part of this day could not be loaded. Refresh to try again; nothing was changed.</p> : null}
      {data.previousIntention ? <p className={styles.notice}><strong>Yesterday you intended:</strong> {data.previousIntention}</p> : null}

      <section className={styles.panel} aria-labelledby="plan-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>PLAN</p><h2 id="plan-heading">{isToday ? 'On today’s list' : 'Planned for this day'}</h2></div><Link href="/tasks" className={styles.subtleLink}>All tasks</Link></div>
        {data.overdue.length > 0 ? (
          <>
            <p className={styles.kicker} style={{ marginTop: 4 }}>CARRIED OVER · {data.overdue.length}</p>
            <ul className={styles.itemList}>
              {data.overdue.map((task) => (
                <li key={task.id} className={styles.checkItem}>
                  <CompleteButton task={task} returnTo={returnTo} />
                  <span className={styles.itemTitle}>{task.title}<span className={styles.itemMeta}>{taskMeta(task, timeZone, true)}</span></span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <PlanButton task={task} intent="plan" date={date} label={`Plan “${task.title}” for today`}><CalendarCheck size={14} aria-hidden="true" /></PlanButton>
                    <PlanButton task={task} intent="unplan" date={date} label={`Unschedule “${task.title}”`}><Undo2 size={14} aria-hidden="true" /></PlanButton>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {data.planned.length > 0 ? (
          <ul className={styles.itemList} style={{ marginTop: 10 }}>
            {data.planned.map((task) => (
              <li key={task.id} className={styles.checkItem}>
                <CompleteButton task={task} returnTo={returnTo} />
                <span className={styles.itemTitle}>{task.title}<span className={styles.itemMeta}>{taskMeta(task, timeZone)}</span></span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <PlanButton task={task} intent="next_day" date={date} label={`Move “${task.title}” to the next day`}><ArrowRight size={14} aria-hidden="true" /></PlanButton>
                  <PlanButton task={task} intent="unplan" date={date} label={`Unschedule “${task.title}”`}><Undo2 size={14} aria-hidden="true" /></PlanButton>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className={styles.mutedNote}>Nothing planned{isPast ? ' for this day.' : ' yet. Pick a few tasks from your backlog below, or add one.'}</p>}

        {!isPast ? (
          <form action={createTaskPageAction} className={styles.searchForm} style={{ marginTop: 14 }}>
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="dueDate" value={date} />
            <input type="hidden" name="priority" value="medium" />
            <label className="sr-only" htmlFor="planner-new-task">New task for this day</label>
            <Input id="planner-new-task" name="title" required maxLength={TASK_LIMITS.title} placeholder="Add a task for this day" />
            <label className="sr-only" htmlFor="planner-new-estimate">Estimate in minutes</label>
            <Input id="planner-new-estimate" name="estimatedMinutes" type="number" inputMode="numeric" min={1} max={TASK_LIMITS.maxEstimate} placeholder="Minutes" style={{ width: 110 }} />
            <SubmitButton variant="outline" size="sm" pendingLabel="Adding…"><Plus size={14} aria-hidden="true" /> Add</SubmitButton>
          </form>
        ) : null}

        {!isPast && data.backlog.length > 0 ? (
          <>
            <p className={styles.kicker} style={{ marginTop: 18 }}>FROM YOUR BACKLOG · {data.backlogTotal > data.backlog.length ? `${data.backlog.length} OF ${data.backlogTotal}` : data.backlog.length}</p>
            <ul className={styles.itemList}>
              {data.backlog.map((task) => (
                <li key={task.id} className={styles.checkItem}>
                  <PlanButton task={task} intent="plan" date={date} label={`Plan “${task.title}” for ${relative?.toLowerCase() ?? dayLabel(date, { month: 'short', day: 'numeric' })}`}><Plus size={15} aria-hidden="true" /></PlanButton>
                  <span className={styles.itemTitle}>{task.title}<span className={styles.itemMeta}>{taskMeta(task, timeZone)}</span></span>
                  <span />
                </li>
              ))}
            </ul>
            {data.backlogTotal > PLANNER_LIMITS.backlog ? <Link href="/tasks" className={styles.subtleLink}>See the whole backlog</Link> : null}
          </>
        ) : null}

        {data.completed.length > 0 ? (
          <>
            <p className={styles.kicker} style={{ marginTop: 18 }}>DONE THIS DAY · {data.completed.length}</p>
            <ul className={styles.itemList}>
              {data.completed.map((task) => (
                <li key={task.id} className={styles.checkItem} data-done="true">
                  <span className={styles.statusBadge} data-status="completed">Done</span>
                  <span className={styles.itemTitle}>{task.title}</span>
                  <span />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section className={styles.panel} aria-labelledby="habits-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>HABITS</p><h2 id="habits-heading">Scheduled this day</h2></div><Link href="/habits" className={styles.subtleLink}>Check in on Habits</Link></div>
        {data.habits.length > 0 ? (
          <ul className={styles.itemList}>
            {data.habits.map((habit) => (
              <li key={habit.id} className={styles.checkItem} data-done={habit.status === 'completed' || habit.status === 'complete' ? 'true' : undefined}>
                <span className={styles.statusBadge} data-status={habit.status === 'completed' || habit.status === 'complete' ? 'completed' : habit.status ? 'paused' : undefined}>{habit.status ? HABIT_STATUS[habit.status] ?? 'Logged' : isPast ? 'Not logged' : 'To do'}</span>
                <Link href={`/habits/${habit.id}`} className={styles.itemTitle}>{habit.name}<span className={styles.itemMeta}>{PILLAR_LABELS[habit.pillar as HabitPillar] ?? habit.pillar}</span></Link>
                <span />
              </li>
            ))}
          </ul>
        ) : <p className={styles.mutedNote}>No habits are scheduled for this day.</p>}
      </section>

      <section className={styles.panel} aria-labelledby="learning-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>LEARNING</p><h2 id="learning-heading">{learned ? `${formatDuration(learned)} this day` : 'No learning logged this day'}</h2></div><Link href="/learning" className={styles.subtleLink}>Log a session</Link></div>
        {data.sessions.length > 0 ? (
          <ul className={styles.itemList}>
            {data.sessions.map((session) => (
              <li key={session.id} className={styles.checkItem}>
                <span className={styles.statusBadge}>{formatDuration(session.minutes)}</span>
                <span className={styles.itemTitle}>{session.label}<span className={styles.itemMeta}>{new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(session.startedAt))}</span></span>
                <span />
              </li>
            ))}
          </ul>
        ) : null}
        {data.questTargets.length > 0 ? (
          <>
            <p className={styles.kicker} style={{ marginTop: 14 }}>WEEKLY QUEST TARGETS · THIS WEEK</p>
            <dl className={styles.factList}>
              {data.questTargets.map((quest) => (
                <div key={quest.id} style={{ display: 'contents' }}>
                  <dt><Link href={`/quests/${quest.id}`} className={styles.subtleLink}>{quest.title}</Link></dt>
                  <dd>{formatDuration(quest.minutes)} of {formatDuration(quest.target)}{quest.minutes >= quest.target ? ' · met' : ` · ${formatDuration(quest.target - quest.minutes)} to go`}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </section>

      <section className={styles.panel} id="reflect" aria-labelledby="reflect-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>REFLECT</p><h2 id="reflect-heading">Daily review</h2></div></div>
        {date > today ? (
          <p className={styles.mutedNote}>You can write the review for this day when it arrives.</p>
        ) : (
          <form action={saveDailyReviewAction} className={styles.editorForm}>
            <input type="hidden" name="date" value={date} />
            <div className={styles.fieldGrid}>
              {REVIEW_PROMPTS.map(({ field, label }) => (
                <Field key={field} style={field === 'tomorrow' ? { gridColumn: '1 / -1' } : undefined}>
                  <FieldLabel htmlFor={`review-${field}`}>{label}</FieldLabel>
                  <Textarea id={`review-${field}`} name={field} maxLength={PLANNER_LIMITS.reviewField} defaultValue={data.review?.[field] ?? ''} rows={field === 'tomorrow' ? 2 : 3} />
                </Field>
              ))}
            </div>
            <div className={styles.editorFooter}>
              <p>Every answer is optional. {data.review ? 'Saving replaces this day’s review.' : ''}</p>
              <SubmitButton pendingLabel="Saving…">Save review</SubmitButton>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
