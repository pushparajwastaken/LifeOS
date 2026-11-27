// Calendar view domain: month grids and per-day summaries of LifeOS records. Pure TypeScript (node:test).
// The calendar shows existing records only; it never stores anything of its own.

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Month (YYYY-MM) from the URL, limited to five years either side of today's month; otherwise today's month. */
export function parseMonth(raw: unknown, today: string): string {
  const current = today.slice(0, 7)
  if (typeof raw !== 'string' || !MONTH.test(raw)) return current
  const years = Number(raw.slice(0, 4)) - Number(current.slice(0, 4))
  return Math.abs(years) > 5 ? current : raw
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1))
  return date.toISOString().slice(0, 7)
}

/** Six Monday-first weeks (42 days) covering the month, so every month uses the same grid height. */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`
  const weekday = new Date(`${first}T00:00:00Z`).getUTCDay()
  const start = addDays(first, -((weekday + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

/** The selected day: a date inside the grid of `month`, else the 1st of the month (or today when it is in the month). */
export function parseSelectedDay(raw: unknown, month: string, today: string): string {
  const grid = monthGrid(month)
  if (isDateKey(raw) && grid.includes(raw)) return raw
  return today.startsWith(month) ? today : `${month}-01`
}

export type CalendarItemKind = 'task_due' | 'task_done' | 'learning' | 'workout' | 'rest' | 'run' | 'goal_end' | 'goal_milestone' | 'quest_milestone'

export type CalendarItem = { kind: CalendarItemKind; date: string; title: string; detail?: string; href?: string; minutes?: number; at?: string }

export const KIND_LABELS: Record<CalendarItemKind, string> = {
  task_due: 'Due', task_done: 'Done', learning: 'Learning', workout: 'Workout', rest: 'Rest day', run: 'Run',
  goal_end: 'Goal ends', goal_milestone: 'Goal milestone', quest_milestone: 'Quest milestone',
}

export type DaySummary = { due: number; done: number; learningMinutes: number; training: number; rest: number; deadlines: number; total: number }

/** Counts per day for the month cells. Deadlines are goal ends and open milestone dates. */
export function summarizeDays(items: readonly CalendarItem[]): Map<string, DaySummary> {
  const days = new Map<string, DaySummary>()
  for (const item of items) {
    const day = days.get(item.date) ?? { due: 0, done: 0, learningMinutes: 0, training: 0, rest: 0, deadlines: 0, total: 0 }
    if (item.kind === 'task_due') day.due += 1
    else if (item.kind === 'task_done') day.done += 1
    else if (item.kind === 'learning') day.learningMinutes += item.minutes ?? 0
    else if (item.kind === 'workout' || item.kind === 'run') day.training += 1
    else if (item.kind === 'rest') day.rest += 1
    else if (item.kind === 'goal_end' || item.kind === 'goal_milestone' || item.kind === 'quest_milestone') day.deadlines += 1
    day.total += 1
    days.set(item.date, day)
  }
  return days
}

/** A sentence for screen readers and tooltips describing one day's cell. */
export function describeDay(summary: DaySummary | undefined): string {
  if (!summary || summary.total === 0) return 'Nothing recorded'
  return [
    summary.due ? `${summary.due} ${summary.due === 1 ? 'task' : 'tasks'} due` : null,
    summary.done ? `${summary.done} done` : null,
    summary.learningMinutes ? `${summary.learningMinutes} min learning` : null,
    summary.training ? `${summary.training} training ${summary.training === 1 ? 'session' : 'sessions'}` : null,
    summary.rest ? 'rest day' : null,
    summary.deadlines ? `${summary.deadlines} ${summary.deadlines === 1 ? 'deadline' : 'deadlines'}` : null,
  ].filter(Boolean).join(', ') || `${summary.total} ${summary.total === 1 ? 'entry' : 'entries'}`
}

export function calendarHref(month: string, day: string | null, todayMonth: string): string {
  const params = new URLSearchParams()
  if (month !== todayMonth) params.set('month', month)
  if (day) params.set('day', day)
  const query = params.toString()
  return query ? `/calendar?${query}` : '/calendar'
}
