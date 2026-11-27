import type { createClient } from '@/lib/supabase/server'
import { localDateKey, sumByWeek, weekWindow } from '@/features/analytics/analytics-domain'
import { weekStartOf } from '@/features/pillars/pillar-domain'
import { averageRating, type PracticeType, type VideoStatus } from './communication-domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type SpeakingRow = { id: string; practiced_at: string; duration_minutes: number; practice_type: PracticeType; recording_url: string | null; self_evaluation: number | null; feedback: string | null }
export type VideoRow = { id: string; title: string; topic: string | null; video_url: string | null; duration_seconds: number | null; published_at: string | null; status: VideoStatus; created_at: string }

export async function getCommunicationData(supabase: Supabase, userId: string, today: string, timeZone: string) {
  const weeks = weekWindow(today, 8)
  const since = new Date(Date.parse(`${weeks[0]}T00:00:00Z`) - 86_400_000).toISOString()
  const [speakingResult, videoResult] = await Promise.all([
    supabase.from('speaking_sessions').select('id,practiced_at,duration_minutes,practice_type,recording_url,self_evaluation,feedback').eq('user_id', userId).gte('practiced_at', since).order('practiced_at', { ascending: false }).limit(2000),
    supabase.from('videos').select('id,title,topic,video_url,duration_seconds,published_at,status,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
  ])
  const sessions = (speakingResult.data ?? []) as SpeakingRow[]
  const local = (iso: string) => localDateKey(iso, timeZone)
  const monday = weekStartOf(today)
  const thisWeek = sessions.filter((session) => { const day = local(session.practiced_at); return day >= monday && day <= today })
  const recentFour = sessions.filter((session) => local(session.practiced_at) >= weeks[weeks.length - 4])
  return {
    weeks,
    minutesSeries: sumByWeek(sessions.map((session) => ({ date: local(session.practiced_at), value: session.duration_minutes })), weeks, today),
    sessions: sessions.slice(0, 30),
    thisWeek: { minutes: thisWeek.reduce((sum, session) => sum + session.duration_minutes, 0), count: thisWeek.length },
    ratingFourWeeks: averageRating(recentFour),
    videos: (videoResult.data ?? []) as VideoRow[],
    hasLoadError: Boolean(speakingResult.error || videoResult.error),
  }
}
