import type { createClient } from '@/lib/supabase/server'
import { GOAL_LIMITS, goalProgress, type GoalProgress, type GoalStatus } from './goal-domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type GoalRow = {
  id: string
  title: string
  description: string | null
  pillar: string
  period: string
  starts_on: string
  ends_on: string
  target_value: number | null
  unit: string | null
  status: GoalStatus
  created_at: string
}

export type MilestoneRow = { id: string; goal_id: string; title: string; due_on: string | null; completed_at: string | null; created_at: string }
export type ProgressRow = { id: string; goal_id: string; recorded_at: string; value: number; note: string | null }

export type GoalSummary = GoalRow & { progress: GoalProgress; latest: ProgressRow | null; milestoneCount: number }
export type GoalsFilter = GoalStatus | 'all'

const GOAL_SELECT = 'id,title,description,pillar,period,starts_on,ends_on,target_value,unit,status,created_at'

const toNumber = (value: unknown) => (value === null || value === undefined ? null : Number(value))
const normalizeGoal = (row: GoalRow): GoalRow => ({ ...row, target_value: toNumber(row.target_value) })
const normalizeProgress = (row: ProgressRow): ProgressRow => ({ ...row, value: Number(row.value) })

export function parseGoalsFilter(value: string | undefined): GoalsFilter {
  return value === 'paused' || value === 'completed' || value === 'abandoned' || value === 'all' ? value : 'active'
}

export async function getGoalsList(supabase: Supabase, userId: string, filter: GoalsFilter) {
  let query = supabase.from('goals').select(GOAL_SELECT).eq('user_id', userId)
  if (filter !== 'all') query = query.eq('status', filter)
  const [goalsResult, countsResult] = await Promise.all([
    query.order('ends_on', { ascending: true }).order('created_at', { ascending: false }).limit(GOAL_LIMITS.listCap),
    supabase.from('goals').select('status').eq('user_id', userId).limit(1000),
  ])
  const goals = ((goalsResult.data ?? []) as GoalRow[]).map(normalizeGoal)
  const ids = goals.map((goal) => goal.id)
  const [progressResult, milestoneResult] = ids.length
    ? await Promise.all([
        supabase.from('goal_progress_entries').select('id,goal_id,recorded_at,value,note').eq('user_id', userId).in('goal_id', ids).order('recorded_at', { ascending: false }).limit(5000),
        supabase.from('goal_milestones').select('id,goal_id,completed_at').eq('user_id', userId).in('goal_id', ids).limit(5000),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]
  const latestByGoal = new Map<string, ProgressRow>()
  for (const row of ((progressResult.data ?? []) as ProgressRow[]).map(normalizeProgress)) if (!latestByGoal.has(row.goal_id)) latestByGoal.set(row.goal_id, row)
  const milestonesByGoal = new Map<string, Array<{ completed_at: string | null }>>()
  for (const row of (milestoneResult.data ?? []) as Array<{ goal_id: string; completed_at: string | null }>) {
    const list = milestonesByGoal.get(row.goal_id) ?? []
    list.push(row)
    milestonesByGoal.set(row.goal_id, list)
  }
  const counts: Record<GoalStatus, number> = { active: 0, paused: 0, completed: 0, abandoned: 0 }
  for (const row of (countsResult.data ?? []) as Array<{ status: GoalStatus }>) counts[row.status] = (counts[row.status] ?? 0) + 1
  const summaries: GoalSummary[] = goals.map((goal) => {
    const latest = latestByGoal.get(goal.id) ?? null
    const milestones = milestonesByGoal.get(goal.id) ?? []
    return { ...goal, latest, milestoneCount: milestones.length, progress: goalProgress(goal, latest?.value ?? null, milestones) }
  })
  return {
    goals: summaries,
    counts,
    truncated: goals.length >= GOAL_LIMITS.listCap,
    hasLoadError: Boolean(goalsResult.error || countsResult.error || progressResult.error || milestoneResult.error),
  }
}

export async function getOwnedGoal(supabase: Supabase, userId: string, goalId: string): Promise<GoalRow | null> {
  const { data, error } = await supabase.from('goals').select(GOAL_SELECT).eq('id', goalId).eq('user_id', userId).maybeSingle()
  return error || !data ? null : normalizeGoal(data as GoalRow)
}

export async function getGoalDetail(supabase: Supabase, userId: string, goalId: string) {
  const goal = await getOwnedGoal(supabase, userId, goalId)
  if (!goal) return null
  const [progressResult, milestoneResult] = await Promise.all([
    supabase.from('goal_progress_entries').select('id,goal_id,recorded_at,value,note').eq('user_id', userId).eq('goal_id', goalId).order('recorded_at', { ascending: false }).limit(500),
    supabase.from('goal_milestones').select('id,goal_id,title,due_on,completed_at,created_at').eq('user_id', userId).eq('goal_id', goalId).order('due_on', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }).limit(200),
  ])
  const entries = ((progressResult.data ?? []) as ProgressRow[]).map(normalizeProgress)
  const milestones = (milestoneResult.data ?? []) as MilestoneRow[]
  return {
    goal,
    entries,
    milestones,
    progress: goalProgress(goal, entries[0]?.value ?? null, milestones),
    hasLoadError: Boolean(progressResult.error || milestoneResult.error),
  }
}
