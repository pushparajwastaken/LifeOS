import Link from 'next/link'
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleCheck,
  Dumbbell,
  FolderKanban,
  Goal,
  MessageCircle,
  Plus,
  Sparkles,
  Target,
  type LucideIcon,
} from 'lucide-react'
import { PillarActivityChart } from '@/features/dashboard/components/pillar-activity-chart'
import { HabitCheckInForm } from '@/features/habits/components/habit-check-in-form'
import { completeTaskAction, createTaskAction } from '@/features/dashboard/dashboard-actions'
import {
  DASHBOARD_PILLARS,
  formatPillarLabel,
  getLocalDateKey,
  type DashboardGoal,
  type DashboardHabit,
  type DashboardHabitLog,
  type DashboardPillarId,
  type DashboardTask,
} from '@/features/dashboard/dashboard-service'

const pillarIcons: Record<DashboardPillarId, LucideIcon> = {
  physical: Dumbbell,
  intellectual: BookOpen,
  academic: Sparkles,
  professional: FolderKanban,
  communication: MessageCircle,
}

const pillarIds = new Set<string>(DASHBOARD_PILLARS.map(({ id }) => id))

export function FocusPanel({
  task,
  today,
  timeZone,
}: {
  task: DashboardTask | undefined
  today: string
  timeZone: string
}) {
  return (
    <article className="panel focus-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">A GENTLE START</p>
          <h2>One thing to focus on</h2>
        </div>
        <Target className="panel-heading-icon" size={18} aria-hidden="true" />
      </div>
      {task ? (
        <div className="focus-task-card">
          <p className="focus-task-kicker">NEXT UP</p>
          <h3>{task.title}</h3>
          <div className="focus-task-meta">
            <span className={`task-priority priority-${task.priority.toLowerCase()}`}>
              {task.priority} priority
            </span>
            <span>{task.due_at ? taskDueLabel(task.due_at, today, timeZone) : 'No due date'}</span>
            {task.estimated_minutes ? <span>{task.estimated_minutes} min</span> : null}
          </div>
          <p className="focus-task-note">Start here. The rest can wait until you&apos;re ready.</p>
        </div>
      ) : (
        <div className="empty-state focus-empty-state">
          <span className="empty-state-mark"><CircleCheck size={17} aria-hidden="true" /></span>
          <p>Your queue is clear.</p>
          <span>Take a breath, or add one small next step below.</span>
        </div>
      )}
      <div className="focus-panel-actions">
        {task ? (
          <form action={completeTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <button className="button button-primary focus-complete-button" type="submit">
              <Check size={15} aria-hidden="true" /> Mark complete
            </button>
          </form>
        ) : null}
        <Link className="text-link focus-planner-link" href="/planner">
          Open your planner <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

export function HabitsPanel({
  habits,
  logs,
  today,
}: {
  habits: DashboardHabit[]
  logs: DashboardHabitLog[]
  today: string
}) {
  const logsByHabitId = new Map(logs.map((log) => [log.habit_id, log]))
  const completed = habits.filter((habit) => logsByHabitId.get(habit.id)?.status === 'completed').length
  const partial = habits.filter((habit) => logsByHabitId.get(habit.id)?.status === 'partial').length
  const smallVersion = habits.find((habit) =>
    logsByHabitId.get(habit.id)?.status === 'partial' && habit.schedule.behavior.twoMinuteVersion,
  )
  const visibleHabits = habits.slice(0, 5)

  return (
    <article className="panel habits-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SMALL PROMISES, KEPT</p>
          <h2>Today&apos;s scheduled habits</h2>
        </div>
        <Link className="text-link" href="/habits">
          All habits <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <p className="panel-description">
        {habits.length ? `${completed} full · ${partial} partial · ${habits.length} scheduled today` : 'Only habits scheduled for today appear here.'}
      </p>
      {visibleHabits.length > 0 ? (
        <ul className="habit-list dashboard-habit-list">
          {visibleHabits.map((habit) => {
            const log = logsByHabitId.get(habit.id)
            const isComplete = log?.status === 'completed'
            const Icon = pillarIcon(habit.pillar)
            return (
              <li className="habit-row dashboard-habit-row" key={habit.id}>
                <span className={`habit-icon${isComplete ? ' habit-icon-done' : ''}`} aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span className="habit-copy">
                  <strong>{habit.name}</strong>
                  <small>
                    {formatPillarLabel(habit.pillar)}
                    {habit.target_value !== null ? ` · target ${habit.target_value}${habit.unit ? ` ${habit.unit}` : ''}` : ''}
                  </small>
                  <span className={`habit-status${isComplete ? ' habit-status-complete' : ''}`}>
                    {habitStatusLabel(log)}
                  </span>
                  {log?.status === 'partial' && habit.schedule.behavior.twoMinuteVersion ? (
                    <small>Small version: {habit.schedule.behavior.twoMinuteVersion}</small>
                  ) : null}
                </span>
                <div className="dashboard-habit-actions">
                  <HabitCheckInForm habit={habit} date={today} log={log} origin="dashboard" compact />
                  <Link className="dashboard-habit-detail-link" href={`/habits/${habit.id}`} aria-label={`Open ${habit.name} habit details`}>Details</Link>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="empty-state">
          <p>No habits are scheduled today.</p>
          <span>Unscheduled days are not counted as misses. Your rhythm can wait until tomorrow.</span>
          <Link className="text-link" href="/habits">Review your schedule <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
      )}
      {habits.length > visibleHabits.length ? (
        <p className="dashboard-habits-more">{habits.length - visibleHabits.length} more scheduled today · <Link href="/habits">Open habit management</Link></p>
      ) : null}
      {smallVersion ? (
        <p className="dashboard-habit-insight" role="note">A smaller version kept <strong>{smallVersion.name}</strong> in motion today.</p>
      ) : null}
    </article>
  )
}

export function TasksPanel({
  tasks,
  today,
  timeZone,
}: {
  tasks: DashboardTask[]
  today: string
  timeZone: string
}) {
  return (
    <article className="panel tasks-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">KEEP IT MOVING</p>
          <h2>More in your queue</h2>
        </div>
        <Link className="text-link" href="/tasks">
          All tasks <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {tasks.length > 0 ? (
        <ul className="task-list">
          {tasks.map((task) => (
            <li className="task-row" key={task.id}>
              <form action={completeTaskAction} className="task-complete-form">
                <input type="hidden" name="taskId" value={task.id} />
                <button className="task-complete-button" type="submit" aria-label={`Mark ${task.title} complete`}>
                  <Check size={13} aria-hidden="true" />
                </button>
              </form>
              <span className="task-copy">
                <strong>{task.title}</strong>
                <small>
                  {task.pillar ? formatPillarLabel(task.pillar) : 'Unassigned'}
                  {' · '}
                  {task.due_at ? taskDueLabel(task.due_at, today, timeZone) : 'No due date'}
                  {task.estimated_minutes ? ` · ${task.estimated_minutes} min` : ''}
                </small>
              </span>
              <span className={`task-priority priority-${task.priority.toLowerCase()}`}>
                {task.priority}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state task-empty-state">
          <p>Your queue is clear for now.</p>
          <span>Add a small next step when one becomes clear.</span>
        </div>
      )}
      <form action={createTaskAction} className="task-create-form">
        <label className="sr-only" htmlFor="new-task-title">New task</label>
        <input id="new-task-title" name="title" type="text" maxLength={160} required placeholder="Add a task to your queue" />
        <label className="sr-only" htmlFor="new-task-priority">Task priority</label>
        <select id="new-task-priority" name="priority" defaultValue="medium" aria-label="Task priority">
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button className="task-add-button" type="submit" aria-label="Add task"><Plus size={14} aria-hidden="true" /><span>Add</span></button>
      </form>
    </article>
  )
}

export function GoalsPanel({ goals }: { goals: DashboardGoal[] }) {
  return (
    <article className="panel goals-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">THE LONGER VIEW</p>
          <h2>Active goals</h2>
        </div>
        <Link className="text-link" href="/goals">
          Goals <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {goals.length > 0 ? (
        <ul className="goal-list">
          {goals.map((goal) => (
            <li className="goal-row" key={goal.id}>
              <span className="goal-mark"><Goal size={15} aria-hidden="true" /></span>
              <span className="goal-copy">
                <strong>{goal.title}</strong>
                <small>{formatPillarLabel(goal.pillar)} · Ends {goalEndLabel(goal.ends_on)}</small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <p>No active goals yet.</p>
          <span>Set a direction when you&apos;re ready; there&apos;s no need to rush.</span>
          <Link className="text-link" href="/goals">Explore goals <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
      )}
    </article>
  )
}

export function PillarPanel({
  items,
}: {
  items: Array<{ id: DashboardPillarId; label: string; tasks: number; habits: number; goals: number }>
}) {
  return (
    <section className="panel pillar-overview-panel" aria-labelledby="pillar-overview-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">FIVE WAYS TO GROW</p>
          <h2 id="pillar-overview-title">Activity across your pillars</h2>
        </div>
        <Link className="text-link" href="/analytics">
          Explore analytics <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <p className="panel-description">A count of active saved records—not a measure of progress.</p>
      <PillarActivityChart items={items} />
    </section>
  )
}

export function getPillarCounts(data: {
  tasks: DashboardTask[]
  habits: DashboardHabit[]
  goals: DashboardGoal[]
}) {
  return DASHBOARD_PILLARS.map(({ id, label }) => ({
    id,
    label,
    tasks: data.tasks.filter((task) => normalizePillarId(task.pillar) === id).length,
    habits: data.habits.filter((habit) => normalizePillarId(habit.pillar) === id).length,
    goals: data.goals.filter((goal) => normalizePillarId(goal.pillar) === id).length,
  }))
}

export function isLoggedHabit(log: DashboardHabitLog | undefined): boolean {
  return log?.status === 'completed' || log?.status === 'complete'
}

export function habitStatusLabel(log: DashboardHabitLog | undefined): string {
  if (!log) return 'Not logged today'
  if (log.status === 'completed' || log.status === 'complete') return 'Completed today'
  if (log.status === 'partial') return 'Partially completed'
  if (log.status === 'skipped') return 'Skipped today'
  if (log.status === 'rest') return 'Rest day'
  return 'Logged today'
}

function normalizePillarId(value: string | null | undefined): DashboardPillarId | null {
  const normalized = value?.trim().toLowerCase().replaceAll('_', ' ')
  return normalized && pillarIds.has(normalized) ? normalized as DashboardPillarId : null
}

function pillarIcon(value: string): LucideIcon {
  const id = normalizePillarId(value)
  return id ? pillarIcons[id] : Target
}

function taskDueLabel(dueAt: string, today: string, timeZone: string): string {
  const dueDate = new Date(dueAt)
  if (Number.isNaN(dueDate.getTime())) return 'Due date set'
  const dueKey = getLocalDateKey(dueDate, timeZone)
  if (dueKey === today) return 'Due today'
  if (dueKey < today) return 'Overdue'
  return `Due ${new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(dueDate)}`
}

function goalEndLabel(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return 'date not set'
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(date)
}
