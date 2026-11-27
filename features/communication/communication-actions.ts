'use server'

import { field, finish, pastInstant, pillarSession, requireId } from '@/features/pillars/pillar-actions-kit'
import { VIDEO_STATUSES, adjacentStage, publishedAtFor, speakingInputSchema, videoInputSchema, type VideoStatus } from './communication-domain'

const HOME = '/communication'

export async function logSpeakingAction(formData: FormData): Promise<void> {
  const session = await pillarSession()
  const parsed = speakingInputSchema.safeParse({ date: field(formData, 'date') || session.today, time: field(formData, 'time'), minutes: field(formData, 'minutes'), type: field(formData, 'type') || 'other', rating: field(formData, 'rating'), recordingUrl: field(formData, 'recordingUrl'), feedback: field(formData, 'feedback') })
  if (!parsed.success) finish(HOME, 'speaking-invalid', '#practice')
  const practicedAt = pastInstant(parsed.data.date, parsed.data.time, session.timeZone)
  if (!practicedAt) finish(HOME, 'physical-future', '#practice')
  const { error } = await session.supabase.from('speaking_sessions').insert({ user_id: session.userId, practiced_at: practicedAt, duration_minutes: parsed.data.minutes, practice_type: parsed.data.type, self_evaluation: parsed.data.rating, recording_url: parsed.data.recordingUrl, feedback: parsed.data.feedback })
  finish(HOME, error ? 'save-failed' : 'speaking-logged', '#practice')
}

export async function deleteSpeakingAction(formData: FormData): Promise<void> {
  const sessionId = requireId(formData, 'sessionId', HOME)
  const { supabase, userId } = await pillarSession()
  const { data, error } = await supabase.from('speaking_sessions').delete().eq('id', sessionId).eq('user_id', userId).select('id').maybeSingle()
  finish(HOME, error ? 'save-failed' : data ? 'entry-deleted' : 'record-not-found', '#practice')
}

export async function addVideoAction(formData: FormData): Promise<void> {
  const parsed = videoInputSchema.safeParse({ title: field(formData, 'title'), topic: field(formData, 'topic'), videoUrl: field(formData, 'videoUrl'), minutes: field(formData, 'minutes') })
  if (!parsed.success) finish(HOME, 'video-invalid', '#videos')
  const { supabase, userId } = await pillarSession()
  const { error } = await supabase.from('videos').insert({ user_id: userId, title: parsed.data.title, topic: parsed.data.topic, video_url: parsed.data.videoUrl, duration_seconds: parsed.data.minutes ? parsed.data.minutes * 60 : null })
  finish(HOME, error ? 'save-failed' : 'video-added', '#videos')
}

/** Moves a video one stage forward or back in the pipeline, guarded on its current stage. */
export async function moveVideoAction(formData: FormData): Promise<void> {
  const videoId = requireId(formData, 'videoId', HOME)
  const direction = field(formData, 'direction') === 'back' ? -1 : 1
  const { supabase, userId } = await pillarSession()
  const { data: video } = await supabase.from('videos').select('id,status,published_at').eq('id', videoId).eq('user_id', userId).maybeSingle()
  if (!video || !(VIDEO_STATUSES as readonly string[]).includes(video.status)) finish(HOME, 'record-not-found', '#videos')
  const next = adjacentStage(video.status as VideoStatus, direction)
  if (!next) finish(HOME, 'video-moved', '#videos')
  const { error } = await supabase.from('videos').update({ status: next, published_at: publishedAtFor(next, video.published_at, new Date()) }).eq('id', video.id).eq('user_id', userId).eq('status', video.status)
  finish(HOME, error ? 'save-failed' : 'video-moved', '#videos')
}

export async function updateVideoAction(formData: FormData): Promise<void> {
  const videoId = requireId(formData, 'videoId', HOME)
  const parsed = videoInputSchema.safeParse({ title: field(formData, 'title'), topic: field(formData, 'topic'), videoUrl: field(formData, 'videoUrl'), minutes: field(formData, 'minutes') })
  if (!parsed.success) finish(HOME, 'video-invalid', '#videos')
  const { supabase, userId } = await pillarSession()
  const { data, error } = await supabase.from('videos').update({ title: parsed.data.title, topic: parsed.data.topic, video_url: parsed.data.videoUrl, duration_seconds: parsed.data.minutes ? parsed.data.minutes * 60 : null }).eq('id', videoId).eq('user_id', userId).select('id').maybeSingle()
  finish(HOME, error ? 'save-failed' : data ? 'video-updated' : 'record-not-found', '#videos')
}

export async function deleteVideoAction(formData: FormData): Promise<void> {
  const videoId = requireId(formData, 'videoId', HOME)
  const { supabase, userId } = await pillarSession()
  const { data, error } = await supabase.from('videos').delete().eq('id', videoId).eq('user_id', userId).select('id').maybeSingle()
  finish(HOME, error ? 'save-failed' : data ? 'video-deleted' : 'record-not-found', '#videos')
}
