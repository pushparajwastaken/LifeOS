import Link from 'next/link'
import { BookOpen, CalendarDays, Check, CheckCheck, Dumbbell, Flag, LineChart, ListChecks } from 'lucide-react'
import { formatMinutes } from '@/features/analytics/analytics-domain'
import {
  FocusPanel,
  GoalsPanel,
  HabitsPanel,
  getPillarCounts,
  isLoggedHabit,
  PillarPanel,
  TasksPanel,
} from '@/features/dashboard/components/dashboard-panels'
import type { DashboardData } from '@/features/dashboard/dashboard-service'

export function DashboardOverview({
  data,
  notice,
}: {
  data: DashboardData
  notice?: string
}) {
  const logsByHabitId = new Map(data.habitLogs.map((log) => [log.habit_id, log]))
  const completedHabits = data.todayHabits.filter((habit) =>
    isLoggedHabit(logsByHabitId.get(habit.id)),
  ).length
  const focusTask = data.tasks[0]
  const remainingTasks = focusTask
    ? data.tasks.filter((task) => task.id !== focusTask.id)
    : data.tasks
  const pillarCounts = getPillarCounts(data)

  return (
    <div className="dashboard-content dashboard-daybook">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">{data.dateLabel}</p>
          <h1>The day, in good order.</h1>
          <p className="welcome-copy">A clear place to begin, with room for the rest to unfold.</p>
        </div>
        <Link className="button button-primary" href="/planner">
          <CalendarDays size={16} aria-hidden="true" />
          Plan your day
        </Link>
      </section>

      {notice ? <p className="dashboard-notice" role="status">{notice}</p> : null}
      {data.hasLoadError ? (
        <p className="dashboard-notice dashboard-notice-error" role="alert">
          Some of your records could not be loaded. Refresh the page to try again.
        </p>
      ) : null}

      <section className="dashboard-summary" aria-label="Today at a glance">
        <div className="dashboard-summary-item">
          <span><ListChecks size={15} aria-hidden="true" /> Open tasks</span>
          <strong>{data.tasks.length}</strong>
        </div>
        <div className="dashboard-summary-item">
          <span><Check size={15} aria-hidden="true" /> Habits completed</span>
          <strong>{completedHabits}<small> / {data.todayHabits.length}</small></strong>
        </div>
        <div className="dashboard-summary-item">
          <span><Flag size={15} aria-hidden="true" /> Active goals</span>
          <strong>{data.goals.length}</strong>
        </div>
      </section>

      <section className="dashboard-week" aria-labelledby="dashboard-week-title">
        <div className="dashboard-week-header">
          <h2 id="dashboard-week-title">This week so far</h2>
          <Link href="/analytics" className="dashboard-week-link"><LineChart size={14} aria-hidden="true" /> Patterns over 12 weeks</Link>
        </div>
        <div className="dashboard-summary">
          <div className="dashboard-summary-item">
            <span><CheckCheck size={15} aria-hidden="true" /> Tasks completed</span>
            <strong>{data.week.tasksCompleted.thisWeek}</strong>
            <small className="dashboard-week-note">Last week: {data.week.tasksCompleted.lastWeek}</small>
          </div>
          <div className="dashboard-summary-item">
            <span><BookOpen size={15} aria-hidden="true" /> Learning time</span>
            <strong>{formatMinutes(data.week.learningMinutes.thisWeek)}</strong>
            <small className="dashboard-week-note">Last week: {formatMinutes(data.week.learningMinutes.lastWeek)}</small>
          </div>
          <div className="dashboard-summary-item">
            <span><CalendarDays size={15} aria-hidden="true" /> Days with learning</span>
            <strong>{data.week.learningDays.thisWeek}<small> / 7</small></strong>
            <small className="dashboard-week-note">Last week: {data.week.learningDays.lastWeek}</small>
          </div>
          <div className="dashboard-summary-item">
            <span><Dumbbell size={15} aria-hidden="true" /> Workouts</span>
            <strong>{data.week.workouts.thisWeek}</strong>
            <small className="dashboard-week-note">Last week: {data.week.workouts.lastWeek}</small>
          </div>
        </div>
        {data.week.truncated ? <p className="dashboard-week-note">Very busy fortnight: some records were not counted.</p> : null}
      </section>

      <section className="dashboard-detail-grid" aria-label="Daily focus and habits">
        <FocusPanel task={focusTask} today={data.today} timeZone={data.timeZone} />
        <HabitsPanel habits={data.todayHabits} logs={data.habitLogs} today={data.today} />
      </section>

      <section className="dashboard-detail-grid dashboard-detail-grid-lower" aria-label="More tasks and active goals">
        <TasksPanel tasks={remainingTasks} today={data.today} timeZone={data.timeZone} />
        <GoalsPanel goals={data.goals} />
      </section>

      <PillarPanel items={pillarCounts} />

      <footer className="dashboard-footer">
        <span>LifeOS <span className="footer-separator">/</span> A practice, not a finish line.</span>
        <span>Everything here reflects records saved to your workspace.</span>
      </footer>
    </div>
  )
}
