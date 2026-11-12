import type { createClient } from '@/lib/supabase/server'
import { getLocalDateKey, isHabitScheduledOnDate, normalizeHabitSchedule, normalizeTimeZone, type HabitCadence, type HabitSchedule, type HabitTrackingType } from '@/features/habits/habit-domain'

export { getLocalDateKey, normalizeTimeZone } from '@/features/habits/habit-domain'

type DashboardSupabaseClient = Awaited<ReturnType<typeof createClient>>

export const DASHBOARD_PILLAR_IDS = [
  'physical',
  'intellectual',
  'academic',
  'professional',
  'communication',
] as const

export const DASHBOARD_PILLARS = [
  { id: 'physical', label: 'Physical' },
  { id: 'intellectual', label: 'Intellectual' },
  { id: 'academic', label: 'Academic' },
  { id: 'professional', label: 'Professional' },
  { id: 'communication', label: 'Communication' },
] as const

export type DashboardPillarId = (typeof DASHBOARD_PILLAR_IDS)[number]

export type DashboardTask = {
  id: string
  title: string
  status: string
  priority: string
  pillar: string | null
  due_at: string | null
  estimated_minutes: number | null
  created_at: string
}

export type DashboardHabit = {
  id: string
  name: string
  pillar: string
  cadence_type: HabitCadence
  tracking_type: HabitTrackingType
  target_value: number | null
  unit: string | null
  schedule: HabitSchedule
  created_at: string
}

export type DashboardHabitLog = {
  id: string
  habit_id: string
  status: string
  value: number | null
  duration_seconds: number | null
}

export type DashboardGoal = {
  id: string
  title: string
  pillar: string
  ends_on: string
  target_value: number | null
  unit: string | null
}

export type DashboardData = {
  profileName: string | null
  timeZone: string
  today: string
  dateLabel: string
  tasks: DashboardTask[]
  habits: DashboardHabit[]
  todayHabits: DashboardHabit[]
  habitLogs: DashboardHabitLog[]
  goals: DashboardGoal[]
  hasLoadError: boolean
}

type ProfileRow = {
  display_name: string | null
  timezone: string | null
}

type TaskRow = DashboardTask
type HabitRow = Omit<DashboardHabit, 'schedule' | 'cadence_type'> & { cadence_type: string; schedule: unknown; created_at: string }
type HabitLogRow = DashboardHabitLog & { created_at: string }
type GoalRow = DashboardGoal & { created_at: string }

export function getDurationUnit(unit: string | null | undefined) {
  const normalized = unit?.trim().toLowerCase()
  if (['hour', 'hours', 'hr', 'hrs', 'h'].includes(normalized ?? '')) {
    return { label: unit?.trim() || 'hours', secondsPerUnit: 3600, maxPerDay: 24, step: 0.25 }
  }
  if (['second', 'seconds', 'sec', 'secs', 's'].includes(normalized ?? '')) {
    return { label: unit?.trim() || 'seconds', secondsPerUnit: 1, maxPerDay: 86400, step: 1 }
  }
  return { label: unit?.trim() || 'minutes', secondsPerUnit: 60, maxPerDay: 1440, step: 1 }
}

export function formatPillarLabel(value: string | null | undefined): string {
  if (!value) return 'Unassigned'

  const normalized = value.trim().toLowerCase().replaceAll('_', ' ')
  const pillar = DASHBOARD_PILLARS.find(({ id }) => id === normalized)
  if (pillar) return pillar.label

  return normalized.replace(/\b\w/g, (character) => character.toUpperCase())
}

function isClosedTask(status: string): boolean {
  return ['completed', 'complete', 'done', 'archived', 'cancelled', 'canceled'].includes(
    status.trim().toLowerCase(),
  )
}

function taskSortValue(task: TaskRow): number {
  if (!task.due_at) return Number.POSITIVE_INFINITY
  const timestamp = Date.parse(task.due_at)
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY
}

export async function getDashboardData(
  supabase: DashboardSupabaseClient,
  userId: string,
): Promise<DashboardData> {
  const now = new Date()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('display_name,timezone')
    .eq('id', userId)
    .maybeSingle()

  const profileRow = profile as ProfileRow | null
  const timeZone = normalizeTimeZone(profileRow?.timezone)
  const today = getLocalDateKey(now, timeZone)
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now)

  const [taskResult, habitResult, goalResult] = await Promise.all([
    supabase
      .from('tasks')
      .select('id,title,status,priority,pillar,due_at,estimated_minutes,created_at')
      .eq('user_id', userId)
      .neq('status', 'completed')
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('habits')
      .select('id,name,pillar,cadence_type,tracking_type,target_value,unit,schedule,created_at')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(200),
    supabase
      .from('goals')
      .select('id,title,pillar,ends_on,target_value,unit,created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('ends_on', { ascending: true })
      .limit(8),
  ])

  const taskRows = (taskResult.data ?? []) as TaskRow[]
  const tasks = taskRows
    .filter((task) => !isClosedTask(task.status))
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
      const priorityDifference =
        (priorityOrder[a.priority.toLowerCase()] ?? 3) -
        (priorityOrder[b.priority.toLowerCase()] ?? 3)
      if (priorityDifference !== 0) return priorityDifference

      const dueDifference = taskSortValue(a) - taskSortValue(b)
      if (dueDifference !== 0) return dueDifference
      return Date.parse(b.created_at) - Date.parse(a.created_at)
    })
    .slice(0, 20)

  const habitRows = (habitResult.data ?? []) as unknown as HabitRow[]
  const habits: DashboardHabit[] = habitRows.map((row) => ({
    id: row.id,
    name: row.name,
    pillar: row.pillar,
    cadence_type: ['daily', 'weekly', 'custom'].includes(row.cadence_type) ? row.cadence_type as HabitCadence : 'custom',
    tracking_type: ['boolean', 'numeric', 'duration'].includes(row.tracking_type) ? row.tracking_type as HabitTrackingType : 'boolean',
    target_value: row.target_value === null ? null : Number(row.target_value),
    unit: row.unit,
    schedule: normalizeHabitSchedule(row.schedule, row.cadence_type, row.created_at, timeZone),
    created_at: row.created_at,
  }))
  const todayHabits = habits.filter((habit) => isHabitScheduledOnDate(habit, today))
  const goalRows = (goalResult.data ?? []) as GoalRow[]
  const goals = goalRows.map(({ id, title, pillar, ends_on, target_value, unit }) => ({
    id,
    title,
    pillar,
    ends_on,
    target_value,
    unit,
  }))

  let habitLogs: DashboardHabitLog[] = []
  let habitLogError = false

  if (todayHabits.length > 0) {
    const { data, error } = await supabase
      .from('habit_logs')
      .select('id,habit_id,status,value,duration_seconds,created_at')
      .eq('user_id', userId)
      .eq('log_date', today)
      .in('habit_id', todayHabits.map(({ id }) => id))
      .order('created_at', { ascending: false })

    habitLogError = Boolean(error)
    habitLogs = ((data ?? []) as HabitLogRow[]).map(({ id, habit_id, status, value, duration_seconds }) => ({
      id,
      habit_id,
      status,
      value,
      duration_seconds,
    }))
  }

  return {
    profileName: profileRow?.display_name?.trim() || null,
    timeZone,
    today,
    dateLabel,
    tasks,
    habits,
    todayHabits,
    habitLogs,
    goals,
    hasLoadError: Boolean(
      profileError || taskResult.error || habitResult.error || goalResult.error || habitLogError,
    ),
  }
}
