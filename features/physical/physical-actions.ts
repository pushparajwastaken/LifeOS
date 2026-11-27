'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getLocalDateKey } from '@/features/habits/habit-domain'
import { zonedLocalToUtcIso } from '@/features/learning/learning-domain'
import { uuidSchema } from '@/features/quests/quest-domain'
import { getPageSession } from '@/lib/page-session'
import { PHYSICAL_LIMITS, bodyInputSchema, measurementsFor, exerciseInputSchema, runInputSchema, setInputSchema, sleepInputSchema, workoutInputSchema } from './physical-domain'

const HOME = '/physical'

function text(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function finish(path: string, notice: string, anchor = ''): never {
  revalidatePath(HOME, 'layout')
  redirect(`${path}?notice=${notice}${anchor}`)
}

async function session() {
  const context = await getPageSession()
  return { ...context, today: getLocalDateKey(new Date(), context.timeZone) }
}

/** Local date and time in the profile timezone to an instant; never later than now. */
function instant(date: string, time: string, timeZone: string): string | null {
  const iso = zonedLocalToUtcIso(date, time, timeZone)
  return Date.parse(iso) > Date.now() + 60_000 ? null : iso
}

export async function logWorkoutAction(formData: FormData): Promise<void> {
  const parsed = workoutInputSchema.safeParse({ title: text(formData, 'title') || (formData.get('restDay') === 'on' ? 'Rest day' : ''), date: text(formData, 'date'), time: text(formData, 'time'), restDay: formData.get('restDay') === 'on', notes: text(formData, 'notes') })
  if (!parsed.success) finish(HOME, 'physical-invalid', '#log')
  const { supabase, userId, timeZone } = await session()
  const performedAt = instant(parsed.data.date, parsed.data.time, timeZone)
  if (!performedAt) finish(HOME, 'physical-future', '#log')
  const { data, error } = await supabase.from('workouts').insert({ user_id: userId, title: parsed.data.title, performed_at: performedAt, rest_day: parsed.data.restDay, notes: parsed.data.notes }).select('id').single()
  if (error || !data) finish(HOME, 'save-failed')
  if (parsed.data.restDay) finish(HOME, 'rest-day-logged')
  finish(`${HOME}/workouts/${data.id}`, 'workout-logged')
}

async function ownedWorkout(formData: FormData) {
  const workoutId = uuidSchema.safeParse(text(formData, 'workoutId'))
  if (!workoutId.success) finish(HOME, 'record-not-found')
  const context = await session()
  const { data } = await context.supabase.from('workouts').select('id').eq('id', workoutId.data).eq('user_id', context.userId).maybeSingle()
  if (!data) finish(HOME, 'record-not-found')
  return { ...context, workoutId: data.id as string, path: `${HOME}/workouts/${data.id}` }
}

export async function addExerciseAction(formData: FormData): Promise<void> {
  const { supabase, userId, workoutId, path } = await ownedWorkout(formData)
  const parsed = exerciseInputSchema.safeParse({ name: text(formData, 'name') })
  if (!parsed.success) finish(path, 'exercise-invalid')
  const { count } = await supabase.from('exercises').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('workout_id', workoutId)
  const { error } = await supabase.from('exercises').insert({ user_id: userId, workout_id: workoutId, name: parsed.data.name, order_index: count ?? 0 })
  finish(path, error ? 'save-failed' : 'exercise-added')
}

export async function deleteExerciseAction(formData: FormData): Promise<void> {
  const { supabase, userId, workoutId, path } = await ownedWorkout(formData)
  const exerciseId = uuidSchema.safeParse(text(formData, 'exerciseId'))
  if (!exerciseId.success) finish(path, 'record-not-found')
  const { data, error } = await supabase.from('exercises').delete().eq('id', exerciseId.data).eq('workout_id', workoutId).eq('user_id', userId).select('id').maybeSingle()
  finish(path, error ? 'save-failed' : data ? 'exercise-deleted' : 'record-not-found')
}

export async function addSetAction(formData: FormData): Promise<void> {
  const { supabase, userId, workoutId, path } = await ownedWorkout(formData)
  const exerciseId = uuidSchema.safeParse(text(formData, 'exerciseId'))
  if (!exerciseId.success) finish(path, 'record-not-found')
  const { data: exercise } = await supabase.from('exercises').select('id').eq('id', exerciseId.data).eq('workout_id', workoutId).eq('user_id', userId).maybeSingle()
  if (!exercise) finish(path, 'record-not-found')
  const parsed = setInputSchema.safeParse({ reps: text(formData, 'reps'), weight: text(formData, 'weight'), unit: text(formData, 'unit') || 'kg' })
  if (!parsed.success) finish(path, 'set-invalid')
  const { data: last } = await supabase.from('exercise_sets').select('set_number').eq('user_id', userId).eq('exercise_id', exercise.id).order('set_number', { ascending: false }).limit(1).maybeSingle()
  const next = ((last as { set_number: number } | null)?.set_number ?? 0) + 1
  if (next > PHYSICAL_LIMITS.maxSets) finish(path, 'set-limit')
  const { error } = await supabase.from('exercise_sets').insert({ user_id: userId, exercise_id: exercise.id, set_number: next, reps: parsed.data.reps, weight: parsed.data.weight, unit: parsed.data.unit })
  finish(path, error ? 'save-failed' : 'set-added')
}

export async function deleteSetAction(formData: FormData): Promise<void> {
  const { supabase, userId, workoutId, path } = await ownedWorkout(formData)
  const setId = uuidSchema.safeParse(text(formData, 'setId'))
  if (!setId.success) finish(path, 'record-not-found')
  // The set must belong to an exercise of this workout.
  const { data: set } = await supabase.from('exercise_sets').select('id,exercise_id').eq('id', setId.data).eq('user_id', userId).maybeSingle()
  const { data: exercise } = set ? await supabase.from('exercises').select('id').eq('id', set.exercise_id).eq('workout_id', workoutId).eq('user_id', userId).maybeSingle() : { data: null }
  if (!set || !exercise) finish(path, 'record-not-found')
  const { error } = await supabase.from('exercise_sets').delete().eq('id', set.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'set-deleted')
}

export async function logRunAction(formData: FormData): Promise<void> {
  const parsed = runInputSchema.safeParse({ date: text(formData, 'date'), time: text(formData, 'time'), distance: text(formData, 'distance'), unit: text(formData, 'unit') || 'km', duration: text(formData, 'duration'), notes: text(formData, 'notes') })
  if (!parsed.success) finish(HOME, 'run-invalid', '#log')
  const { supabase, userId, timeZone } = await session()
  const startedAt = instant(parsed.data.date, parsed.data.time, timeZone)
  if (!startedAt) finish(HOME, 'physical-future', '#log')
  const { error } = await supabase.from('running_sessions').insert({ user_id: userId, started_at: startedAt, distance: parsed.data.distance, distance_unit: parsed.data.unit, duration_seconds: parsed.data.duration, notes: parsed.data.notes })
  finish(HOME, error ? 'save-failed' : 'run-logged')
}

export async function logBodyAction(formData: FormData): Promise<void> {
  const parsed = bodyInputSchema.safeParse({ date: text(formData, 'date'), time: text(formData, 'time'), weight: text(formData, 'weight'), unit: text(formData, 'unit') || 'kg', waist: text(formData, 'waist'), chest: text(formData, 'chest'), hips: text(formData, 'hips'), body_fat: text(formData, 'body_fat'), notes: text(formData, 'notes') })
  if (!parsed.success) finish(HOME, 'body-invalid', '#log')
  const { supabase, userId, timeZone } = await session()
  const measuredAt = instant(parsed.data.date, parsed.data.time, timeZone)
  if (!measuredAt) finish(HOME, 'physical-future', '#log')
  const { error } = await supabase.from('body_metrics').insert({ user_id: userId, measured_at: measuredAt, weight: parsed.data.weight, weight_unit: parsed.data.unit, measurements: measurementsFor(parsed.data), notes: parsed.data.notes })
  finish(HOME, error ? 'save-failed' : 'body-logged')
}

/** One sleep entry per night: logging the same night again replaces it. */
export async function logSleepAction(formData: FormData): Promise<void> {
  const parsed = sleepInputSchema.safeParse({ date: text(formData, 'date'), hours: text(formData, 'hours'), minutes: text(formData, 'minutes'), recovery: text(formData, 'recovery'), notes: text(formData, 'notes') })
  if (!parsed.success) finish(HOME, 'sleep-invalid', '#log')
  const { supabase, userId, today } = await session()
  if (parsed.data.date > today) finish(HOME, 'physical-future', '#log')
  const { error } = await supabase.from('sleep_logs').upsert({ user_id: userId, sleep_date: parsed.data.date, duration_minutes: parsed.data.hours * 60 + parsed.data.minutes, recovery_score: parsed.data.recovery, notes: parsed.data.notes }, { onConflict: 'user_id,sleep_date' })
  finish(HOME, error ? 'save-failed' : 'sleep-logged')
}

const DELETABLE = { workout: 'workouts', run: 'running_sessions', body: 'body_metrics', sleep: 'sleep_logs' } as const

export async function deletePhysicalEntryAction(formData: FormData): Promise<void> {
  const kind = text(formData, 'kind') as keyof typeof DELETABLE
  const entryId = uuidSchema.safeParse(text(formData, 'entryId'))
  if (!Object.hasOwn(DELETABLE, kind) || !entryId.success) finish(HOME, 'record-not-found')
  const { supabase, userId } = await session()
  const { data, error } = await supabase.from(DELETABLE[kind]).delete().eq('id', entryId.data).eq('user_id', userId).select('id').maybeSingle()
  finish(HOME, error ? 'save-failed' : data ? 'physical-deleted' : 'record-not-found')
}
