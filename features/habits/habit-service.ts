import type { createClient } from '@/lib/supabase/server'
import {
  getLocalDateKey,
  normalizeHabitSchedule,
  normalizeTimeZone,
  type Habit,
  type HabitLog,
} from './habit-domain'

type HabitSupabaseClient = Awaited<ReturnType<typeof createClient>>

type HabitRow = Omit<Habit, 'schedule' | 'cadence_type' | 'tracking_type'> & {
  schedule: unknown
  cadence_type: string
  tracking_type: string
}

type HabitLogRow = Omit<HabitLog, 'status'> & { status: string }

type ProfileRow = {
  display_name: string | null
  timezone: string | null
}

export type HabitManagementData = {
  habits: Habit[]
  logs: HabitLog[]
  relatedHabits: Array<{ id: string; name: string; active: boolean }>
  profileName: string | null
  timeZone: string
  today: string
  hasLoadError: boolean
  historyComplete: boolean
}

const PAGE_SIZE = 1000
const HISTORY_PAGE_LIMIT = 100
const HABIT_SELECT = 'id,name,description,pillar,cadence_type,schedule,tracking_type,target_value,unit,active,created_at,updated_at'
const LOG_SELECT = 'id,habit_id,log_date,status,value,duration_seconds,skipped_reason,note,created_at,updated_at'

function mapHabit(row: HabitRow, timeZone: string): Habit {
  return {
    ...row,
    cadence_type: ['daily', 'weekly', 'custom'].includes(row.cadence_type)
      ? row.cadence_type as Habit['cadence_type']
      : 'custom',
    tracking_type: ['boolean', 'numeric', 'duration'].includes(row.tracking_type)
      ? row.tracking_type as Habit['tracking_type']
      : 'boolean',
    target_value: row.target_value === null ? null : Number(row.target_value),
    schedule: normalizeHabitSchedule(row.schedule, row.cadence_type, row.created_at, timeZone),
  }
}

function mapLog(row: HabitLogRow): HabitLog {
  return {
    ...row,
    status: ['completed', 'partial', 'skipped', 'rest'].includes(row.status)
      ? row.status as HabitLog['status']
      : 'partial',
    value: row.value === null ? null : Number(row.value),
  }
}

async function loadAllHabits(supabase: HabitSupabaseClient, userId: string) {
  const habits: HabitRow[] = []
  for (let offset = 0; offset < PAGE_SIZE * HISTORY_PAGE_LIMIT; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('habits')
      .select(HABIT_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) return { habits, hasError: true, complete: true }
    const page = (data ?? []) as unknown as HabitRow[]
    habits.push(...page)
    if (page.length < PAGE_SIZE) return { habits, hasError: false, complete: true }
  }
  return { habits, hasError: false, complete: false }
}

async function loadLogsForHabits(
  supabase: HabitSupabaseClient,
  userId: string,
  habitIds: string[],
) {
  const logs: HabitLogRow[] = []
  if (habitIds.length === 0) return { logs, hasError: false, complete: true }

  for (let offset = 0; offset < PAGE_SIZE * HISTORY_PAGE_LIMIT; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('habit_logs')
      .select(LOG_SELECT)
      .eq('user_id', userId)
      .in('habit_id', habitIds)
      .order('log_date', { ascending: true })
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) return { logs, hasError: true, complete: true }
    const page = (data ?? []) as unknown as HabitLogRow[]
    logs.push(...page)
    if (page.length < PAGE_SIZE) return { logs, hasError: false, complete: true }
  }
  return { logs, hasError: false, complete: false }
}

async function getProfile(supabase: HabitSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name,timezone')
    .eq('id', userId)
    .maybeSingle()
  return { profile: data as ProfileRow | null, hasError: Boolean(error) }
}

export async function getHabitManagementData(
  supabase: HabitSupabaseClient,
  userId: string,
): Promise<HabitManagementData> {
  const [profileResult, habitsResult] = await Promise.all([
    getProfile(supabase, userId),
    loadAllHabits(supabase, userId),
  ])
  const timeZone = normalizeTimeZone(profileResult.profile?.timezone)
  const today = getLocalDateKey(new Date(), timeZone)
  const habits = habitsResult.habits.map((row) => mapHabit(row, timeZone))
  const logsResult = await loadLogsForHabits(supabase, userId, habits.map(({ id }) => id))

  return {
    habits,
    logs: logsResult.logs.map(mapLog),
    relatedHabits: habits.map(({ id, name, active }) => ({ id, name, active })),
    profileName: profileResult.profile?.display_name?.trim() || null,
    timeZone,
    today,
    hasLoadError: profileResult.hasError || habitsResult.hasError || logsResult.hasError,
    historyComplete: habitsResult.complete && logsResult.complete,
  }
}

export async function getHabitDetailData(
  supabase: HabitSupabaseClient,
  userId: string,
  habitId: string,
): Promise<{ data: HabitManagementData; habit: Habit } | null> {
  const [profileResult, habitResult, relatedResult] = await Promise.all([
    getProfile(supabase, userId),
    supabase
      .from('habits')
      .select(HABIT_SELECT)
      .eq('id', habitId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('habits')
      .select(HABIT_SELECT)
      .eq('user_id', userId)
      .neq('id', habitId)
      .order('name', { ascending: true })
      .limit(250),
  ])
  if (habitResult.error || !habitResult.data) return null

  const timeZone = normalizeTimeZone(profileResult.profile?.timezone)
  const today = getLocalDateKey(new Date(), timeZone)
  const habit = mapHabit(habitResult.data as unknown as HabitRow, timeZone)
  const relatedRows = (relatedResult.data ?? []) as unknown as HabitRow[]
  const relatedRecords = relatedRows.map((row) => mapHabit(row, timeZone))
  const relatedHabits = relatedRecords.map(({ id, name, active }) => ({ id, name, active }))
  const relatedIds = habit.schedule.behavior.relatedHabitIds.filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
  const logsResult = await loadLogsForHabits(supabase, userId, [habit.id, ...relatedIds])

  return {
    habit,
    data: {
      habits: [habit, ...relatedRecords],
      logs: logsResult.logs.map(mapLog),
      relatedHabits,
      profileName: profileResult.profile?.display_name?.trim() || null,
      timeZone,
      today,
      hasLoadError: profileResult.hasError || Boolean(relatedResult.error) || logsResult.hasError,
      historyComplete: logsResult.complete && relatedRecords.length < 250,
    },
  }
}
