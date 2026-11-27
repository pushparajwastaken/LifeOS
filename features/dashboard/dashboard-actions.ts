'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  COMPLETED_TASK_STATUS,
  DEFAULT_TASK_STATUS,
  OPEN_TASK_STATUSES,
  getTaskStatusUpdate,
} from '@/features/tasks/task-status'
import { COMPLETED_TASK_SELECT, createNextOccurrence, type CompletedTask } from '@/features/tasks/task-recurrence-server'
import { DASHBOARD_PILLAR_IDS, getDurationUnit, getLocalDateKey, normalizeTimeZone } from './dashboard-service'

const taskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  priority: z.enum(['low', 'medium', 'high']),
})

const taskIdSchema = z.string().uuid()

const habitSchema = z.object({
  habitId: z.string().uuid(),
  intent: z.enum(['complete', 'undo']),
  value: z.number().min(0).max(1_000_000).optional(),
})

const newHabitSchema = z.object({
  name: z.string().trim().min(1).max(100),
  pillar: z.enum(DASHBOARD_PILLAR_IDS),
})

function formString(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function redirectWithNotice(notice: string): never {
  revalidatePath('/')
  redirect(`/?notice=${notice}`)
}

async function getSignedInUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

export async function createTaskAction(formData: FormData): Promise<void> {
  const parsed = taskSchema.safeParse({
    title: formString(formData, 'title'),
    priority: formString(formData, 'priority') || 'medium',
  })

  if (!parsed.success) redirectWithNotice('input-required')

  const { supabase, user } = await getSignedInUser()
  const { error } = await supabase.from('tasks').insert({
    user_id: user.id,
    title: parsed.data.title,
    status: DEFAULT_TASK_STATUS,
    priority: parsed.data.priority,
  })

  redirectWithNotice(error ? 'save-failed' : 'task-added')
}

export async function completeTaskAction(formData: FormData): Promise<void> {
  const parsedTaskId = taskIdSchema.safeParse(formString(formData, 'taskId'))
  if (!parsedTaskId.success) redirectWithNotice('record-not-found')

  const { supabase, user } = await getSignedInUser()
  // Only open tasks can be completed, so a repeated submit never overwrites the original completed_at.
  const { data, error } = await supabase
    .from('tasks')
    .update(getTaskStatusUpdate(COMPLETED_TASK_STATUS, new Date()))
    .eq('id', parsedTaskId.data)
    .eq('user_id', user.id)
    .in('status', [...OPEN_TASK_STATUSES])
    .select(COMPLETED_TASK_SELECT)
    .maybeSingle()

  if (error || !data) redirectWithNotice('record-not-found')
  // Repeating tasks get their next occurrence (only from the request that completed this one).
  const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', user.id).maybeSingle()
  const spawned = await createNextOccurrence(supabase, user.id, data as CompletedTask, normalizeTimeZone(profile?.timezone))
  redirectWithNotice(spawned ? 'task-completed-repeat' : 'task-completed')
}

export async function createHabitAction(formData: FormData): Promise<void> {
  const parsed = newHabitSchema.safeParse({
    name: formString(formData, 'name'),
    pillar: formString(formData, 'pillar'),
  })

  if (!parsed.success) redirectWithNotice('input-required')

  const { supabase, user } = await getSignedInUser()
  const { error } = await supabase.from('habits').insert({
    user_id: user.id,
    name: parsed.data.name,
    pillar: parsed.data.pillar,
    cadence_type: 'daily',
    schedule: {},
    tracking_type: 'boolean',
    active: true,
  })

  redirectWithNotice(error ? 'save-failed' : 'habit-created')
}

export async function recordHabitAction(formData: FormData): Promise<void> {
  const rawValue = formString(formData, 'value').trim()
  const parsed = habitSchema.safeParse({
    habitId: formString(formData, 'habitId'),
    intent: formString(formData, 'intent') || 'complete',
    value: rawValue ? Number(rawValue) : undefined,
  })

  if (!parsed.success) redirectWithNotice('input-required')

  const { supabase, user } = await getSignedInUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle()
  const timeZone = normalizeTimeZone(profile?.timezone)
  const today = getLocalDateKey(new Date(), timeZone)

  const { data: habit, error: habitError } = await supabase
    .from('habits')
    .select('id,tracking_type,target_value,unit')
    .eq('id', parsed.data.habitId)
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle()

  if (habitError || !habit) redirectWithNotice('record-not-found')

  const { data: existingLog, error: logReadError } = await supabase
    .from('habit_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('habit_id', habit.id)
    .eq('log_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (logReadError) redirectWithNotice('save-failed')

  if (parsed.data.intent === 'undo') {
    if (existingLog) {
      const { error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('id', existingLog.id)
        .eq('user_id', user.id)
        .eq('habit_id', habit.id)
      if (error) redirectWithNotice('save-failed')
    }
    redirectWithNotice('habit-cleared')
  }

  const trackingType = String(habit.tracking_type)
  const targetValue = habit.target_value === null ? null : Number(habit.target_value)
  let value: number | null = null
  let durationSeconds: number | null = null
  let measuredValue: number | null = null

  if (trackingType === 'numeric') {
    if (parsed.data.value === undefined) redirectWithNotice('input-required')
    value = parsed.data.value
    measuredValue = value
  } else if (trackingType === 'duration') {
    if (parsed.data.value === undefined) redirectWithNotice('input-required')
    const durationUnit = getDurationUnit(habit.unit)
    if (parsed.data.value > durationUnit.maxPerDay) redirectWithNotice('input-required')
    durationSeconds = Math.round(parsed.data.value * durationUnit.secondsPerUnit)
    measuredValue = parsed.data.value
  } else if (trackingType !== 'boolean') {
    redirectWithNotice('save-failed')
  }

  const status =
    targetValue === null || measuredValue === null || measuredValue >= targetValue
      ? 'completed'
      : 'partial'
  const logValues = {
    status,
    value,
    duration_seconds: durationSeconds,
    updated_at: new Date().toISOString(),
  }

  if (existingLog) {
    const { data, error } = await supabase
      .from('habit_logs')
      .update(logValues)
      .eq('id', existingLog.id)
      .eq('user_id', user.id)
      .eq('habit_id', habit.id)
      .select('id')
      .maybeSingle()
    if (error || !data) redirectWithNotice('save-failed')
  } else {
    const { error } = await supabase.from('habit_logs').insert({
      user_id: user.id,
      habit_id: habit.id,
      log_date: today,
      ...logValues,
    })
    if (error) redirectWithNotice('save-failed')
  }

  redirectWithNotice('habit-saved')
}
