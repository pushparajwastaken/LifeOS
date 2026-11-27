// Intellectual pillar: books and reading sessions (core tables books, reading_sessions, knowledge_book_links).
// Mirrors the core migration's constraints; tests/intellectual-domain.test.mjs checks them.
import { z } from 'zod'
import { dateKey, optionalText, optionalWholeNumber, requiredText, percent } from '../pillars/pillar-domain.ts'

export const BOOK_STATUSES = ['reading', 'to_read', 'paused', 'completed', 'abandoned'] as const
export type BookStatus = (typeof BOOK_STATUSES)[number]
export const BOOK_STATUS_LABELS: Record<BookStatus, string> = {
  reading: 'Reading', to_read: 'To read', paused: 'Paused', completed: 'Finished', abandoned: 'Put down',
}
export const BOOK_LIMITS = { title: 200, author: 160, maxPages: 20000, maxSessionPages: 2000, maxMinutes: 1440, notes: 2000 } as const

export const bookInputSchema = z.object({
  title: requiredText(BOOK_LIMITS.title),
  author: optionalText(BOOK_LIMITS.author),
  totalPages: optionalWholeNumber(1, BOOK_LIMITS.maxPages),
  status: z.enum(BOOK_STATUSES),
})

export const readingSessionSchema = z.object({
  date: dateKey,
  pages: optionalWholeNumber(0, BOOK_LIMITS.maxSessionPages).transform((value) => value ?? 0),
  minutes: optionalWholeNumber(1, BOOK_LIMITS.maxMinutes),
  notes: optionalText(BOOK_LIMITS.notes),
}).refine((input) => input.pages > 0 || input.minutes !== null, { message: 'Enter pages or minutes', path: ['pages'] })

/**
 * Date columns to write when a book's status changes. Starting to read stamps started_on once; finishing
 * stamps finished_on (and started_on if it was never set, so finished >= started holds); going back to
 * reading or to-read clears finished_on.
 */
export function statusDates(status: BookStatus, current: { started_on: string | null; finished_on: string | null }, today: string) {
  if (status === 'reading') return { started_on: current.started_on ?? today, finished_on: null }
  if (status === 'completed') {
    const started = current.started_on && current.started_on <= today ? current.started_on : today
    return { started_on: started, finished_on: today }
  }
  if (status === 'to_read') return { started_on: null, finished_on: null }
  return { started_on: current.started_on, finished_on: null }
}

export type BookProgress = { pagesRead: number; percent: number | null; remaining: number | null }

/** Pages read so far (sum of sessions) against the book's length; no percentage without a page count. */
export function bookProgress(totalPages: number | null, pagesRead: number, status: BookStatus): BookProgress {
  if (!totalPages) return { pagesRead, percent: null, remaining: null }
  const shown = status === 'completed' ? Math.max(pagesRead, totalPages) : pagesRead
  return { pagesRead, percent: percent(shown, totalPages), remaining: Math.max(0, totalPages - pagesRead) }
}
