import Link from 'next/link'
import { Check, ListChecks, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatDuration } from '@/features/learning/learning-domain'
import { IconSubmitButton } from '@/features/quests/components/icon-submit-button'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import { createTaskPageAction, deleteTaskAction, setTaskStatusAction, updateTaskAction } from '../task-actions'
import {
  DUE_GROUP_LABELS,
  TASK_LIMITS,
  TASK_PILLARS,
  TASK_PILLAR_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_VIEWS,
  TASK_VIEW_LABELS,
  groupOpenTasks,
  tasksHref,
  type TaskFilters,
  type TaskIntent,
  type TaskPillar,
  type TaskPriority,
} from '../task-domain'
import type { TaskView, TasksPageData } from '../task-service'

type Props = { data: TasksPageData; filters: TaskFilters; today: string; timeZone: string; notice?: string }

function TaskFields({ prefix, task, today }: { prefix: string; task?: TaskView; today: string }) {
  return (
    <div className={styles.fieldGrid}>
      <Field style={{ gridColumn: '1 / -1' }}>
        <FieldLabel htmlFor={`${prefix}-title`}>Task</FieldLabel>
        <Input id={`${prefix}-title`} name="title" required maxLength={TASK_LIMITS.title} defaultValue={task?.title ?? ''} placeholder="What needs doing?" />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-priority`}>Priority</FieldLabel>
        <select id={`${prefix}-priority`} name="priority" className={styles.nativeSelect} defaultValue={task?.priority ?? 'medium'}>
          {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{TASK_PRIORITY_LABELS[priority]}</option>)}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-pillar`}>Pillar</FieldLabel>
        <select id={`${prefix}-pillar`} name="pillar" className={styles.nativeSelect} defaultValue={task?.pillar ?? ''}>
          <option value="">None</option>
          {TASK_PILLARS.map((pillar) => <option key={pillar} value={pillar}>{TASK_PILLAR_LABELS[pillar]}</option>)}
        </select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-date`}>Due date</FieldLabel>
        <Input id={`${prefix}-date`} name="dueDate" type="date" min={task ? undefined : today} defaultValue={task?.dueDate ?? ''} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-time`}>Due time</FieldLabel>
        <Input id={`${prefix}-time`} name="dueTime" type="time" defaultValue={task?.dueTime && task.dueTime !== '23:59' ? task.dueTime : ''} />
        <FieldDescription>Optional. Without a time, the task is due at the end of the day; without a date, there is no deadline.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-estimate`}>Estimate (minutes)</FieldLabel>
        <Input id={`${prefix}-estimate`} name="estimatedMinutes" type="number" inputMode="numeric" min={1} max={TASK_LIMITS.maxEstimate} step={1} defaultValue={task?.estimatedMinutes ?? ''} />
      </Field>
      <Field style={{ gridColumn: '1 / -1' }}>
        <FieldLabel htmlFor={`${prefix}-description`}>Notes</FieldLabel>
        <Textarea id={`${prefix}-description`} name="description" maxLength={TASK_LIMITS.description} defaultValue={task?.description ?? ''} />
      </Field>
    </div>
  )
}

function StatusButton({ task, intent, returnTo, children, label, variant = 'outline' }: { task: TaskView; intent: TaskIntent; returnTo: string; children: React.ReactNode; label?: string; variant?: 'outline' | 'icon' }) {
  return (
    <form action={setTaskStatusAction} style={{ display: 'inline' }}>
      <input type="hidden" name="taskId" value={task.id} />
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {variant === 'icon'
        ? <IconSubmitButton label={label ?? ''} done={task.status === 'done'}>{children}</IconSubmitButton>
        : <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">{children}</SubmitButton>}
    </form>
  )
}

function dueLabel(task: TaskView, today: string, timeZone: string): string | null {
  if (!task.dueAt || !task.dueDate) return null
  const time = task.dueTime && task.dueTime !== '23:59' ? new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(task.dueAt)) : null
  const day = task.dueDate === today ? 'today' : new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${task.dueDate}T00:00:00Z`))
  return `Due ${day}${time ? ` at ${time}` : ''}`
}

function TaskRow({ task, today, timeZone, returnTo }: { task: TaskView; today: string; timeZone: string; returnTo: string }) {
  const open = task.status === 'todo' || task.status === 'in_progress'
  const meta = [
    task.status !== 'todo' ? TASK_STATUS_LABELS[task.status] : null,
    `${TASK_PRIORITY_LABELS[task.priority as TaskPriority] ?? task.priority} priority`,
    dueLabel(task, today, timeZone),
    task.pillar ? TASK_PILLAR_LABELS[task.pillar as TaskPillar] ?? task.pillar : null,
    task.estimatedMinutes ? formatDuration(task.estimatedMinutes) : null,
    task.status === 'done' && task.completedAt ? `Completed ${new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(new Date(task.completedAt))}` : null,
  ].filter(Boolean).join(' · ')
  return (
    <li className={styles.checkItem} data-done={task.status === 'done' || task.status === 'cancelled' ? 'true' : undefined}>
      {open
        ? <StatusButton task={task} intent="complete" returnTo={returnTo} variant="icon" label={`Mark “${task.title}” done`}><Check size={15} aria-hidden="true" /></StatusButton>
        : <StatusButton task={task} intent="reopen" returnTo={returnTo} variant="icon" label={`Reopen “${task.title}”`}><RotateCcw size={14} aria-hidden="true" /></StatusButton>}
      <details>
        <summary className={styles.itemTitle}>{task.title}<span className={styles.itemMeta}>{meta}</span></summary>
        {task.description ? <p className={styles.description}>{task.description}</p> : null}
        <div className={styles.inlineForm} style={{ marginTop: 10 }}>
          {task.status === 'todo' ? <StatusButton task={task} intent="start" returnTo={returnTo}>Start</StatusButton> : null}
          {task.status === 'in_progress' ? <StatusButton task={task} intent="reopen" returnTo={returnTo}>Back to to-do</StatusButton> : null}
          {open ? <StatusButton task={task} intent="cancel" returnTo={returnTo}>Cancel task</StatusButton> : null}
        </div>
        <form action={updateTaskAction} className={styles.editorForm}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <TaskFields prefix={`task-${task.id}`} task={task} today={today} />
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…">Save task</SubmitButton></div>
        </form>
        <form action={deleteTaskAction} className={styles.inlineForm}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className={styles.itemMeta} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 0 }}>
            <input type="checkbox" name="confirm" value="delete" required /> Delete permanently (cannot be undone)
          </label>
          <SubmitButton variant="outline" size="sm" pendingLabel="Deleting…"><Trash2 size={13} aria-hidden="true" /> Delete</SubmitButton>
        </form>
      </details>
      <span />
    </li>
  )
}

export function TasksPage({ data, filters, today, timeZone, notice }: Props) {
  const message = resolveNotice(notice)
  const returnTo = tasksHref(filters)
  const filtered = Boolean(filters.query || filters.pillar)
  const groups = filters.view === 'open' ? groupOpenTasks(data.tasks, today, new Date()) : [{ id: null, tasks: data.tasks }]
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>TASKS · {data.counts.open} OPEN · {data.counts.done} DONE</p>
          <h1>Everything you have committed to.</h1>
          <p className={styles.heroCopy}>Due dates use your profile timezone ({timeZone}). Completing, cancelling and reopening keep an honest record for your analytics.</p>
        </div>
        <div className={styles.inlineForm} style={{ marginTop: 0 }}>
          <Link href="#add-task" className={styles.primaryLink}><Plus size={16} aria-hidden="true" /> Add task</Link>
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Some tasks could not be loaded. Refresh to try again; nothing was changed.</p> : null}
      {data.truncated ? <p className={styles.notice} role="status">Showing the first {TASK_LIMITS.listCap} matches. Search or filter to narrow the list.</p> : null}

      <section className={styles.panel} aria-labelledby="tasks-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>{data.tasks.length === 1 ? '1 TASK' : `${data.tasks.length} TASKS`}</p><h2 id="tasks-title">Your tasks</h2></div></div>
        <form method="get" action="/tasks" className={styles.searchForm} role="search">
          {filters.view !== 'open' ? <input type="hidden" name="view" value={filters.view} /> : null}
          <label className="sr-only" htmlFor="task-search">Search tasks</label>
          <Input id="task-search" name="q" defaultValue={filters.query ?? ''} maxLength={100} placeholder="Search task titles" />
          <label className="sr-only" htmlFor="task-pillar-filter">Pillar</label>
          <select id="task-pillar-filter" name="pillar" className={styles.nativeSelect} style={{ width: 'auto' }} defaultValue={filters.pillar ?? ''}>
            <option value="">All pillars</option>
            {TASK_PILLARS.map((pillar) => <option key={pillar} value={pillar}>{TASK_PILLAR_LABELS[pillar]}</option>)}
          </select>
          <button type="submit" className={styles.subtleLink}><Search size={14} aria-hidden="true" /> Apply</button>
          {filtered ? <Link href={tasksHref(filters, { query: null, pillar: null })} className={styles.subtleLink}>Clear</Link> : null}
        </form>
        <nav className={styles.filterTabs} aria-label="Filter by status" style={{ marginTop: 12 }}>
          {TASK_VIEWS.map((view) => (
            <Link key={view} href={tasksHref(filters, { view })} className={styles.filterTab} aria-current={filters.view === view ? 'page' : undefined}>{TASK_VIEW_LABELS[view]}</Link>
          ))}
        </nav>

        {data.tasks.length > 0 ? groups.map((group) => (
          <div key={group.id ?? 'all'}>
            {group.id ? <p className={styles.kicker} style={{ marginTop: 16 }}>{DUE_GROUP_LABELS[group.id].toUpperCase()} · {group.tasks.length}</p> : null}
            <ul className={styles.itemList} style={{ marginTop: group.id ? undefined : 14 }}>
              {group.tasks.map((task) => <TaskRow key={task.id} task={task} today={today} timeZone={timeZone} returnTo={returnTo} />)}
            </ul>
          </div>
        )) : (
          <Empty className={styles.emptyState}>
            <EmptyHeader>
              <EmptyMedia variant="icon"><ListChecks aria-hidden="true" /></EmptyMedia>
              <EmptyTitle>{filtered ? 'No tasks match these filters' : filters.view === 'open' ? 'Nothing open right now' : `No ${TASK_VIEW_LABELS[filters.view].toLowerCase()} tasks`}</EmptyTitle>
              <EmptyDescription>{filtered ? 'Try clearing the search or pillar filter.' : filters.view === 'open' ? 'Add a task below when something needs doing.' : 'Tasks appear here as you complete or cancel them.'}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <section className={styles.panel} id="add-task" aria-labelledby="add-task-title">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>NEW</p><h2 id="add-task-title">Add a task</h2></div></div>
        <form action={createTaskPageAction} className={styles.editorForm}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <TaskFields prefix="new-task" today={today} />
          <div className={styles.editorFooter}><SubmitButton pendingLabel="Adding…"><Plus size={15} aria-hidden="true" /> Add task</SubmitButton></div>
        </form>
      </section>
    </div>
  )
}
