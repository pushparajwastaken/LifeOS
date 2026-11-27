// Communication pillar: speaking practice and a video pipeline (core tables speaking_sessions, videos).
import { z } from 'zod'
import { dateKey, optionalText, optionalWebUrl, optionalWholeNumber, requiredText, timeOfDay, wholeNumber } from '../pillars/pillar-domain.ts'

export const PRACTICE_TYPES = ['presentation', 'storytelling', 'impromptu', 'conversation', 'other'] as const
export type PracticeType = (typeof PRACTICE_TYPES)[number]
export const PRACTICE_TYPE_LABELS: Record<PracticeType, string> = { presentation: 'Presentation', storytelling: 'Storytelling', impromptu: 'Impromptu', conversation: 'Conversation', other: 'Other' }

export const VIDEO_STATUSES = ['idea', 'scripting', 'recording', 'editing', 'published'] as const
export type VideoStatus = (typeof VIDEO_STATUSES)[number]
export const VIDEO_STATUS_LABELS: Record<VideoStatus, string> = { idea: 'Idea', scripting: 'Scripting', recording: 'Recording', editing: 'Editing', published: 'Published' }

export const COMMUNICATION_LIMITS = { feedback: 2000, title: 200, topic: 120, maxMinutes: 1440, maxVideoMinutes: 600 } as const

export const speakingInputSchema = z.object({
  date: dateKey,
  time: timeOfDay,
  minutes: wholeNumber(1, COMMUNICATION_LIMITS.maxMinutes),
  type: z.enum(PRACTICE_TYPES),
  rating: optionalWholeNumber(1, 5),
  recordingUrl: optionalWebUrl,
  feedback: optionalText(COMMUNICATION_LIMITS.feedback),
})

export const videoInputSchema = z.object({
  title: requiredText(COMMUNICATION_LIMITS.title),
  topic: optionalText(COMMUNICATION_LIMITS.topic),
  videoUrl: optionalWebUrl,
  minutes: optionalWholeNumber(1, COMMUNICATION_LIMITS.maxVideoMinutes),
})

/** The next or previous pipeline stage; null at either end. */
export function adjacentStage(status: VideoStatus, direction: 1 | -1): VideoStatus | null {
  const index = VIDEO_STATUSES.indexOf(status) + direction
  return index >= 0 && index < VIDEO_STATUSES.length ? VIDEO_STATUSES[index] : null
}

/** published_at is set when a video reaches "published" (keeping an earlier date) and cleared when it moves back. */
export function publishedAtFor(status: VideoStatus, current: string | null, now: Date): string | null {
  if (status !== 'published') return null
  return current ?? now.toISOString()
}

/** Mean self-rating of the sessions that have one, to one decimal. */
export function averageRating(sessions: ReadonlyArray<{ self_evaluation: number | null }>): number | null {
  const rated = sessions.filter((session) => session.self_evaluation !== null)
  if (!rated.length) return null
  return Math.round((rated.reduce((sum, session) => sum + (session.self_evaluation ?? 0), 0) / rated.length) * 10) / 10
}
