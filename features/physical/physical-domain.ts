// Physical domain: validation and arithmetic for workouts, runs, body weight and sleep. Mirrors the core
// migration's constraints (tests/physical-domain.test.mjs checks them). Pure TypeScript for node:test.
import { z } from 'zod'

export const PHYSICAL_LIMITS = {
  title: 160, exerciseName: 120, notes: 1000, maxReps: 10000, maxWeight: 2000, maxDistance: 1000,
  maxRunSeconds: 7 * 24 * 3600, maxSleepMinutes: 1440, maxSets: 50,
} as const

export const WEIGHT_UNITS = ['kg', 'lb'] as const
export const DISTANCE_UNITS = ['km', 'mi'] as const
export type WeightUnit = (typeof WEIGHT_UNITS)[number]
export type DistanceUnit = (typeof DISTANCE_UNITS)[number]

const KM_PER_MILE = 1.609344
const KG_PER_LB = 0.45359237

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
export function isDateKey(value: string): boolean {
  if (!DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

const notes = z.string().trim().max(PHYSICAL_LIMITS.notes).transform((value) => (value === '' ? null : value))
const date = z.string().trim().refine(isDateKey, 'Invalid date')
const time = z.string().trim().refine((value) => value === '' || TIME.test(value), 'Invalid time').transform((value) => value || '12:00')
/** Decimal text with up to 2 decimals; commas allowed as thousands separators. */
const decimal = (max: number, allowZero: boolean) => z.string().trim().transform((value) => value.replace(/,/g, ''))
  .refine((value) => /^\d{1,7}(\.\d{1,2})?$/.test(value), 'Invalid number').transform(Number)
  .refine((value) => value <= max && (allowZero ? value >= 0 : value > 0), 'Out of range')
const optionalDecimal = (max: number) => z.string().trim().transform((value, ctx) => {
  if (value === '') return null
  const parsed = decimal(max, true).safeParse(value)
  if (!parsed.success) { ctx.addIssue({ code: 'custom', message: 'Invalid number' }); return z.NEVER }
  return parsed.data
})

/**
 * Parses a duration typed as minutes ("45"), minutes:seconds ("45:30") or hours:minutes:seconds ("1:05:00").
 * Returns whole seconds, or null when the text is not a duration.
 */
export function parseDurationSeconds(value: string): number | null {
  const text = value.trim()
  if (/^\d{1,5}$/.test(text)) return Number(text) * 60
  const parts = text.split(':')
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d{1,5}$/.test(part))) return null
  const numbers = parts.map(Number)
  const [h, m, s] = numbers.length === 3 ? numbers : [0, numbers[0], numbers[1]]
  if (s > 59 || (numbers.length === 3 && m > 59)) return null
  return h * 3600 + m * 60 + s
}

export const workoutInputSchema = z.object({
  title: z.string().trim().min(1).max(PHYSICAL_LIMITS.title),
  date, time,
  restDay: z.boolean(),
  notes,
})

export const exerciseInputSchema = z.object({ name: z.string().trim().min(1).max(PHYSICAL_LIMITS.exerciseName) })

export const setInputSchema = z.object({
  reps: z.string().trim().transform((value, ctx) => {
    if (value === '') return null
    if (!/^\d{1,5}$/.test(value) || Number(value) > PHYSICAL_LIMITS.maxReps) { ctx.addIssue({ code: 'custom', message: 'Invalid reps' }); return z.NEVER }
    return Number(value)
  }),
  weight: optionalDecimal(PHYSICAL_LIMITS.maxWeight),
  unit: z.enum(WEIGHT_UNITS),
}).refine((input) => input.reps !== null || input.weight !== null, { message: 'Enter reps or weight' })

export const runInputSchema = z.object({
  date, time,
  distance: decimal(PHYSICAL_LIMITS.maxDistance, false),
  unit: z.enum(DISTANCE_UNITS),
  duration: z.string().transform((value, ctx) => {
    const seconds = parseDurationSeconds(value)
    if (seconds === null || seconds <= 0 || seconds > PHYSICAL_LIMITS.maxRunSeconds) { ctx.addIssue({ code: 'custom', message: 'Invalid duration' }); return z.NEVER }
    return seconds
  }),
  notes,
})

export const bodyInputSchema = z.object({ date, time, weight: decimal(PHYSICAL_LIMITS.maxWeight, false), unit: z.enum(WEIGHT_UNITS), notes })

export const sleepInputSchema = z.object({
  date,
  hours: z.string().trim().refine((value) => /^\d{1,2}$/.test(value) && Number(value) <= 24, 'Invalid hours').transform(Number),
  minutes: z.string().trim().transform((value) => value || '0').refine((value) => /^\d{1,2}$/.test(value) && Number(value) <= 59, 'Invalid minutes').transform(Number),
  recovery: z.string().trim().transform((value, ctx) => {
    if (value === '') return null
    if (!/^\d{1,3}$/.test(value) || Number(value) > 100) { ctx.addIssue({ code: 'custom', message: 'Invalid score' }); return z.NEVER }
    return Number(value)
  }),
  notes,
}).refine((input) => input.hours * 60 + input.minutes <= PHYSICAL_LIMITS.maxSleepMinutes, { message: 'More than 24 hours', path: ['hours'] })

export const toKm = (distance: number, unit: string) => (unit === 'mi' ? distance * KM_PER_MILE : distance)
export const toKg = (weight: number, unit: string) => (unit === 'lb' ? weight * KG_PER_LB : weight)

/** Pace per kilometre or mile as m:ss, from total seconds. */
export function formatPace(seconds: number, distance: number, unit: DistanceUnit): string {
  const perUnit = Math.round(seconds / distance)
  return `${Math.floor(perUnit / 60)}:${String(perUnit % 60).padStart(2, '0')} /${unit}`
}

export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: digits })
}

/**
 * Change between the latest weight and the latest one at least `days` earlier, in the latest entry's unit.
 * Null when there is no earlier entry to compare with.
 */
export function weightChange(entries: ReadonlyArray<{ measuredAt: string; weight: number; unit: string }>, days = 28): { change: number; unit: string; sinceIso: string } | null {
  if (entries.length < 2) return null
  const sorted = [...entries].sort((a, b) => Date.parse(b.measuredAt) - Date.parse(a.measuredAt))
  const latest = sorted[0]
  const cutoff = Date.parse(latest.measuredAt) - days * 86_400_000
  const earlier = sorted.find((entry) => Date.parse(entry.measuredAt) <= cutoff)
  if (!earlier) return null
  const inLatestUnit = (entry: { weight: number; unit: string }) => (entry.unit === latest.unit ? entry.weight : latest.unit === 'kg' ? toKg(entry.weight, entry.unit) : entry.weight / KG_PER_LB)
  return { change: Math.round((latest.weight - inLatestUnit(earlier)) * 10) / 10, unit: latest.unit, sinceIso: earlier.measuredAt }
}
