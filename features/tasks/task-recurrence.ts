// Repeating tasks. tasks.recurrence holds { every: 'daily' | 'weekdays' | 'weekly' | 'monthly' }; completing a
// repeating task creates the next occurrence. Pure TypeScript (node:test loads it).

export const TASK_REPEATS = ['none', 'daily', 'weekdays', 'weekly', 'monthly'] as const
export type TaskRepeat = (typeof TASK_REPEATS)[number]
export const TASK_REPEAT_LABELS: Record<TaskRepeat, string> = { none: 'Does not repeat', daily: 'Every day', weekdays: 'Every weekday', weekly: 'Every week', monthly: 'Every month' }

export function recurrenceFor(repeat: TaskRepeat): { every: Exclude<TaskRepeat, 'none'> } | null {
  return repeat === 'none' ? null : { every: repeat }
}

/** The repeat rule stored on a task, or 'none' for anything missing or unrecognised. */
export function readRepeat(recurrence: unknown): TaskRepeat {
  const every = recurrence && typeof recurrence === 'object' && !Array.isArray(recurrence) ? (recurrence as { every?: unknown }).every : null
  return typeof every === 'string' && (TASK_REPEATS as readonly string[]).includes(every) && every !== 'none' ? (every as TaskRepeat) : 'none'
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * Next due date after `from` (YYYY-MM-DD). Monthly keeps the day of the month, clamped to the month's length
 * (Jan 31 → Feb 28/29). The result is never on or before `notBefore`, so completing an overdue repeating
 * task schedules the next one in the future rather than in the past.
 */
export function nextDueDate(from: string, repeat: Exclude<TaskRepeat, 'none'>, notBefore: string): string {
  const step = (key: string): string => {
    if (repeat === 'daily') return addDays(key, 1)
    if (repeat === 'weekly') return addDays(key, 7)
    if (repeat === 'weekdays') {
      let next = addDays(key, 1)
      while ([0, 6].includes(new Date(`${next}T00:00:00Z`).getUTCDay())) next = addDays(next, 1)
      return next
    }
    const [year, month, day] = key.split('-').map(Number)
    const target = new Date(Date.UTC(year, month, 1))
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
    target.setUTCDate(Math.min(day, lastDay))
    return target.toISOString().slice(0, 10)
  }
  let next = step(from)
  for (let guard = 0; next <= notBefore && guard < 4000; guard += 1) next = step(next)
  return next
}
