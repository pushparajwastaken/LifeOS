import type { createClient } from '@/lib/supabase/server'
import { addDays, countByWeek, localDateKey, sumByWeek, weekIndex, weekWindow } from '@/features/analytics/analytics-domain'
import { toKm, weightChange } from './physical-domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

export const PHYSICAL_WEEKS = 8
const ROW_CAP = 2000

export type WorkoutRow = { id: string; title: string; performed_at: string; rest_day: boolean; notes: string | null }
export type RunRow = { id: string; started_at: string; distance: number; distance_unit: 'km' | 'mi'; duration_seconds: number; notes: string | null }
export type BodyRow = { id: string; measured_at: string; weight: number | null; weight_unit: 'kg' | 'lb'; notes: string | null }
export type SleepRow = { id: string; sleep_date: string; duration_minutes: number; recovery_score: number | null; notes: string | null }

export type ActivityItem =
  | { kind: 'workout'; id: string; at: string; date: string; workout: WorkoutRow; exerciseCount: number }
  | { kind: 'run'; id: string; at: string; date: string; run: RunRow }
  | { kind: 'body'; id: string; at: string; date: string; body: BodyRow }
  | { kind: 'sleep'; id: string; at: string; date: string; sleep: SleepRow }

export type PhysicalData = {
  weeks: string[]
  series: { workouts: number[]; km: Array<number | null>; sleepHours: Array<number | null> }
  thisWeek: { workouts: number; restDays: number; km: number; runs: number; sleepAverage: number | null; sleepNights: number }
  latestWeight: { weight: number; unit: string; at: string } | null
  weightChange: ReturnType<typeof weightChange>
  activity: ActivityItem[]
  truncated: boolean
  hasLoadError: boolean
}

const num = (value: unknown) => Number(value)

export async function getPhysicalData(supabase: Supabase, userId: string, today: string, timeZone: string): Promise<PhysicalData> {
  const weeks = weekWindow(today, PHYSICAL_WEEKS)
  const since = `${addDays(weeks[0], -1)}T00:00:00Z`
  const [workoutResult, runResult, sleepResult, bodyResult] = await Promise.all([
    supabase.from('workouts').select('id,title,performed_at,rest_day,notes').eq('user_id', userId).gte('performed_at', since).order('performed_at', { ascending: false }).limit(ROW_CAP),
    supabase.from('running_sessions').select('id,started_at,distance,distance_unit,duration_seconds,notes').eq('user_id', userId).gte('started_at', since).order('started_at', { ascending: false }).limit(ROW_CAP),
    supabase.from('sleep_logs').select('id,sleep_date,duration_minutes,recovery_score,notes').eq('user_id', userId).gte('sleep_date', addDays(weeks[0], -1)).order('sleep_date', { ascending: false }).limit(ROW_CAP),
    supabase.from('body_metrics').select('id,measured_at,weight,weight_unit,notes').eq('user_id', userId).order('measured_at', { ascending: false }).limit(200),
  ])
  const workouts = (workoutResult.data ?? []) as WorkoutRow[]
  const runs = ((runResult.data ?? []) as RunRow[]).map((row) => ({ ...row, distance: num(row.distance) }))
  const sleeps = (sleepResult.data ?? []) as SleepRow[]
  const bodies = ((bodyResult.data ?? []) as BodyRow[]).map((row) => ({ ...row, weight: row.weight === null ? null : num(row.weight) }))
  const local = (iso: string) => localDateKey(iso, timeZone)

  const exerciseCounts = new Map<string, number>()
  const recentWorkoutIds = workouts.slice(0, 60).map((workout) => workout.id)
  let exerciseError = false
  if (recentWorkoutIds.length) {
    const { data, error } = await supabase.from('exercises').select('workout_id').eq('user_id', userId).in('workout_id', recentWorkoutIds).limit(5000)
    exerciseError = Boolean(error)
    for (const row of (data ?? []) as Array<{ workout_id: string }>) exerciseCounts.set(row.workout_id, (exerciseCounts.get(row.workout_id) ?? 0) + 1)
  }

  // Weekly series. Kilometres convert miles; sleep is the average hours of the nights logged that week (blank if none).
  const training = workouts.filter((workout) => !workout.rest_day)
  const kmSeries = sumByWeek(runs.map((run) => ({ date: local(run.started_at), value: toKm(run.distance, run.distance_unit) })), weeks, today)
  const sleepTotals = sumByWeek(sleeps.map((sleep) => ({ date: sleep.sleep_date, value: sleep.duration_minutes })), weeks, today)
  const sleepCounts = countByWeek(sleeps.map((sleep) => sleep.sleep_date), weeks, today)
  const current = weeks.length - 1
  const inThisWeek = (date: string) => weekIndex(date, weeks, today) === current

  const thisWeekSleeps = sleeps.filter((sleep) => inThisWeek(sleep.sleep_date))
  const thisWeekRuns = runs.filter((run) => inThisWeek(local(run.started_at)))
  const weighed = bodies.filter((body): body is BodyRow & { weight: number } => body.weight !== null)

  const twoWeeksAgo = addDays(today, -13)
  const activity: ActivityItem[] = [
    ...workouts.map((workout) => ({ kind: 'workout' as const, id: workout.id, at: workout.performed_at, date: local(workout.performed_at), workout, exerciseCount: exerciseCounts.get(workout.id) ?? 0 })),
    ...runs.map((run) => ({ kind: 'run' as const, id: run.id, at: run.started_at, date: local(run.started_at), run })),
    ...bodies.map((body) => ({ kind: 'body' as const, id: body.id, at: body.measured_at, date: local(body.measured_at), body })),
    ...sleeps.map((sleep) => ({ kind: 'sleep' as const, id: sleep.id, at: `${sleep.sleep_date}T23:59:59Z`, date: sleep.sleep_date, sleep })),
  ].filter((item) => item.date >= twoWeeksAgo).sort((a, b) => (a.date === b.date ? Date.parse(b.at) - Date.parse(a.at) : b.date.localeCompare(a.date)))

  return {
    weeks,
    series: {
      workouts: countByWeek(training.map((workout) => local(workout.performed_at)), weeks, today),
      km: kmSeries.map((value) => (value ? Math.round(value * 10) / 10 : 0)),
      sleepHours: sleepTotals.map((total, index) => (sleepCounts[index] ? Math.round((total / sleepCounts[index] / 60) * 10) / 10 : null)),
    },
    thisWeek: {
      workouts: training.filter((workout) => inThisWeek(local(workout.performed_at))).length,
      restDays: workouts.filter((workout) => workout.rest_day && inThisWeek(local(workout.performed_at))).length,
      km: Math.round(thisWeekRuns.reduce((sum, run) => sum + toKm(run.distance, run.distance_unit), 0) * 10) / 10,
      runs: thisWeekRuns.length,
      sleepAverage: thisWeekSleeps.length ? Math.round((thisWeekSleeps.reduce((sum, sleep) => sum + sleep.duration_minutes, 0) / thisWeekSleeps.length / 60) * 10) / 10 : null,
      sleepNights: thisWeekSleeps.length,
    },
    latestWeight: weighed[0] ? { weight: weighed[0].weight, unit: weighed[0].weight_unit, at: weighed[0].measured_at } : null,
    weightChange: weightChange(weighed.map((body) => ({ measuredAt: body.measured_at, weight: body.weight, unit: body.weight_unit }))),
    activity,
    truncated: [workouts, runs, sleeps].some((rows) => rows.length >= ROW_CAP),
    hasLoadError: Boolean(workoutResult.error || runResult.error || sleepResult.error || bodyResult.error || exerciseError),
  }
}

export type ExerciseView = { id: string; name: string; order_index: number; sets: Array<{ id: string; set_number: number; reps: number | null; weight: number | null; unit: string }> }

export async function getWorkoutDetail(supabase: Supabase, userId: string, workoutId: string) {
  const { data: workout, error } = await supabase.from('workouts').select('id,title,performed_at,rest_day,notes').eq('id', workoutId).eq('user_id', userId).maybeSingle()
  if (error || !workout) return null
  const { data: exercises, error: exerciseError } = await supabase.from('exercises').select('id,name,order_index').eq('user_id', userId).eq('workout_id', workoutId).order('order_index', { ascending: true }).order('created_at', { ascending: true }).limit(100)
  const ids = ((exercises ?? []) as Array<{ id: string }>).map((exercise) => exercise.id)
  const { data: sets, error: setError } = ids.length
    ? await supabase.from('exercise_sets').select('id,exercise_id,set_number,reps,weight,unit').eq('user_id', userId).in('exercise_id', ids).order('set_number', { ascending: true }).limit(2000)
    : { data: [], error: null }
  const setRows = (sets ?? []) as Array<{ id: string; exercise_id: string; set_number: number; reps: number | null; weight: number | null; unit: string }>
  return {
    workout: workout as WorkoutRow,
    exercises: ((exercises ?? []) as Array<{ id: string; name: string; order_index: number }>).map((exercise) => ({
      ...exercise,
      sets: setRows.filter((set) => set.exercise_id === exercise.id).map((set) => ({ ...set, weight: set.weight === null ? null : num(set.weight) })),
    })) as ExerciseView[],
    hasLoadError: Boolean(exerciseError || setError),
  }
}
