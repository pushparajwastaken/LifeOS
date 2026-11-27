// Tasks page domain: input validation, filters, status transitions and grouping.
// Pure TypeScript with no app imports (node:test loads it directly). Status values come from task-status.ts's
// contract and are repeated here only as literals checked by tests/task-domain.test.mjs.
import { z } from 'zod'

export const TASK_LIMITS = { title: 200, description: 2000, maxEstimate: 1440, listCap: 300 } as const
export const TASK_PRIORITIES = ['high', 'medium', 'low'] as const
export const TASK_PILLARS = ['physical', 'intellectual', 'academic', 'professional', 'communication', 'personal'] as const
export const TASK_VIEWS = ['open', 'done', 'cancelled', 'all'] as const

export type TaskPriority = (typeof TASK_PRIORITIES)[number]
export type TaskPillar = (typeof TASK_PILLARS)[number]
export type TaskView = (typeof TASK_VIEWS)[number]

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' }
export const TASK_PILLAR_LABELS: Record<TaskPillar, string> = {
  physical: 'Physical', intellectual: 'Intellectual', academic: 'Academic', professional: 'Professional', communication: 'Communication', personal: 'Personal',
}
export const TASK_VIEW_LABELS: Record<TaskView, string> = { open: 'Open', done: 'Done', cancelled: 'Cancelled', all: 'All' }
export const TASK_STATUS_LABELS: Record<string, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done', cancelled: 'Cancelled' }

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => (value === '' ? null : value))

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(TASK_LIMITS.title),
  description: optionalText(TASK_LIMITS.description),
  priority: z.enum(TASK_PRIORITIES),
  pillar: z.union([z.enum(TASK_PILLARS), z.literal('')]).transform((value) => (value === '' ? null : value)),
  dueDate: z.string().trim().refine((value) => value === '' || validDate(value), 'Invalid date'),
  dueTime: z.string().trim().refine((value) => value === '' || TIME.test(value), 'Invalid time'),
  estimatedMinutes: z.string().trim().refine((value) => value === '' || (/^\d{1,4}$/.test(value) && Number(value) >= 1 && Number(value) <= TASK_LIMITS.maxEstimate), 'Invalid estimate')
    .transform((value) => (value === '' ? null : Number(value))),
})

export type TaskInput = z.output<typeof taskInputSchema>

/** Wall-clock due date and time in the profile timezone. A date without a time is due at the end of that day; a time without a date is ignored (clearing the date clears the deadline). */
export function dueWallClock(input: Pick<TaskInput, 'dueDate' | 'dueTime'>): { date: string; time: string } | null {
  if (!input.dueDate) return null
  return { date: input.dueDate, time: input.dueTime || '23:59' }
}

export type TaskFilters = { view: TaskView; pillar: TaskPillar | null; query: string | null }

export function parseTaskFilters(raw: { view?: string; pillar?: string; q?: string }): TaskFilters {
  const view = (TASK_VIEWS as readonly string[]).includes(raw.view ?? '') ? (raw.view as TaskView) : 'open'
  const pillar = (TASK_PILLARS as readonly string[]).includes(raw.pillar ?? '') ? (raw.pillar as TaskPillar) : null
  const query = (raw.q ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 100)
  return { view, pillar, query: query || null }
}

/** Query string for a filter combination (defaults omitted), always starting with `/tasks`. */
export function tasksHref(filters: TaskFilters, change: Partial<TaskFilters> = {}): string {
  const next = { ...filters, ...change }
  const params = new URLSearchParams()
  if (next.view !== 'open') params.set('view', next.view)
  if (next.pillar) params.set('pillar', next.pillar)
  if (next.query) params.set('q', next.query)
  const query = params.toString()
  return query ? `/tasks?${query}` : '/tasks'
}

/** Only same-page return paths are accepted from forms. */
export function safeTasksReturn(value: unknown): string {
  if (typeof value !== 'string' || value.length > 300 || !/^\/tasks(\?[A-Za-z0-9=&%._+-]*)?$/.test(value)) return '/tasks'
  return value
}

/** Escapes LIKE wildcards so a search is always a literal substring match. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export const TASK_INTENTS = ['start', 'complete', 'reopen', 'cancel'] as const
export type TaskIntent = (typeof TASK_INTENTS)[number]

/** Allowed status transitions: the statuses a task must currently have, and the status it moves to. */
export const TASK_TRANSITIONS: Record<TaskIntent, { from: readonly string[]; to: string }> = {
  start: { from: ['todo'], to: 'in_progress' },
  complete: { from: ['todo', 'in_progress'], to: 'done' },
  reopen: { from: ['done', 'cancelled', 'in_progress'], to: 'todo' },
  cancel: { from: ['todo', 'in_progress'], to: 'cancelled' },
}

export type DueGroupId = 'overdue' | 'today' | 'upcoming' | 'none'
export const DUE_GROUP_LABELS: Record<DueGroupId, string> = { overdue: 'Overdue', today: 'Due today', upcoming: 'Upcoming', none: 'No due date' }

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

/**
 * Groups open tasks for display. `dueAt` decides overdue (past the instant), `dueDate` (local date) decides
 * today and upcoming. Within a group: earliest due first, then priority, then newest.
 */
export function groupOpenTasks<T extends { dueAt: string | null; dueDate: string | null; priority: string; createdAt: string }>(
  tasks: readonly T[], today: string, now: Date,
): Array<{ id: DueGroupId; tasks: T[] }> {
  const groups: Record<DueGroupId, T[]> = { overdue: [], today: [], upcoming: [], none: [] }
  for (const task of tasks) {
    if (!task.dueAt || !task.dueDate) groups.none.push(task)
    else if (new Date(task.dueAt).getTime() < now.getTime()) groups.overdue.push(task)
    else if (task.dueDate === today) groups.today.push(task)
    else groups.upcoming.push(task)
  }
  const byDue = (a: T, b: T) => (a.dueAt && b.dueAt ? Date.parse(a.dueAt) - Date.parse(b.dueAt) : 0)
    || (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
    || Date.parse(b.createdAt) - Date.parse(a.createdAt)
  return (['overdue', 'today', 'upcoming', 'none'] as const)
    .map((id) => ({ id, tasks: groups[id].sort(byDue) }))
    .filter((group) => group.tasks.length > 0)
}
