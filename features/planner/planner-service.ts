import type { createClient } from '@/lib/supabase/server'
import { isHabitScheduledOnDate, normalizeHabitSchedule, type HabitCadence } from '@/features/habits/habit-domain'
import { utcToZonedParts, zonedLocalToUtcIso } from '@/features/learning/learning-domain'
import { PLANNER_LIMITS, addDays } from './planner-domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type PlannerTask = {
  id: string
  title: string
  status: string
  priority: string
  pillar: string | null
  dueAt: string | null
  dueTime: string | null
  estimatedMinutes: number | null
  completedAt: string | null
}

export type PlannerHabit = { id: string; name: string; pillar: string; status: string | null }
export type PlannerSession = { id: string; label: string; minutes: number; startedAt: string }
export type PlannerQuestTarget = { id: string; title: string; minutes: number; target: number }
export type DailyReview = { accomplished: string | null; learned: string | null; improve: string | null; gratitude: string | null; tomorrow: string | null }

export type PlannerData = {
  date: string
  planned: PlannerTask[]
  overdue: PlannerTask[]
  backlog: PlannerTask[]
  backlogTotal: number
  completed: PlannerTask[]
  habits: PlannerHabit[]
  sessions: PlannerSession[]
  questTargets: PlannerQuestTarget[]
  review: DailyReview | null
  previousIntention: string | null
  hasLoadError: boolean
}

type TaskRow = { id: string; title: string; status: string; priority: string; pillar: string | null; due_at: string | null; estimated_minutes: number | null; completed_at: string | null }
const TASK_SELECT = 'id,title,status,priority,pillar,due_at,estimated_minutes,completed_at'
const PRIORITY: Record<string, number> = { high: 0, medium: 1, low: 2 }

function toTask(row: TaskRow, timeZone: string): PlannerTask {
  return {
    id: row.id, title: row.title, status: row.status, priority: row.priority, pillar: row.pillar, dueAt: row.due_at,
    dueTime: row.due_at ? utcToZonedParts(row.due_at, timeZone).time : null, estimatedMinutes: row.estimated_minutes, completedAt: row.completed_at,
  }
}

const byPriorityThenDue = (a: PlannerTask, b: PlannerTask) => (PRIORITY[a.priority] ?? 3) - (PRIORITY[b.priority] ?? 3) || (a.dueAt && b.dueAt ? Date.parse(a.dueAt) - Date.parse(b.dueAt) : 0)

/** Monday of the week containing `dateKey`. */
function weekStart(dateKey: string): string {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay()
  return addDays(dateKey, -((day + 6) % 7))
}

export async function getPlannerData(supabase: Supabase, userId: string, date: string, today: string, timeZone: string): Promise<PlannerData> {
  const dayStart = zonedLocalToUtcIso(date, '00:00', timeZone)
  const dayEnd = zonedLocalToUtcIso(addDays(date, 1), '00:00', timeZone)
  const monday = weekStart(date)
  const weekStartIso = zonedLocalToUtcIso(monday, '00:00', timeZone)
  const weekEndIso = zonedLocalToUtcIso(addDays(monday, 7), '00:00', timeZone)
  const isToday = date === today

  const [plannedResult, overdueResult, backlogResult, completedResult, habitResult, logResult, sessionResult, questResult, reviewResult, previousResult] = await Promise.all([
    supabase.from('tasks').select(TASK_SELECT).eq('user_id', userId).in('status', ['todo', 'in_progress']).gte('due_at', dayStart).lt('due_at', dayEnd).limit(100),
    isToday
      ? supabase.from('tasks').select(TASK_SELECT).eq('user_id', userId).in('status', ['todo', 'in_progress']).lt('due_at', dayStart).order('due_at', { ascending: true }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('tasks').select(TASK_SELECT, { count: 'exact' }).eq('user_id', userId).in('status', ['todo', 'in_progress']).is('due_at', null).order('created_at', { ascending: false }).limit(PLANNER_LIMITS.backlog),
    supabase.from('tasks').select(TASK_SELECT).eq('user_id', userId).eq('status', 'done').gte('completed_at', dayStart).lt('completed_at', dayEnd).order('completed_at', { ascending: true }).limit(100),
    supabase.from('habits').select('id,name,pillar,cadence_type,schedule,created_at').eq('user_id', userId).eq('active', true).limit(200),
    supabase.from('habit_logs').select('habit_id,status').eq('user_id', userId).eq('log_date', date).limit(500),
    supabase.from('active_learning_sessions').select('id,topic,quest_id,started_at,duration_minutes').eq('user_id', userId).gte('started_at', weekStartIso).lt('started_at', weekEndIso).order('started_at', { ascending: true }).limit(500),
    supabase.from('side_quests').select('id,title,status,weekly_target_minutes').eq('user_id', userId).limit(500),
    supabase.from('daily_reviews').select('accomplished,learned,improve,gratitude,tomorrow').eq('user_id', userId).eq('review_date', date).maybeSingle(),
    supabase.from('daily_reviews').select('tomorrow').eq('user_id', userId).eq('review_date', addDays(date, -1)).maybeSingle(),
  ])

  const habitRows = (habitResult.data ?? []) as Array<{ id: string; name: string; pillar: string; cadence_type: string; schedule: unknown; created_at: string }>
  const statusByHabit = new Map(((logResult.data ?? []) as Array<{ habit_id: string; status: string }>).map((log) => [log.habit_id, log.status]))
  const habits = habitRows
    .map((row) => ({ row, schedule: normalizeHabitSchedule(row.schedule, row.cadence_type, row.created_at, timeZone) }))
    .filter(({ row, schedule }) => isHabitScheduledOnDate({ schedule, cadence_type: row.cadence_type as HabitCadence, created_at: row.created_at }, date) && !(schedule.archivedAt && schedule.archivedAt <= date))
    .map(({ row }) => ({ id: row.id, name: row.name, pillar: row.pillar, status: statusByHabit.get(row.id) ?? null }))

  // Titles for every quest (sessions keep their quest's name whatever its status); targets only for active quests.
  const questRows = (questResult.data ?? []) as Array<{ id: string; title: string; status: string; weekly_target_minutes: number | null }>
  const questTitle = new Map(questRows.map((quest) => [quest.id, quest.title]))
  const weekSessions = (sessionResult.data ?? []) as Array<{ id: string; topic: string | null; quest_id: string | null; started_at: string; duration_minutes: number }>
  const sessions = weekSessions
    .filter((row) => Date.parse(row.started_at) >= Date.parse(dayStart) && Date.parse(row.started_at) < Date.parse(dayEnd))
    .map((row) => ({ id: row.id, label: row.topic || (row.quest_id ? questTitle.get(row.quest_id) : null) || 'Learning session', minutes: row.duration_minutes, startedAt: row.started_at }))
  const questTargets = questRows.filter((quest) => quest.status === 'active' && quest.weekly_target_minutes).map((quest) => ({
    id: quest.id,
    title: quest.title,
    target: quest.weekly_target_minutes ?? 0,
    minutes: weekSessions.filter((row) => row.quest_id === quest.id).reduce((sum, row) => sum + row.duration_minutes, 0),
  }))

  return {
    date,
    planned: ((plannedResult.data ?? []) as TaskRow[]).map((row) => toTask(row, timeZone)).sort(byPriorityThenDue),
    overdue: ((overdueResult.data ?? []) as TaskRow[]).map((row) => toTask(row, timeZone)),
    backlog: ((backlogResult.data ?? []) as TaskRow[]).map((row) => toTask(row, timeZone)).sort(byPriorityThenDue),
    backlogTotal: backlogResult.count ?? 0,
    completed: ((completedResult.data ?? []) as TaskRow[]).map((row) => toTask(row, timeZone)),
    habits,
    sessions,
    questTargets,
    review: (reviewResult.data as DailyReview | null) ?? null,
    previousIntention: (previousResult.data as { tomorrow: string | null } | null)?.tomorrow ?? null,
    hasLoadError: [plannedResult, overdueResult, backlogResult, completedResult, habitResult, logResult, sessionResult, questResult, reviewResult, previousResult].some((result) => Boolean(result.error)),
  }
}
