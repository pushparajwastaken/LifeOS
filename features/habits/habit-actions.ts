'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  FAILURE_REASONS,
  HABIT_PILLARS,
  getLocalDateKey,
  isDateKey,
  getWeekdayIndex,
  normalizeHabitSchedule,
  normalizeTimeZone,
  serializeHabitReflection,
  type BehaviorDesign,
  type Habit,
  type HabitSchedule,
} from './habit-domain'

type ActionContext = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  timeZone: string
  today: string
}

const uuidSchema = z.string().uuid()
const dateKeySchema = z.string().refine(isDateKey, 'Enter a valid calendar date.')
const failureReasonIds = FAILURE_REASONS.map(({ value }) => value) as [
  (typeof FAILURE_REASONS)[number]['value'],
  ...(typeof FAILURE_REASONS)[number]['value'][],
]
const textSchema = (max: number) => z.string().trim().max(max)

const habitInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: textSchema(2000),
  pillar: z.enum(HABIT_PILLARS),
  trackingType: z.enum(['boolean', 'numeric', 'duration']),
  targetValue: z.number().positive().max(1_000_000).nullable(),
  unit: textSchema(32),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  startDate: dateKeySchema,
  endDate: dateKeySchema.nullable(),
  timeOfDay: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),
  location: textSchema(160),
  identity: textSchema(500),
  cue: textSchema(500),
  craving: textSchema(500),
  routine: textSchema(500),
  reward: textSchema(500),
  stackAfterHabitId: uuidSchema.nullable(),
  twoMinuteVersion: textSchema(500),
  smallestCompletion: textSchema(500),
  environmentPrep: textSchema(500),
  friction: textSchema(500),
  environmentChange: textSchema(500),
  obvious: textSchema(500),
  attractive: textSchema(500),
  easy: textSchema(500),
  satisfying: textSchema(500),
  isKeystone: z.boolean(),
  relatedHabitIds: z.array(uuidSchema).max(20),
}).superRefine((value, context) => {
  if (new Set(value.daysOfWeek).size !== value.daysOfWeek.length) {
    context.addIssue({ code: 'custom', path: ['daysOfWeek'], message: 'Choose each weekday only once.' })
  }
  if (new Set(value.relatedHabitIds).size !== value.relatedHabitIds.length) {
    context.addIssue({ code: 'custom', path: ['relatedHabitIds'], message: 'Choose each related habit only once.' })
  }
  if (value.endDate && value.endDate < value.startDate) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'The end date must be on or after the start date.' })
  }
  if (value.trackingType !== 'boolean' && value.targetValue === null) {
    context.addIssue({ code: 'custom', path: ['targetValue'], message: 'A measurable habit needs a target greater than zero.' })
  }
  if (value.trackingType !== 'boolean' && !value.unit) {
    context.addIssue({ code: 'custom', path: ['unit'], message: 'Add a measurement unit for this habit.' })
  }
})

const checkInSchema = z.object({
  habitId: uuidSchema,
  logDate: dateKeySchema,
  mode: z.enum(['complete', 'minimum', 'skip', 'undo']),
  value: z.number().min(0).max(1_000_000).nullable(),
  note: textSchema(3000),
  skippedReason: z.enum(failureReasonIds).nullable(),
  prevented: textSchema(1200),
  systemArea: textSchema(1200),
  adjustment: textSchema(1200),
  additionalNote: textSchema(2000),
})

function formString(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function actionPath(formData: FormData, habitId: string): string {
  const origin = formString(formData, 'origin')
  if (origin === 'dashboard') return '/'
  if (origin === 'overview') return '/habits'
  return `/habits/${habitId}`
}

function redirectWithNotice(path: string, notice: string): never {
  revalidatePath('/')
  revalidatePath('/habits')
  if (path.startsWith('/habits/')) revalidatePath(path)
  redirect(`${path}?notice=${notice}`)
}

async function getActionContext(): Promise<ActionContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle()
  const timeZone = normalizeTimeZone(profile?.timezone)
  return { supabase, userId: user.id, timeZone, today: getLocalDateKey(new Date(), timeZone) }
}

function parseHabitInput(formData: FormData, today: string) {
  const rawTarget = formString(formData, 'targetValue').trim()
  const rawTime = formString(formData, 'timeOfDay').trim()
  const rawStack = formString(formData, 'stackAfterHabitId').trim()
  const rawEndDate = formString(formData, 'endDate').trim()
  return habitInputSchema.safeParse({
    name: formString(formData, 'name'),
    description: formString(formData, 'description'),
    pillar: formString(formData, 'pillar'),
    trackingType: formString(formData, 'trackingType') || 'boolean',
    targetValue: rawTarget ? Number(rawTarget) : null,
    unit: formString(formData, 'unit'),
    daysOfWeek: formData.getAll('daysOfWeek').flatMap((value) => {
      if (typeof value !== 'string' || !/^\d$/.test(value)) return []
      return [Number(value)]
    }),
    startDate: formString(formData, 'startDate') || today,
    endDate: rawEndDate || null,
    timeOfDay: rawTime || null,
    location: formString(formData, 'location'),
    identity: formString(formData, 'identity'),
    cue: formString(formData, 'cue'),
    craving: formString(formData, 'craving'),
    routine: formString(formData, 'routine'),
    reward: formString(formData, 'reward'),
    stackAfterHabitId: rawStack || null,
    twoMinuteVersion: formString(formData, 'twoMinuteVersion'),
    smallestCompletion: formString(formData, 'smallestCompletion'),
    environmentPrep: formString(formData, 'environmentPrep'),
    friction: formString(formData, 'friction'),
    environmentChange: formString(formData, 'environmentChange'),
    obvious: formString(formData, 'obvious'),
    attractive: formString(formData, 'attractive'),
    easy: formString(formData, 'easy'),
    satisfying: formString(formData, 'satisfying'),
    isKeystone: formData.get('isKeystone') === 'on',
    relatedHabitIds: formData.getAll('relatedHabitIds').filter((value): value is string => typeof value === 'string'),
  })
}

function toSchedule(
  input: z.infer<typeof habitInputSchema>,
  existing: HabitSchedule | null,
  archivedAt: string | null = null,
): HabitSchedule {
  const behavior: BehaviorDesign = {
    identity: input.identity,
    cue: input.cue,
    craving: input.craving,
    routine: input.routine,
    reward: input.reward,
    stackAfterHabitId: input.stackAfterHabitId ?? '',
    twoMinuteVersion: input.twoMinuteVersion,
    smallestCompletion: input.smallestCompletion,
    environmentPrep: input.environmentPrep,
    friction: input.friction,
    environmentChange: input.environmentChange,
    obvious: input.obvious,
    attractive: input.attractive,
    easy: input.easy,
    satisfying: input.satisfying,
    isKeystone: input.isKeystone,
    relatedHabitIds: input.relatedHabitIds,
  }
  return {
    ...((existing ?? {}) as Record<string, unknown>),
    version: 1,
    daysOfWeek: [...input.daysOfWeek].sort((a, b) => a - b),
    startDate: input.startDate,
    endDate: input.endDate,
    archivedAt,
    timeOfDay: input.timeOfDay ?? '',
    location: input.location,
    behavior,
  }
}

function cadenceForDays(days: number[]): Habit['cadence_type'] {
  if (days.length === 7) return 'daily'
  if (days.length === 1) return 'weekly'
  return 'custom'
}

async function validateRelatedHabits(
  supabase: ActionContext['supabase'],
  userId: string,
  habitId: string | null,
  input: z.infer<typeof habitInputSchema>,
): Promise<boolean> {
  const references = [...new Set([
    ...input.relatedHabitIds,
    ...(input.stackAfterHabitId ? [input.stackAfterHabitId] : []),
  ])]
  if (habitId && references.includes(habitId)) return false
  if (references.length === 0) return true
  const { data, error } = await supabase
    .from('habits')
    .select('id')
    .eq('user_id', userId)
    .in('id', references)
  return !error && (data?.length ?? 0) === references.length
}

async function getOwnedHabit(context: ActionContext, habitId: string): Promise<Habit | null> {
  const { data, error } = await context.supabase
    .from('habits')
    .select('id,name,description,pillar,cadence_type,schedule,tracking_type,target_value,unit,active,created_at,updated_at')
    .eq('id', habitId)
    .eq('user_id', context.userId)
    .maybeSingle()
  if (error || !data) return null
  const row = data as unknown as Habit
  return {
    ...row,
    target_value: row.target_value === null ? null : Number(row.target_value),
    schedule: normalizeHabitSchedule(row.schedule, row.cadence_type, row.created_at, context.timeZone),
  }
}

function isLogDateAllowed(habit: Habit, date: string, today: string): boolean {
  if (date > today || date < habit.schedule.startDate) return false
  if (habit.schedule.endDate && date > habit.schedule.endDate) return false
  if (!habit.active && (!habit.schedule.archivedAt || date > habit.schedule.archivedAt)) return false
  return true
}

export async function createHabitAction(formData: FormData): Promise<void> {
  const context = await getActionContext()
  const parsed = parseHabitInput(formData, context.today)
  if (!parsed.success) redirectWithNotice('/habits', 'input-invalid')
  const input = parsed.data
  if (!(await validateRelatedHabits(context.supabase, context.userId, null, input))) {
    redirectWithNotice('/habits', 'reference-invalid')
  }

  const schedule = toSchedule(input, null)
  const { data, error } = await context.supabase
    .from('habits')
    .insert({
      user_id: context.userId,
      name: input.name,
      description: input.description || null,
      pillar: input.pillar,
      cadence_type: cadenceForDays(input.daysOfWeek),
      schedule,
      tracking_type: input.trackingType,
      target_value: input.trackingType === 'boolean' ? null : input.targetValue,
      unit: input.trackingType === 'boolean' ? null : input.unit,
      active: true,
    })
    .select('id')
    .single()

  if (error || !data) redirectWithNotice('/habits', 'save-failed')
  revalidatePath('/')
  revalidatePath('/habits')
  redirect(`/habits/${data.id}?notice=habit-created`)
}

export async function updateHabitAction(formData: FormData): Promise<void> {
  const habitId = formString(formData, 'habitId')
  if (!uuidSchema.safeParse(habitId).success) redirectWithNotice('/habits', 'record-not-found')
  const context = await getActionContext()
  const existing = await getOwnedHabit(context, habitId)
  if (!existing) redirectWithNotice('/habits', 'record-not-found')

  const parsed = parseHabitInput(formData, context.today)
  if (!parsed.success) redirectWithNotice(`/habits/${habitId}`, 'input-invalid')
  const input = parsed.data
  if (!(await validateRelatedHabits(context.supabase, context.userId, habitId, input))) {
    redirectWithNotice(`/habits/${habitId}`, 'reference-invalid')
  }

  const active = existing.active && !(input.endDate && input.endDate < context.today)
  const archivedAt = active
    ? null
    : existing.schedule.archivedAt ?? context.today
  const schedule = toSchedule(input, existing.schedule, archivedAt)
  const { data, error } = await context.supabase
    .from('habits')
    .update({
      name: input.name,
      description: input.description || null,
      pillar: input.pillar,
      cadence_type: cadenceForDays(input.daysOfWeek),
      schedule,
      tracking_type: input.trackingType,
      target_value: input.trackingType === 'boolean' ? null : input.targetValue,
      unit: input.trackingType === 'boolean' ? null : input.unit,
      active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', habitId)
    .eq('user_id', context.userId)
    .select('id')
    .maybeSingle()

  if (error || !data) redirectWithNotice(`/habits/${habitId}`, 'save-failed')
  revalidatePath('/')
  redirectWithNotice(`/habits/${habitId}`, 'habit-updated')
}

export async function saveHabitCheckInAction(formData: FormData): Promise<void> {
  const context = await getActionContext()
  const rawValue = formString(formData, 'value').trim()
  const rawReason = formString(formData, 'skippedReason').trim()
  const parsed = checkInSchema.safeParse({
    habitId: formString(formData, 'habitId'),
    logDate: formString(formData, 'logDate') || context.today,
    mode: formString(formData, 'mode') || 'complete',
    value: rawValue ? Number(rawValue) : null,
    note: formString(formData, 'note'),
    skippedReason: rawReason || null,
    prevented: formString(formData, 'prevented'),
    systemArea: formString(formData, 'systemArea'),
    adjustment: formString(formData, 'adjustment'),
    additionalNote: formString(formData, 'additionalNote'),
  })
  if (!parsed.success) redirectWithNotice('/habits', 'input-invalid')

  const input = parsed.data
  const path = actionPath(formData, input.habitId)
  const habit = await getOwnedHabit(context, input.habitId)
  if (!habit) redirectWithNotice(path, 'record-not-found')

  const { data: existingLog, error: existingError } = await context.supabase
    .from('habit_logs')
    .select('id,status,note,skipped_reason')
    .eq('user_id', context.userId)
    .eq('habit_id', habit.id)
    .eq('log_date', input.logDate)
    .maybeSingle()
  if (existingError) redirectWithNotice(path, 'save-failed')

  if (input.mode === 'undo') {
    if (!existingLog) redirectWithNotice(path, 'habit-cleared')
    const { error } = await context.supabase
      .from('habit_logs')
      .delete()
      .eq('id', existingLog.id)
      .eq('user_id', context.userId)
      .eq('habit_id', habit.id)
    if (error) redirectWithNotice(path, 'save-failed')
    redirectWithNotice(path, 'habit-cleared')
  }

  if (!habit.active || !isLogDateAllowed(habit, input.logDate, context.today)) {
    redirectWithNotice(path, 'date-not-available')
  }
  if (!isHabitScheduledForForm(habit, input.logDate)) {
    redirectWithNotice(path, 'date-not-scheduled')
  }

  let status: 'completed' | 'partial' | 'skipped'
  let value: number | null = null
  let durationSeconds: number | null = null
  let skippedReason: string | null = null
  let note: string | null = input.note || existingLog?.note || null

  if (input.mode === 'skip') {
    if (!input.skippedReason) redirectWithNotice(path, 'reason-required')
    if (existingLog && existingLog.status !== 'skipped') {
      redirectWithNotice(path, 'already-logged')
    }
    status = 'skipped'
    skippedReason = input.skippedReason
    note = serializeHabitReflection({
      prevented: input.prevented,
      systemArea: input.systemArea,
      adjustment: input.adjustment,
      additionalNote: input.additionalNote,
    })
  } else {
    if (input.mode === 'minimum' && !habit.schedule.behavior.twoMinuteVersion && !habit.schedule.behavior.smallestCompletion) {
      redirectWithNotice(path, 'minimum-not-set')
    }
    let measuredValue: number | null = null
    if (habit.tracking_type === 'boolean') {
      status = input.mode === 'minimum' ? 'partial' : 'completed'
    } else {
      if (input.value === null) redirectWithNotice(path, 'value-required')
      measuredValue = input.value
      if (habit.tracking_type === 'duration') {
        const unit = getDurationUnit(habit.unit)
        if (input.value > unit.maxPerDay) redirectWithNotice(path, 'value-invalid')
        durationSeconds = Math.round(input.value * unit.secondsPerUnit)
      } else {
        value = input.value
      }
      status = habit.target_value === null
        ? input.mode === 'minimum' ? 'partial' : 'completed'
        : measuredValue >= habit.target_value ? 'completed' : 'partial'
    }
    skippedReason = null
  }

  const logValues = {
    status,
    value,
    duration_seconds: durationSeconds,
    skipped_reason: skippedReason,
    note,
    updated_at: new Date().toISOString(),
  }

  if (existingLog) {
    const { data, error } = await context.supabase
      .from('habit_logs')
      .update(logValues)
      .eq('id', existingLog.id)
      .eq('user_id', context.userId)
      .eq('habit_id', habit.id)
      .select('id')
      .maybeSingle()
    if (error || !data) redirectWithNotice(path, 'save-failed')
  } else {
    const { error } = await context.supabase.from('habit_logs').insert({
      user_id: context.userId,
      habit_id: habit.id,
      log_date: input.logDate,
      ...logValues,
    })
    if (error) redirectWithNotice(path, error.code === '23505' ? 'already-logged' : 'save-failed')
  }

  redirectWithNotice(path, input.mode === 'skip' ? 'reflection-saved' : 'habit-saved')
}

function isHabitScheduledForForm(habit: Habit, date: string): boolean {
  return habit.schedule.daysOfWeek.includes(getWeekdayIndex(date))
}

async function setHabitArchived(formData: FormData, active: boolean): Promise<void> {
  const habitId = formString(formData, 'habitId')
  if (!uuidSchema.safeParse(habitId).success) redirectWithNotice('/habits', 'record-not-found')
  const context = await getActionContext()
  const existing = await getOwnedHabit(context, habitId)
  if (!existing) redirectWithNotice('/habits', 'record-not-found')

  const schedule: HabitSchedule = {
    ...existing.schedule,
    archivedAt: active ? null : context.today,
  }
  const { data, error } = await context.supabase
    .from('habits')
    .update({ active, schedule, updated_at: new Date().toISOString() })
    .eq('id', habitId)
    .eq('user_id', context.userId)
    .select('id')
    .maybeSingle()
  if (error || !data) redirectWithNotice(`/habits/${habitId}`, 'save-failed')
  revalidatePath('/')
  redirectWithNotice(`/habits/${habitId}`, active ? 'habit-restored' : 'habit-archived')
}

export async function archiveHabitAction(formData: FormData): Promise<void> {
  await setHabitArchived(formData, false)
}

export async function restoreHabitAction(formData: FormData): Promise<void> {
  await setHabitArchived(formData, true)
}

function getDurationUnit(unit: string | null) {
  const normalized = unit?.trim().toLowerCase()
  if (['hour', 'hours', 'hr', 'hrs', 'h'].includes(normalized ?? '')) {
    return { secondsPerUnit: 3600, maxPerDay: 24 }
  }
  if (['second', 'seconds', 'sec', 'secs', 's'].includes(normalized ?? '')) {
    return { secondsPerUnit: 1, maxPerDay: 86400 }
  }
  return { secondsPerUnit: 60, maxPerDay: 1440 }
}
