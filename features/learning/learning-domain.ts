// Learning session rules. Pure TypeScript (plus zod) so node:test can import it directly.
// Values mirror supabase/migrations/20261126110000_learning_sessions.sql; tests/learning-domain.test.mjs checks them.
// Only learning sessions count as learning effort; saving or importing resources never does.
import { z } from 'zod'

export const SESSION_TYPES = ['study', 'practice', 'build', 'watch', 'read', 'other'] as const
export type SessionType = (typeof SESSION_TYPES)[number]

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  study: 'Study',
  practice: 'Practice',
  build: 'Build',
  watch: 'Watch',
  read: 'Read',
  other: 'Other',
}

export const SESSION_PILLARS = ['physical', 'intellectual', 'academic', 'professional', 'communication', 'personal'] as const

export const SESSION_LIMITS = { topic: 160, notes: 4000, minMinutes: 1, maxMinutes: 1440 } as const

/** Soft-deleted sessions can be restored for exactly this long (enforced by the database clock). */
export const RESTORE_WINDOW_DAYS = 30

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function isDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)

export const sessionInputSchema = z
  .object({
    questId: z.preprocess(blankToNull, z.string().regex(UUID).nullable()),
    resourceId: z.preprocess(blankToNull, z.string().regex(UUID).nullable()),
    topic: z.preprocess(blankToNull, z.string().trim().max(SESSION_LIMITS.topic).nullable()),
    pillar: z.preprocess(blankToNull, z.enum(SESSION_PILLARS).nullable()),
    sessionType: z.enum(SESSION_TYPES),
    date: z.string().refine(isDateKey, 'Enter a valid date.'),
    time: z.string().regex(TIME, 'Enter a valid time.'),
    durationMinutes: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
      z.number().int().min(SESSION_LIMITS.minMinutes).max(SESSION_LIMITS.maxMinutes),
    ),
    notes: z.preprocess(blankToNull, z.string().max(SESSION_LIMITS.notes).nullable()),
  })
  .superRefine((value, context) => {
    if (!value.questId && !value.topic) {
      context.addIssue({ code: 'custom', path: ['topic'], message: 'A session without a quest needs a topic.' })
    }
  })

export type SessionInput = z.infer<typeof sessionInputSchema>

// ---------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------

function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instant))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(instant / 1000) * 1000
}

/**
 * Converts a wall-clock date and time in `timeZone` to a UTC ISO string.
 * Handles DST: a skipped local time resolves forward; an ambiguous one resolves to the earlier instant.
 */
export function zonedLocalToUtcIso(dateKey: string, time: string, timeZone: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  const first = wall - zoneOffsetMs(wall, timeZone)
  const second = wall - zoneOffsetMs(first, timeZone)
  const instant = first === second ? first : Math.min(first, second)
  return new Date(instant).toISOString()
}

/** The local date (YYYY-MM-DD) and time (HH:MM) of an instant in `timeZone`. */
export function utcToZonedParts(iso: string, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

/** Row values for a session from validated input. Pillar is kept only for sessions without a quest. */
export function sessionInputToRow(input: SessionInput, timeZone: string) {
  return {
    quest_id: input.questId,
    resource_id: input.resourceId,
    topic: input.topic,
    pillar: input.questId ? null : input.pillar,
    session_type: input.sessionType,
    started_at: zonedLocalToUtcIso(input.date, input.time, timeZone),
    duration_minutes: input.durationMinutes,
    notes: input.notes,
  }
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export type DatedMinutes = { localDate: string; minutes: number }

/** Total minutes for sessions whose local date falls in [startDate, endDate] (inclusive date keys). */
export function sumMinutesBetween(sessions: readonly DatedMinutes[], startDate: string, endDate: string): number {
  return sessions.reduce((total, s) => (s.localDate >= startDate && s.localDate <= endDate ? total + s.minutes : total), 0)
}

export type WeeklyTarget = { minutes: number; target: number | null; percent: number | null }

/** Current-week attainment only: the weekly target is editable and has no history. */
export function weeklyTargetAttainment(minutesThisWeek: number, target: number | null): WeeklyTarget {
  return {
    minutes: minutesThisWeek,
    target,
    percent: target ? Math.round((minutesThisWeek / target) * 100) : null,
  }
}

/** Whether a soft-deleted session is still inside the restore window (display only; the database decides). */
export function isWithinRestoreWindow(deletedAt: string, now: Date): boolean {
  return now.getTime() - new Date(deletedAt).getTime() < RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000
}

export function restoreDeadline(deletedAt: string): Date {
  return new Date(new Date(deletedAt).getTime() + RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** Groups items by local date, newest date first, preserving order within a day. */
export function groupByLocalDate<T extends { localDate: string }>(items: readonly T[]): Array<{ date: string; items: T[] }> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const list = groups.get(item.localDate)
    if (list) list.push(item)
    else groups.set(item.localDate, [item])
  }
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([date, list]) => ({ date, items: list }))
}
