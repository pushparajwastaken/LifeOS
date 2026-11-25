// Knowledge note rules. Pure TypeScript (plus zod) so node:test can import it directly.
// NOTE_TYPES mirrors the knowledge_notes.note_type check constraint in the core migration;
// tests/note-domain.test.mjs fails if they drift apart.
import { z } from 'zod'

export const NOTE_TYPES = ['book', 'research', 'technical_explanation', 'idea', 'question', 'essay'] as const
export type NoteType = (typeof NOTE_TYPES)[number]

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  book: 'Book note',
  research: 'Research',
  technical_explanation: 'Technical explanation',
  idea: 'Idea',
  question: 'Question',
  essay: 'Essay',
}

/** Notes created from a Side Quest default to research. */
export const QUEST_NOTE_TYPE: NoteType = 'research'

export const NOTE_LIMITS = { title: 240, body: 50000, sourceUrl: 2048 } as const

/** Only http(s) URLs are stored; javascript:, data: and anything else are rejected. */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0
  } catch {
    return false
  }
}

export const noteInputSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title.').max(NOTE_LIMITS.title),
  noteType: z.enum(NOTE_TYPES),
  body: z.string().max(NOTE_LIMITS.body).transform((value) => value.replace(/\r\n/g, '\n')),
  sourceUrl: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : typeof value === 'string' ? value.trim() : value),
    z.string().max(NOTE_LIMITS.sourceUrl).refine(isSafeHttpUrl, 'Use an http or https link.').nullable(),
  ),
})

export type NoteInput = z.infer<typeof noteInputSchema>

export function noteInputToRow(input: NoteInput) {
  return { title: input.title, note_type: input.noteType, body: input.body, source_url: input.sourceUrl }
}

export type NoteFilter = 'all' | 'linked' | 'unlinked'

export function parseNoteFilter(value: string | undefined): NoteFilter {
  return value === 'linked' || value === 'unlinked' ? value : 'all'
}

/** Search terms for Postgres websearch_to_tsquery: trimmed, length-capped, empty means no search. */
export function normalizeSearchQuery(value: string | undefined): string | null {
  const trimmed = (value ?? '').replace(/\s+/g, ' ').trim().slice(0, 120)
  return trimmed.length > 0 ? trimmed : null
}

export function excerpt(body: string, max = 180): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`
}
