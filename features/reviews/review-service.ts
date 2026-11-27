import type { createClient } from '@/lib/supabase/server'
import { zonedLocalToUtcIso } from '@/features/learning/learning-domain'
import { addDays } from '@/features/pillars/pillar-domain'
import { REVIEW_LIMITS } from './review-domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type WeeklyReviewRow = { id: string; week_start: string; wins: string | null; failures: string | null; blockers: string | null; next_priorities: string | null; updated_at: string }

/** The review for one week plus facts recorded elsewhere in LifeOS during that week (read-only context). */
export async function getWeeklyReviewData(supabase: Supabase, userId: string, weekStart: string, timeZone: string) {
  const weekEnd = addDays(weekStart, 7)
  const from = zonedLocalToUtcIso(weekStart, '00:00', timeZone)
  const to = zonedLocalToUtcIso(weekEnd, '00:00', timeZone)
  const [review, history, tasks, habitLogs, learning, workouts, reading, shipped, goalReadings] = await Promise.all([
    supabase.from('weekly_reviews').select('id,week_start,wins,failures,blockers,next_priorities,updated_at').eq('user_id', userId).eq('week_start', weekStart).maybeSingle(),
    supabase.from('weekly_reviews').select('id,week_start,wins,failures,blockers,next_priorities,updated_at').eq('user_id', userId).order('week_start', { ascending: false }).limit(REVIEW_LIMITS.history),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'done').gte('completed_at', from).lt('completed_at', to),
    supabase.from('habit_logs').select('status').eq('user_id', userId).gte('log_date', weekStart).lt('log_date', weekEnd).limit(2000),
    supabase.from('active_learning_sessions').select('duration_minutes').eq('user_id', userId).gte('started_at', from).lt('started_at', to).limit(2000),
    supabase.from('workouts').select('rest_day').eq('user_id', userId).gte('performed_at', from).lt('performed_at', to).limit(500),
    supabase.from('reading_sessions').select('pages_read').eq('user_id', userId).gte('session_date', weekStart).lt('session_date', weekEnd).limit(2000),
    supabase.from('shipping_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('shipped_at', from).lt('shipped_at', to),
    supabase.from('goal_progress_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('recorded_at', from).lt('recorded_at', to),
  ])
  const logs = (habitLogs.data ?? []) as Array<{ status: string }>
  return {
    review: (review.data as WeeklyReviewRow | null) ?? null,
    history: (history.data ?? []) as WeeklyReviewRow[],
    facts: {
      tasksDone: tasks.count ?? 0,
      habitCheckIns: logs.filter((log) => log.status === 'completed').length,
      learningMinutes: ((learning.data ?? []) as Array<{ duration_minutes: number }>).reduce((sum, row) => sum + row.duration_minutes, 0),
      workouts: ((workouts.data ?? []) as Array<{ rest_day: boolean }>).filter((row) => !row.rest_day).length,
      pagesRead: ((reading.data ?? []) as Array<{ pages_read: number }>).reduce((sum, row) => sum + row.pages_read, 0),
      shipped: shipped.count ?? 0,
      goalReadings: goalReadings.count ?? 0,
    },
    hasLoadError: [review, history, tasks, habitLogs, learning, workouts, reading, shipped, goalReadings].some((result) => Boolean(result.error)),
  }
}
