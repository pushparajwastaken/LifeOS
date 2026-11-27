// Weekly reviews (core table weekly_reviews, one row per user and Monday week_start).
import { z } from 'zod'
import { addDays, isDateKey, optionalText, weekStartOf } from '../pillars/pillar-domain.ts'

export const REVIEW_LIMITS = { field: 4000, history: 52 } as const

export const REVIEW_FIELDS = [
  { field: 'wins', label: 'Wins', prompt: 'What went well this week?' },
  { field: 'failures', label: 'Misses', prompt: 'What did not go to plan?' },
  { field: 'blockers', label: 'Blockers', prompt: 'What is getting in the way?' },
  { field: 'next_priorities', label: 'Next week', prompt: 'The few things that matter most next week' },
] as const
export type ReviewField = (typeof REVIEW_FIELDS)[number]['field']

const text = optionalText(REVIEW_LIMITS.field)
export const weeklyReviewSchema = z.object({ week: z.string().refine(isDateKey), wins: text, failures: text, blockers: text, next_priorities: text })

/** The Monday week to show: any Monday-normalised date up to this week; anything else is this week. */
export function parseReviewWeek(raw: unknown, today: string): string {
  const current = weekStartOf(today)
  if (!isDateKey(raw)) return current
  const monday = weekStartOf(raw)
  return monday > current || monday < addDays(current, -7 * 520) ? current : monday
}

export function weekRangeLabel(weekStart: string): string {
  const format = (key: string, withYear: boolean) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) }).format(new Date(`${key}T00:00:00Z`))
  return `${format(weekStart, false)} – ${format(addDays(weekStart, 6), true)}`
}
