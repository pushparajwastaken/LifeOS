// Daily planner domain. The planner owns no data of its own except the daily review: a task is planned for a
// day by its due date, habits come from their schedules, learning from sessions. Pure TypeScript (node:test).
import { z } from 'zod'

export const PLANNER_LIMITS = { reviewField: 2000, backlog: 15, rangeDays: 366 } as const

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

/** The planner date from the URL: a real date within a year of today, else today. */
export function parsePlannerDate(raw: unknown, today: string): string {
  if (!isDateKey(raw)) return today
  const min = addDays(today, -PLANNER_LIMITS.rangeDays)
  const max = addDays(today, PLANNER_LIMITS.rangeDays)
  return raw < min || raw > max ? today : raw
}

export function plannerHref(date: string, today: string): string {
  return date === today ? '/planner' : `/planner?date=${date}`
}

export const PLAN_INTENTS = ['plan', 'next_day', 'unplan'] as const
export type PlanIntent = (typeof PLAN_INTENTS)[number]

/**
 * New wall-clock due date and time for a planning action. Planning for a day keeps an existing time of day
 * (or uses the end of the day); moving to the next day keeps the time; unplanning clears the due date.
 * A kept time that has already passed (`now`, local) becomes the end of the day, so a task is never planned
 * straight into being overdue.
 */
export function plannedDue(intent: PlanIntent, targetDate: string, current: { date: string; time: string } | null, now?: { date: string; time: string }): { date: string; time: string } | null {
  if (intent === 'unplan') return null
  const date = intent === 'next_day' ? addDays(current?.date ?? targetDate, 1) : targetDate
  const kept = current?.time ?? '23:59'
  const passed = now !== undefined && (date < now.date || (date === now.date && kept <= now.time))
  return { date, time: passed ? '23:59' : kept }
}

const reviewText = z.string().trim().max(PLANNER_LIMITS.reviewField).transform((value) => (value === '' ? null : value))

export const reviewInputSchema = z.object({
  date: z.string().refine(isDateKey, 'Invalid date'),
  accomplished: reviewText,
  learned: reviewText,
  improve: reviewText,
  gratitude: reviewText,
  tomorrow: reviewText,
})

export const REVIEW_PROMPTS = [
  { field: 'accomplished', label: 'What got done?' },
  { field: 'learned', label: 'What did you learn?' },
  { field: 'improve', label: 'What would you do differently?' },
  { field: 'gratitude', label: 'Something you are grateful for' },
  { field: 'tomorrow', label: 'Intention for tomorrow' },
] as const

export type ReviewField = (typeof REVIEW_PROMPTS)[number]['field']

/** Total estimated minutes of the planned tasks, and how many have no estimate (so totals are never overstated). */
export function plannedLoad(tasks: ReadonlyArray<{ estimatedMinutes: number | null }>): { minutes: number; unestimated: number } {
  return tasks.reduce((sum, task) => (task.estimatedMinutes ? { ...sum, minutes: sum.minutes + task.estimatedMinutes } : { ...sum, unestimated: sum.unestimated + 1 }), { minutes: 0, unestimated: 0 })
}
