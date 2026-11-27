// Academic pillar: subjects, topics, spaced revision, assessments and an error log (core tables subjects,
// subject_topics, revision_items, assessments, error_log_items). Study time comes from learning sessions
// (pillar "academic"); the legacy study_sessions table is deliberately not used.
import { z } from 'zod'
import { dateKey, decimalNumber, optionalText, optionalWholeNumber, requiredText } from '../pillars/pillar-domain.ts'

export const SUBJECT_COLORS = ['sage', 'sky', 'amber', 'rose', 'violet', 'slate'] as const
export type SubjectColor = (typeof SUBJECT_COLORS)[number]
export const SUBJECT_COLOR_VALUES: Record<SubjectColor, string> = {
  sage: 'oklch(0.62 0.09 150)', sky: 'oklch(0.62 0.1 235)', amber: 'oklch(0.72 0.13 75)',
  rose: 'oklch(0.62 0.13 15)', violet: 'oklch(0.58 0.12 295)', slate: 'oklch(0.55 0.02 255)',
}

export const TOPIC_STATUSES = ['planned', 'learning', 'review', 'mastered'] as const
export type TopicStatus = (typeof TOPIC_STATUSES)[number]
export const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = { planned: 'Planned', learning: 'Learning', review: 'Reviewing', mastered: 'Mastered' }

export const ERROR_STATUSES = ['open', 'reviewing', 'resolved'] as const
export type ErrorStatus = (typeof ERROR_STATUSES)[number]
export const ERROR_STATUS_LABELS: Record<ErrorStatus, string> = { open: 'Open', reviewing: 'Reviewing', resolved: 'Resolved' }

export const REVISION_GRADES = ['again', 'hard', 'good', 'easy'] as const
export type RevisionGrade = (typeof REVISION_GRADES)[number]
export const REVISION_GRADE_LABELS: Record<RevisionGrade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }

export const ACADEMIC_LIMITS = { subject: 120, topic: 180, revision: 200, assessment: 180, prompt: 2000, correction: 4000, notes: 2000, maxScore: 100000, maxQuestions: 10000, maxInterval: 365 } as const

export const subjectInputSchema = z.object({ name: requiredText(ACADEMIC_LIMITS.subject), color: z.enum(SUBJECT_COLORS) })
export const topicInputSchema = z.object({ name: requiredText(ACADEMIC_LIMITS.topic), status: z.enum(TOPIC_STATUSES) })
export const revisionInputSchema = z.object({ title: requiredText(ACADEMIC_LIMITS.revision) })
export const errorInputSchema = z.object({ prompt: requiredText(ACADEMIC_LIMITS.prompt), correction: optionalText(ACADEMIC_LIMITS.correction) })
export const assessmentInputSchema = z.object({
  title: requiredText(ACADEMIC_LIMITS.assessment),
  date: dateKey,
  score: decimalNumber(0, ACADEMIC_LIMITS.maxScore),
  maxScore: decimalNumber(0.01, ACADEMIC_LIMITS.maxScore),
  questions: optionalWholeNumber(1, ACADEMIC_LIMITS.maxQuestions),
  notes: optionalText(ACADEMIC_LIMITS.notes),
}).refine((input) => input.score <= input.maxScore, { message: 'Score above maximum', path: ['score'] })

export type RevisionState = { interval_days: number; ease_factor: number }

/**
 * Next spacing for a revision item (a simplified SM-2). "Again" restarts at one day and lowers ease; "Hard"
 * grows the interval slowly; "Good" multiplies by ease; "Easy" multiplies further and raises ease. Ease never
 * drops below 1.3 (the database minimum) and intervals are capped at a year.
 */
export function scheduleReview(state: RevisionState, grade: RevisionGrade, now: Date): RevisionState & { next_review_at: string } {
  const ease = Number(state.ease_factor) || 2.5
  const interval = Math.max(1, state.interval_days)
  let nextInterval: number
  let nextEase = ease
  if (grade === 'again') { nextInterval = 1; nextEase = ease - 0.2 }
  else if (grade === 'hard') { nextInterval = Math.max(interval + 1, Math.round(interval * 1.2)); nextEase = ease - 0.15 }
  else if (grade === 'good') nextInterval = Math.max(interval + 1, Math.round(interval * ease))
  else { nextInterval = Math.max(interval + 2, Math.round(interval * ease * 1.3)); nextEase = ease + 0.15 }
  nextInterval = Math.min(ACADEMIC_LIMITS.maxInterval, nextInterval)
  nextEase = Math.round(Math.max(1.3, Math.min(3.5, nextEase)) * 100) / 100
  return { interval_days: nextInterval, ease_factor: nextEase, next_review_at: new Date(now.getTime() + nextInterval * 86_400_000).toISOString() }
}

/** Due when never reviewed or when the next review time has passed. */
export function isDue(item: { next_review_at: string | null; status: string }, now: Date): boolean {
  return item.status === 'active' && (!item.next_review_at || Date.parse(item.next_review_at) <= now.getTime())
}

export function scorePercent(score: number, maxScore: number): number {
  return maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0
}

/** Mean of assessment percentages (each assessment counts once, whatever its maximum). */
export function averagePercent(assessments: ReadonlyArray<{ score: number; max_score: number }>): number | null {
  if (!assessments.length) return null
  return Math.round((assessments.reduce((sum, item) => sum + scorePercent(Number(item.score), Number(item.max_score)), 0) / assessments.length) * 10) / 10
}
