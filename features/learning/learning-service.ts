import type { createClient } from '@/lib/supabase/server'
import { addDateDays, getLocalDateKey, getWeekStart } from '@/features/habits/habit-domain'
import { RESTORE_WINDOW_DAYS, sumMinutesBetween, type SessionType } from './learning-domain'
import type { ResourceOption } from '@/features/resources/resource-service'

type Supabase = Awaited<ReturnType<typeof createClient>>

const DAY_MS = 24 * 60 * 60 * 1000
const SESSION_COLUMNS = 'id,quest_id,resource_id,topic,pillar,session_type,started_at,duration_minutes,notes'

export type SessionRow = {
  id: string
  quest_id: string | null
  resource_id: string | null
  topic: string | null
  pillar: string | null
  session_type: SessionType
  started_at: string
  duration_minutes: number
  notes: string | null
}

export type SessionView = SessionRow & { localDate: string; minutes: number; questTitle: string | null; resourceTitle?: string | null }
export type DeletedSession = SessionRow & { deleted_at: string; questTitle: string | null }
export type QuestOption = { id: string; title: string; status: string }

export type WeekWindow = { today: string; weekStart: string; weekEnd: string }

export function currentWeek(timeZone: string, now = new Date()): WeekWindow {
  const today = getLocalDateKey(now, timeZone)
  const weekStart = getWeekStart(today)
  return { today, weekStart, weekEnd: addDateDays(weekStart, 6) }
}

function toView(row: SessionRow, timeZone: string, questTitles: Map<string, string>): SessionView {
  return {
    ...row,
    localDate: getLocalDateKey(new Date(row.started_at), timeZone),
    minutes: row.duration_minutes,
    questTitle: row.quest_id ? questTitles.get(row.quest_id) ?? null : null,
  }
}

/**
 * Physically removes this user's soft-deleted sessions well past the restore window.
 * Logical expiry is enforced by the database trigger; this cleanup is conservative (31 days)
 * so it never removes a row the database would still let the user restore.
 */
async function cleanUpExpiredSessions(supabase: Supabase, userId: string) {
  const cutoff = new Date(Date.now() - (RESTORE_WINDOW_DAYS + 1) * DAY_MS).toISOString()
  await supabase.from('learning_sessions').delete().eq('user_id', userId).not('deleted_at', 'is', null).lt('deleted_at', cutoff)
}

export type LearningLogData = {
  sessions: SessionView[]
  deleted: DeletedSession[]
  quests: QuestOption[]
  resources: ResourceOption[]
  week: WeekWindow & { minutes: number; sessions: number; activeDays: number }
  hasLoadError: boolean
}

export async function getLearningLogData(supabase: Supabase, userId: string, timeZone: string): Promise<LearningLogData> {
  await cleanUpExpiredSessions(supabase, userId)
  const week = currentWeek(timeZone)
  const restoreSince = new Date(Date.now() - RESTORE_WINDOW_DAYS * DAY_MS).toISOString()

  const [sessionResult, deletedResult, questResult, resourceResult] = await Promise.all([
    supabase.from('active_learning_sessions').select(SESSION_COLUMNS).eq('user_id', userId)
      .order('started_at', { ascending: false }).limit(200),
    supabase.from('learning_sessions').select(`${SESSION_COLUMNS},deleted_at`).eq('user_id', userId)
      .not('deleted_at', 'is', null).gt('deleted_at', restoreSince).order('deleted_at', { ascending: false }).limit(50),
    supabase.from('side_quests').select('id,title,status').eq('user_id', userId).order('updated_at', { ascending: false }).limit(200),
    supabase.from('learning_resources').select('id,title,resource_type,status').eq('user_id', userId).order('created_at', { ascending: false }).limit(300),
  ])

  const allResources = (resourceResult.data ?? []) as ResourceOption[]
  const resourceTitles = new Map(allResources.map((r) => [r.id, r.title]))
  const quests = (questResult.data ?? []) as QuestOption[]
  const titles = new Map(quests.map((quest) => [quest.id, quest.title]))
  const sessions = ((sessionResult.data ?? []) as SessionRow[]).map((row) => ({
    ...toView(row, timeZone, titles),
    resourceTitle: row.resource_id ? resourceTitles.get(row.resource_id) ?? null : null,
  }))
  const deleted = ((deletedResult.data ?? []) as Array<SessionRow & { deleted_at: string }>).map((row) => ({
    ...row,
    questTitle: row.quest_id ? titles.get(row.quest_id) ?? null : null,
  }))
  const thisWeek = sessions.filter((s) => s.localDate >= week.weekStart && s.localDate <= week.weekEnd)

  return {
    sessions,
    deleted,
    quests: [...quests].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active')),
    resources: allResources.filter((r) => r.status !== 'archived'),
    week: {
      ...week,
      minutes: sumMinutesBetween(thisWeek, week.weekStart, week.weekEnd),
      sessions: thisWeek.length,
      activeDays: new Set(thisWeek.map((s) => s.localDate)).size,
    },
    hasLoadError: Boolean(sessionResult.error || deletedResult.error || questResult.error || resourceResult.error),
  }
}

export type QuestSessionSummary = {
  recent: SessionView[]
  minutesThisWeek: number
  minutesAllTime: number
  sessionCount: number
  week: WeekWindow
}

export async function getQuestSessionSummary(supabase: Supabase, userId: string, questId: string, questTitle: string, timeZone: string): Promise<QuestSessionSummary> {
  const week = currentWeek(timeZone)
  const { data } = await supabase.from('active_learning_sessions').select(SESSION_COLUMNS)
    .eq('user_id', userId).eq('quest_id', questId).order('started_at', { ascending: false }).limit(1000)
  const sessions = ((data ?? []) as SessionRow[]).map((row) => toView(row, timeZone, new Map([[questId, questTitle]])))
  return {
    recent: sessions.slice(0, 8),
    minutesThisWeek: sumMinutesBetween(sessions, week.weekStart, week.weekEnd),
    minutesAllTime: sessions.reduce((total, s) => total + s.minutes, 0),
    sessionCount: sessions.length,
    week,
  }
}

export async function getOwnedSession(supabase: Supabase, userId: string, sessionId: string) {
  const { data, error } = await supabase.from('learning_sessions').select(`${SESSION_COLUMNS},deleted_at`)
    .eq('id', sessionId).eq('user_id', userId).maybeSingle()
  if (error || !data) return null
  return data as SessionRow & { deleted_at: string | null }
}
