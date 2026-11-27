// Settings domain: profile validation and the data-export table list. Pure TypeScript (node:test loads it).
import { z } from 'zod'

export const PROFILE_LIMITS = { displayName: 80 } as const
/** The database default for a profile that has never been named. Treated as "no name". */
export const DEFAULT_DISPLAY_NAME = 'Your space'

/** True when the runtime accepts `value` as an IANA timezone (case-sensitive, as stored). */
export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(value)) return false
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone.length > 0
  } catch {
    return false
  }
}

/**
 * ICU (and so `Intl.supportedValuesOf`) still lists some zones under legacy names. The picker shows the current
 * IANA name instead, so people can find "Kolkata" or "Kyiv"; both names describe the same zone.
 */
export const LEGACY_TIME_ZONE_NAMES: Readonly<Record<string, string>> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Europe/Kiev': 'Europe/Kyiv',
  'America/Godthab': 'America/Nuuk',
  'Pacific/Enderbury': 'Pacific/Kanton',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
}

/** Sorted IANA timezones offered in the picker (current names, no legacy duplicates); the saved value is always included. */
export function timeZoneOptions(current: string): string[] {
  const supported = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  const modern = supported.map((zone) => LEGACY_TIME_ZONE_NAMES[zone] ?? zone)
  return [...new Set(['UTC', ...modern, current])].filter(isValidTimeZone).sort((a, b) => (a === 'UTC' ? -1 : b === 'UTC' ? 1 : a.localeCompare(b)))
}

export const profileInputSchema = z.object({
  displayName: z.string().transform((value) => value.replace(/[\u0000-\u001f\u007f]/g, '').trim())
    .pipe(z.string().max(PROFILE_LIMITS.displayName))
    .transform((value) => value || DEFAULT_DISPLAY_NAME),
  timeZone: z.string().trim().refine(isValidTimeZone, 'Unknown timezone'),
})

/**
 * Every user-owned table included in "Export my data", with the columns used to page through it in a stable
 * order. Static on purpose: no table or column name ever comes from the request. `profiles` is keyed by `id`.
 */
export const EXPORT_TABLES: ReadonlyArray<{ table: string; owner: 'user_id' | 'id'; order: readonly string[] }> = [
  { table: 'profiles', owner: 'id', order: ['id'] },
  ...[
    'tasks', 'habits', 'habit_logs', 'goals', 'goal_milestones', 'goal_progress_entries', 'daily_reviews', 'weekly_reviews',
    'side_quests', 'quest_objectives', 'quest_milestones', 'learning_sessions', 'learning_resources', 'resource_source_records',
    'import_runs', 'import_candidates', 'knowledge_notes', 'knowledge_tags', 'knowledge_links',
    'workouts', 'exercises', 'exercise_sets', 'running_sessions', 'body_metrics', 'sleep_logs',
    'books', 'reading_sessions', 'videos', 'subjects', 'subject_topics', 'assessments', 'revision_items', 'error_log_items',
    'projects', 'project_milestones', 'project_tasks', 'coding_sessions', 'shipping_logs', 'dsa_logs', 'speaking_sessions',
    'rabbit_holes', 'rabbit_hole_resources', 'rabbit_hole_experiments', 'study_sessions',
  ].map((table) => ({ table, owner: 'user_id' as const, order: ['id'] as const })),
  { table: 'quest_notes', owner: 'user_id', order: ['quest_id', 'note_id'] },
  { table: 'quest_resources', owner: 'user_id', order: ['quest_id', 'resource_id'] },
  { table: 'knowledge_note_tags', owner: 'user_id', order: ['note_id', 'tag_id'] },
  { table: 'knowledge_book_links', owner: 'user_id', order: ['note_id', 'book_id'] },
  { table: 'habit_calendar_connections', owner: 'user_id', order: ['user_id'] },
  { table: 'habit_calendar_events', owner: 'user_id', order: ['user_id', 'habit_id'] },
]

export const EXPORT_LIMITS = { pageSize: 1000, maxRowsPerTable: 20000 } as const

export function exportFileName(now: Date): string {
  return `lifeos-export-${now.toISOString().slice(0, 10)}.json`
}
