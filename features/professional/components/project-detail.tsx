import Link from 'next/link'
import { ArrowLeft, ExternalLink, Plus, Rocket, Trash2 } from 'lucide-react'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { formatMinutes, plural } from '@/features/pillars/pillar-domain'
import { IconSubmitButton } from '@/features/quests/components/icon-submit-button'
import { SubmitButton } from '@/features/quests/components/submit-button'
import { resolveNotice } from '@/features/quests/quest-notices'
import styles from '@/features/quests/quests.module.css'
import {
  addMilestoneAction, addProjectTaskAction, deleteMilestoneAction, deleteProjectAction, deleteProjectTaskAction,
  logCodingAction, logShippedAction, setMilestoneStatusAction, setProjectStatusAction, setProjectTaskStatusAction, updateProjectAction,
} from '../professional-actions'
import { MILESTONE_STATUSES, PRIORITIES, PROFESSIONAL_LIMITS, PROJECT_STATUSES, PROJECT_STATUS_LABELS, PROJECT_TASK_STATUSES, WORK_STATUS_LABELS } from '../professional-domain'
import type { getProjectDetail } from '../professional-service'
import { DeleteEntry } from './professional-overview'

type Detail = NonNullable<Awaited<ReturnType<typeof getProjectDetail>>>
const dateLabel = (key: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${key}T00:00:00Z`))

function Hidden({ projectId }: { projectId: string }) {
  return <input type="hidden" name="projectId" value={projectId} />
}

export function ProjectDetail({ data, today, timeZone, nowTime, notice }: { data: Detail; today: string; timeZone: string; nowTime: string; notice?: string }) {
  const { project } = data
  const message = resolveNotice(notice)
  const time = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const milestoneTitle = new Map(data.milestones.map((milestone) => [milestone.id, milestone.title]))
  const openTasks = data.tasks.filter((task) => task.status !== 'done')
  const doneTasks = data.tasks.filter((task) => task.status === 'done')
  return (
    <div className={styles.page}>
      <Link href="/professional" className={styles.subtleLink}><ArrowLeft size={14} aria-hidden="true" /> Professional</Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>PROJECT · {PROJECT_STATUS_LABELS[project.status].toUpperCase()}</p>
          <h1 style={{ overflowWrap: 'anywhere' }}>{project.name}</h1>
          {project.description ? <p className={styles.heroCopy} style={{ whiteSpace: 'pre-wrap' }}>{project.description}</p> : null}
          <p className={styles.itemMeta}>{[project.started_on ? `Started ${dateLabel(project.started_on)}` : null, project.due_on ? `Due ${dateLabel(project.due_on)}` : null, `${formatMinutes(data.codingMinutes)} of building`, plural(data.shipped.length, 'thing') + ' shipped'].filter(Boolean).join(' · ')}</p>
          {project.repository_url ? <a href={project.repository_url} target="_blank" rel="noopener noreferrer nofollow" className={styles.subtleLink} style={{ overflowWrap: 'anywhere' }}>{project.repository_url} <ExternalLink size={13} aria-hidden="true" /></a> : null}
        </div>
      </header>

      {message ? <p className={message.tone === 'error' ? styles.errorNotice : styles.notice} role={message.tone === 'error' ? 'alert' : 'status'}>{message.text}</p> : null}
      {data.hasLoadError ? <p className={styles.errorNotice} role="alert">Part of this project could not be loaded. Refresh to try again.</p> : null}

      <section className={styles.panel} aria-labelledby="status-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>PROGRESS</p><h2 id="status-heading">{data.progress.total ? `${data.progress.done} of ${plural(data.progress.total, 'task')} done` : 'No tasks yet'}</h2></div></div>
        {data.progress.percent !== null ? <Progress value={data.progress.percent} aria-label="Project progress" style={{ maxWidth: 480 }} /> : null}
        <div className={styles.inlineForm} style={{ marginTop: 12 }}>
          {PROJECT_STATUSES.filter((status) => status !== project.status).map((status) => (
            <form key={status} action={setProjectStatusAction} style={{ display: 'inline' }}>
              <Hidden projectId={project.id} />
              <input type="hidden" name="status" value={status} />
              <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">{status === 'completed' ? 'Mark completed' : status === 'active' ? 'Make active' : status === 'paused' ? 'Pause' : 'Archive'}</SubmitButton>
            </form>
          ))}
        </div>
      </section>

      <section className={styles.panel} id="milestones" aria-labelledby="milestones-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>MILESTONES · {data.milestones.length}</p><h2 id="milestones-heading">Checkpoints</h2></div></div>
        {data.milestones.length ? (
          <ul className={styles.itemList}>
            {data.milestones.map((milestone) => (
              <li key={milestone.id} className={styles.checkItem} data-done={milestone.status === 'done' ? 'true' : undefined} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto auto' }}>
                <span className={styles.itemTitle} style={{ overflowWrap: 'anywhere' }}>{milestone.title}<span className={styles.itemMeta}>{[milestone.due_on ? `Due ${dateLabel(milestone.due_on)}` : null, plural(data.tasks.filter((task) => task.milestone_id === milestone.id).length, 'task')].filter(Boolean).join(' · ')}</span></span>
                <form action={setMilestoneStatusAction} style={{ display: 'flex', gap: 6 }}>
                  <Hidden projectId={project.id} />
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <label className="sr-only" htmlFor={`milestone-status-${milestone.id}`}>Status of {milestone.title}</label>
                  <select id={`milestone-status-${milestone.id}`} name="status" className={styles.nativeSelect} defaultValue={milestone.status} style={{ width: 'auto' }}>
                    {MILESTONE_STATUSES.map((status) => <option key={status} value={status}>{WORK_STATUS_LABELS[status]}</option>)}
                  </select>
                  <SubmitButton variant="outline" size="sm" pendingLabel="…">Set</SubmitButton>
                </form>
                <form action={deleteMilestoneAction}>
                  <Hidden projectId={project.id} />
                  <input type="hidden" name="milestoneId" value={milestone.id} />
                  <IconSubmitButton label={`Delete milestone “${milestone.title}” (its tasks are kept)`}><Trash2 size={14} aria-hidden="true" /></IconSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={addMilestoneAction} className={styles.searchForm} style={{ marginTop: 12 }}>
          <Hidden projectId={project.id} />
          <label className="sr-only" htmlFor="milestone-title">New milestone</label>
          <Input id="milestone-title" name="title" required maxLength={PROFESSIONAL_LIMITS.milestone} placeholder="Add a milestone" />
          <label className="sr-only" htmlFor="milestone-due">Due date</label>
          <Input id="milestone-due" name="dueOn" type="date" style={{ width: 'auto' }} />
          <SubmitButton variant="outline" size="sm" pendingLabel="Adding…"><Plus size={14} aria-hidden="true" /> Add</SubmitButton>
        </form>
      </section>

      <section className={styles.panel} id="tasks" aria-labelledby="tasks-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>TASKS · {openTasks.length} OPEN</p><h2 id="tasks-heading">Work items</h2></div></div>
        {[...openTasks, ...doneTasks].length ? (
          <ul className={styles.itemList}>
            {[...openTasks, ...doneTasks].map((task) => (
              <li key={task.id} className={styles.checkItem} data-done={task.status === 'done' ? 'true' : undefined} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto auto' }}>
                <span className={styles.itemTitle} style={{ overflowWrap: 'anywhere' }}>{task.title}<span className={styles.itemMeta}>{[`${task.priority[0].toUpperCase()}${task.priority.slice(1)} priority`, task.status === 'blocked' ? 'Blocked' : null, task.due_on ? `Due ${dateLabel(task.due_on)}` : null, task.milestone_id ? milestoneTitle.get(task.milestone_id) : null].filter(Boolean).join(' · ')}</span></span>
                <form action={setProjectTaskStatusAction} style={{ display: 'flex', gap: 6 }}>
                  <Hidden projectId={project.id} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <label className="sr-only" htmlFor={`task-status-${task.id}`}>Status of {task.title}</label>
                  <select id={`task-status-${task.id}`} name="status" className={styles.nativeSelect} defaultValue={task.status} style={{ width: 'auto' }}>
                    {PROJECT_TASK_STATUSES.map((status) => <option key={status} value={status}>{WORK_STATUS_LABELS[status]}</option>)}
                  </select>
                  <SubmitButton variant="outline" size="sm" pendingLabel="…">Set</SubmitButton>
                </form>
                <form action={deleteProjectTaskAction}>
                  <Hidden projectId={project.id} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <IconSubmitButton label={`Delete task “${task.title}”`}><Trash2 size={14} aria-hidden="true" /></IconSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        ) : <p className={styles.mutedNote}>Break the project into small tasks to see progress.</p>}
        <form action={addProjectTaskAction} className={styles.searchForm} style={{ marginTop: 12 }}>
          <Hidden projectId={project.id} />
          <label className="sr-only" htmlFor="project-task-title">New task</label>
          <Input id="project-task-title" name="title" required maxLength={PROFESSIONAL_LIMITS.task} placeholder="Add a task" />
          <label className="sr-only" htmlFor="project-task-priority">Priority</label>
          <select id="project-task-priority" name="priority" className={styles.nativeSelect} defaultValue="medium" style={{ width: 'auto' }}>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select>
          {data.milestones.length ? (
            <>
              <label className="sr-only" htmlFor="project-task-milestone">Milestone</label>
              <select id="project-task-milestone" name="milestoneId" className={styles.nativeSelect} defaultValue="" style={{ width: 'auto' }}>
                <option value="">No milestone</option>
                {data.milestones.map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}
              </select>
            </>
          ) : null}
          <SubmitButton variant="outline" size="sm" pendingLabel="Adding…"><Plus size={14} aria-hidden="true" /> Add</SubmitButton>
        </form>
      </section>

      <section className={styles.panel} id="coding" aria-labelledby="coding-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>BUILDING TIME · {formatMinutes(data.codingMinutes).toUpperCase()}</p><h2 id="coding-heading">Coding sessions</h2></div></div>
        <form action={logCodingAction} className={styles.searchForm}>
          <Hidden projectId={project.id} />
          <input type="hidden" name="returnTo" value="project" />
          <input type="hidden" name="date" value={today} />
          <input type="hidden" name="time" value={nowTime} />
          <label className="sr-only" htmlFor="project-coding-minutes">Minutes</label>
          <Input id="project-coding-minutes" name="minutes" inputMode="numeric" required maxLength={4} placeholder="Minutes" style={{ width: 110 }} />
          <label className="sr-only" htmlFor="project-coding-notes">What you worked on</label>
          <Input id="project-coding-notes" name="notes" maxLength={PROFESSIONAL_LIMITS.notes} placeholder="What you worked on" />
          <SubmitButton variant="outline" size="sm" pendingLabel="Saving…"><Plus size={14} aria-hidden="true" /> Log today</SubmitButton>
        </form>
        {data.coding.length ? (
          <ul className={styles.itemList}>
            {data.coding.map((session) => (
              <li key={session.id} className={styles.checkItem}>
                <span className={styles.statusBadge}>{formatMinutes(session.duration_minutes)}</span>
                <span className={styles.itemTitle} style={{ overflowWrap: 'anywhere' }}>{session.notes || 'Coding session'}<span className={styles.itemMeta}>{time.format(new Date(session.started_at))}</span></span>
                <DeleteEntry kind="coding" id={session.id} projectId={project.id} label={`Delete the coding session from ${time.format(new Date(session.started_at))}`} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={styles.panel} id="shipped" aria-labelledby="shipped-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>OUTPUT · {data.shipped.length}</p><h2 id="shipped-heading">Shipped from this project</h2></div></div>
        <form action={logShippedAction} className={styles.searchForm}>
          <Hidden projectId={project.id} />
          <input type="hidden" name="returnTo" value="project" />
          <label className="sr-only" htmlFor="project-shipped-title">What shipped</label>
          <Input id="project-shipped-title" name="title" required maxLength={PROFESSIONAL_LIMITS.shipped} placeholder="What shipped" />
          <label className="sr-only" htmlFor="project-shipped-date">Date</label>
          <Input id="project-shipped-date" name="date" type="date" max={today} defaultValue={today} style={{ width: 'auto' }} />
          <SubmitButton variant="outline" size="sm" pendingLabel="Saving…"><Rocket size={14} aria-hidden="true" /> Log it</SubmitButton>
        </form>
        {data.shipped.length ? (
          <ul className={styles.itemList}>
            {data.shipped.map((item) => (
              <li key={item.id} className={styles.checkItem}>
                <Rocket size={15} aria-hidden="true" />
                <span className={styles.itemTitle} style={{ overflowWrap: 'anywhere' }}>{item.title}<span className={styles.itemMeta}>{[time.format(new Date(item.shipped_at)), item.description].filter(Boolean).join(' · ')}</span></span>
                <DeleteEntry kind="shipped" id={item.id} projectId={project.id} label={`Delete “${item.title}” from the shipping log`} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={styles.panel} id="edit" aria-labelledby="edit-heading">
        <details>
          <summary className={styles.sectionHeader}><div><p className={styles.kicker}>DETAILS</p><h2 id="edit-heading">Edit project</h2></div></summary>
          <form action={updateProjectAction} className={styles.editorForm}>
            <Hidden projectId={project.id} />
            <div className={styles.fieldGrid}>
              <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="edit-project-name">Project</FieldLabel><Input id="edit-project-name" name="name" required maxLength={PROFESSIONAL_LIMITS.name} defaultValue={project.name} /></Field>
              <Field><FieldLabel htmlFor="edit-project-start">Started</FieldLabel><Input id="edit-project-start" name="startedOn" type="date" defaultValue={project.started_on ?? ''} /></Field>
              <Field><FieldLabel htmlFor="edit-project-due">Due</FieldLabel><Input id="edit-project-due" name="dueOn" type="date" defaultValue={project.due_on ?? ''} /></Field>
              <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="edit-project-repo">Repository or link</FieldLabel><Input id="edit-project-repo" name="repositoryUrl" type="url" maxLength={2048} defaultValue={project.repository_url ?? ''} /></Field>
              <Field style={{ gridColumn: '1 / -1' }}><FieldLabel htmlFor="edit-project-description">What it is</FieldLabel><Textarea id="edit-project-description" name="description" maxLength={PROFESSIONAL_LIMITS.description} rows={3} defaultValue={project.description ?? ''} /></Field>
            </div>
            <div className={styles.editorFooter}><SubmitButton pendingLabel="Saving…">Save project</SubmitButton></div>
          </form>
        </details>
      </section>

      <section className={styles.panel} id="delete" aria-labelledby="delete-heading">
        <div className={styles.sectionHeader}><div><p className={styles.kicker}>DANGER ZONE</p><h2 id="delete-heading">Delete project</h2></div></div>
        <form action={deleteProjectAction} className={styles.inlineForm}>
          <Hidden projectId={project.id} />
          <label className={styles.itemMeta} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 0 }}><input type="checkbox" name="confirm" value="delete" required /> Delete with its milestones and tasks (coding sessions and shipped items are kept)</label>
          <SubmitButton variant="outline" size="sm" pendingLabel="Deleting…"><Trash2 size={13} aria-hidden="true" /> Delete project</SubmitButton>
        </form>
      </section>
    </div>
  )
}
