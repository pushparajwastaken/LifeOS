// Shared validation and date helpers for the pillar modules (Intellectual, Academic, Professional,
// Communication, Weekly reviews). Pure TypeScript; node:test imports it directly.
import { z } from 'zod'

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

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

/** Monday of the week containing `dateKey`. */
export function weekStartOf(dateKey: string): string {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay()
  return addDays(dateKey, -((day + 6) % 7))
}

/** Trimmed text; empty becomes null. Control characters other than newlines and tabs are removed. */
export const optionalText = (max: number) => z.string()
  .transform((value) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim())
  .pipe(z.string().max(max))
  .transform((value) => (value === '' ? null : value))

export const requiredText = (max: number) => z.string()
  .transform((value) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim())
  .pipe(z.string().min(1).max(max))

export const dateKey = z.string().trim().refine(isDateKey, 'Invalid date')
export const optionalDateKey = z.string().trim().refine((value) => value === '' || isDateKey(value), 'Invalid date')
  .transform((value) => (value === '' ? null : value))
export const timeOfDay = z.string().trim().refine((value) => value === '' || TIME.test(value), 'Invalid time')
  .transform((value) => value || '12:00')

/** Whole number from form text within [min, max]; empty becomes null when optional. */
export const wholeNumber = (min: number, max: number) => z.string().trim()
  .refine((value) => /^\d{1,7}$/.test(value) && Number(value) >= min && Number(value) <= max, 'Out of range')
  .transform(Number)
export const optionalWholeNumber = (min: number, max: number) => z.string().trim().transform((value, ctx) => {
  if (value === '') return null
  if (!/^\d{1,7}$/.test(value) || Number(value) < min || Number(value) > max) {
    ctx.addIssue({ code: 'custom', message: 'Out of range' })
    return z.NEVER
  }
  return Number(value)
})

/** Decimal with up to two places, from form text (commas ignored). */
export const decimalNumber = (min: number, max: number) => z.string().trim().transform((value) => value.replace(/,/g, ''))
  .refine((value) => /^\d{1,7}(\.\d{1,2})?$/.test(value), 'Invalid number').transform(Number)
  .refine((value) => value >= min && value <= max, 'Out of range')

/** http(s) URL up to 2048 characters; empty becomes null. Other schemes (javascript:, data:) are rejected. */
export const optionalWebUrl = z.string().trim().transform((value, ctx) => {
  if (value === '') return null
  try {
    const url = new URL(value)
    if ((url.protocol === 'http:' || url.protocol === 'https:') && value.length <= 2048 && url.hostname) return url.toString()
  } catch {
    // fall through
  }
  ctx.addIssue({ code: 'custom', message: 'Invalid URL' })
  return z.NEVER
})

/** "1 book", "2 books"; irregular plurals passed explicitly. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? singular : pluralForm}`
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export function percent(part: number, whole: number): number {
  if (!whole) return 0
  return Math.max(0, Math.min(100, Math.round((part / whole) * 100)))
}
