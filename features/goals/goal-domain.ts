// Goals domain: validation, periods, status transitions and progress. Pure TypeScript with no app imports
// (node:test loads it directly). Mirrors the core-migration constraints on goals, goal_milestones and
// goal_progress_entries; tests/goal-domain.test.mjs checks the literals against the migration.
import { z } from 'zod'

export const GOAL_LIMITS = { title: 180, description: 2000, unit: 30, note: 500, maxValue: 1_000_000_000, listCap: 200 } as const
export const GOAL_PILLARS = ['physical', 'intellectual', 'academic', 'professional', 'communication', 'personal'] as const
export const GOAL_PERIODS = ['30_day', '90_day', 'annual', 'custom'] as const
export const GOAL_STATUSES = ['active', 'paused', 'completed', 'abandoned'] as const

export type GoalPillar = (typeof GOAL_PILLARS)[number]
export type GoalPeriod = (typeof GOAL_PERIODS)[number]
export type GoalStatus = (typeof GOAL_STATUSES)[number]

export const GOAL_PILLAR_LABELS: Record<GoalPillar, string> = {
  physical: 'Physical', intellectual: 'Intellectual', academic: 'Academic', professional: 'Professional', communication: 'Communication', personal: 'Personal',
}
export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = { '30_day': '30 days', '90_day': '90 days', annual: 'One year', custom: 'Custom dates' }
export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = { active: 'Active', paused: 'Paused', completed: 'Completed', abandoned: 'Let go' }

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
export function isDateKey(value: string): boolean {
  if (!DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => (value === '' ? null : value))
/** Decimal text such as "12", "12.5" or "1,200" (commas ignored); up to 2 decimals. */
const decimal = z.string().trim().transform((value) => value.replace(/,/g, '')).refine((value) => /^\d{1,10}(\.\d{1,2})?$/.test(value), 'Invalid number')
  .transform(Number).refine((value) => value <= GOAL_LIMITS.maxValue, 'Too large')
const optionalPositive = z.string().trim().transform((value, ctx) => {
  if (value === '') return null
  const parsed = decimal.safeParse(value)
  if (!parsed.success || parsed.data <= 0) {
    ctx.addIssue({ code: 'custom', message: 'Must be a positive number' })
    return z.NEVER
  }
  return parsed.data
})

export const goalInputSchema = z.object({
  title: z.string().trim().min(1).max(GOAL_LIMITS.title),
  description: optionalText(GOAL_LIMITS.description),
  pillar: z.enum(GOAL_PILLARS),
  period: z.enum(GOAL_PERIODS),
  startsOn: z.string().trim().refine(isDateKey, 'Invalid start date'),
  endsOn: z.string().trim().refine((value) => value === '' || isDateKey(value), 'Invalid end date'),
  targetValue: optionalPositive,
  unit: optionalText(GOAL_LIMITS.unit),
}).superRefine((input, ctx) => {
  if (input.period === 'custom' && !input.endsOn) ctx.addIssue({ code: 'custom', path: ['endsOn'], message: 'Custom goals need an end date' })
  if (input.period === 'custom' && input.endsOn && input.endsOn < input.startsOn) ctx.addIssue({ code: 'custom', path: ['endsOn'], message: 'End before start' })
})

export type GoalInput = z.output<typeof goalInputSchema>

/** Last day of a goal: preset periods count the start day (30 days = start + 29); custom uses the given date. */
export function goalEndsOn(period: GoalPeriod, startsOn: string, endsOn: string): string {
  if (period === '30_day') return addDays(startsOn, 29)
  if (period === '90_day') return addDays(startsOn, 89)
  if (period === 'annual') return addDays(startsOn, 364)
  return endsOn
}

/** Row values for a goal. A unit without a target is dropped (it would have nothing to measure). */
export function goalInputToRow(input: GoalInput) {
  return {
    title: input.title,
    description: input.description,
    pillar: input.pillar,
    period: input.period,
    starts_on: input.startsOn,
    ends_on: goalEndsOn(input.period, input.startsOn, input.endsOn),
    target_value: input.targetValue,
    unit: input.targetValue === null ? null : input.unit,
  }
}

export const progressInputSchema = z.object({
  value: decimal,
  date: z.string().trim().refine(isDateKey, 'Invalid date'),
  note: optionalText(GOAL_LIMITS.note),
})

export const milestoneInputSchema = z.object({
  title: z.string().trim().min(1).max(GOAL_LIMITS.title),
  dueOn: z.string().trim().refine((value) => value === '' || isDateKey(value), 'Invalid date').transform((value) => (value === '' ? null : value)),
})

export const GOAL_INTENTS = ['pause', 'resume', 'complete', 'abandon', 'reopen'] as const
export type GoalIntent = (typeof GOAL_INTENTS)[number]

export const GOAL_TRANSITIONS: Record<GoalIntent, { from: readonly GoalStatus[]; to: GoalStatus }> = {
  pause: { from: ['active'], to: 'paused' },
  resume: { from: ['paused'], to: 'active' },
  complete: { from: ['active', 'paused'], to: 'completed' },
  abandon: { from: ['active', 'paused'], to: 'abandoned' },
  reopen: { from: ['completed', 'abandoned'], to: 'active' },
}

export type GoalProgress =
  | { kind: 'target'; current: number | null; target: number; percent: number }
  | { kind: 'milestones'; done: number; total: number; percent: number }
  | { kind: 'none' }

/**
 * Progress shown for a goal. With a target, progress entries are readings of where you stand now, so the
 * latest reading counts (not a sum); it is capped at 100%. Without a target, completed milestones count.
 */
export function goalProgress(goal: { target_value: number | null }, latestValue: number | null, milestones: ReadonlyArray<{ completed_at: string | null }>): GoalProgress {
  if (goal.target_value !== null && goal.target_value > 0) {
    const percent = latestValue === null ? 0 : Math.min(100, Math.round((latestValue / goal.target_value) * 100))
    return { kind: 'target', current: latestValue, target: goal.target_value, percent }
  }
  if (milestones.length > 0) {
    const done = milestones.filter((milestone) => milestone.completed_at).length
    return { kind: 'milestones', done, total: milestones.length, percent: Math.round((done / milestones.length) * 100) }
  }
  return { kind: 'none' }
}

/** Where today falls in the goal's period: day N of M, clamped to the period. Neutral context, not a score. */
export function periodPosition(startsOn: string, endsOn: string, today: string): { day: number; totalDays: number; state: 'upcoming' | 'running' | 'ended' } {
  const dayMs = 86_400_000
  const totalDays = Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`)) / dayMs) + 1
  const elapsed = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`)) / dayMs) + 1
  if (elapsed < 1) return { day: 0, totalDays, state: 'upcoming' }
  if (elapsed > totalDays) return { day: totalDays, totalDays, state: 'ended' }
  return { day: elapsed, totalDays, state: 'running' }
}

export function formatGoalValue(value: number, unit: string | null): string {
  const text = value.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return unit ? `${text} ${unit}` : text
}
