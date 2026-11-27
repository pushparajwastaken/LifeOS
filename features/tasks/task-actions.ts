'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { zonedLocalToUtcIso } from '@/features/learning/learning-domain'
import { uuidSchema } from '@/features/quests/quest-domain'
import { getPageSession } from '@/lib/page-session'
import { TASK_INTENTS, TASK_TRANSITIONS, dueWallClock, safeTasksReturn, taskInputSchema, type TaskIntent } from './task-domain'
import { getTaskStatusUpdate } from './task-status'
import { recurrenceFor } from './task-recurrence'
import { COMPLETED_TASK_SELECT, createNextOccurrence, type CompletedTask } from './task-recurrence-server'

function text(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function done(returnTo: string, notice: string, anchor = ''): never {
  revalidatePath('/tasks')
  revalidatePath('/')
  revalidatePath('/analytics')
  redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}notice=${notice}${anchor}`)
}

function parseInput(formData: FormData) {
  return taskInputSchema.safeParse({
    title: text(formData, 'title'),
    description: text(formData, 'description'),
    priority: text(formData, 'priority') || 'medium',
    pillar: text(formData, 'pillar'),
    dueDate: text(formData, 'dueDate'),
    dueTime: text(formData, 'dueTime'),
    estimatedMinutes: text(formData, 'estimatedMinutes'),
    repeat: text(formData, 'repeat') || 'none',
  })
}

function columns(input: NonNullable<ReturnType<typeof parseInput>['data']>, timeZone: string) {
  const due = dueWallClock(input)
  return {
    title: input.title,
    description: input.description,
    priority: input.priority,
    pillar: input.pillar,
    due_at: due ? zonedLocalToUtcIso(due.date, due.time, timeZone) : null,
    estimated_minutes: input.estimatedMinutes,
    recurrence: recurrenceFor(input.repeat),
  }
}

export async function createTaskPageAction(formData: FormData): Promise<void> {
  const returnTo = safeTasksReturn(text(formData, 'returnTo'))
  const parsed = parseInput(formData)
  if (!parsed.success) done(returnTo, 'task-invalid', '#add-task')
  const { supabase, userId, timeZone } = await getPageSession()
  const { error } = await supabase.from('tasks').insert({ user_id: userId, status: 'todo', ...columns(parsed.data, timeZone) })
  done(returnTo, error ? 'save-failed' : 'task-created')
}

export async function updateTaskAction(formData: FormData): Promise<void> {
  const returnTo = safeTasksReturn(text(formData, 'returnTo'))
  const taskId = uuidSchema.safeParse(text(formData, 'taskId'))
  if (!taskId.success) done(returnTo, 'record-not-found')
  const parsed = parseInput(formData)
  if (!parsed.success) done(returnTo, 'task-invalid')
  const { supabase, userId, timeZone } = await getPageSession()
  const { data, error } = await supabase.from('tasks').update(columns(parsed.data, timeZone))
    .eq('id', taskId.data).eq('user_id', userId).select('id').maybeSingle()
  done(returnTo, error ? 'save-failed' : data ? 'task-updated' : 'record-not-found')
}

/** Start, complete, reopen or cancel. The current status must allow the move, so repeated submits change nothing. */
export async function setTaskStatusAction(formData: FormData): Promise<void> {
  const returnTo = safeTasksReturn(text(formData, 'returnTo'))
  const taskId = uuidSchema.safeParse(text(formData, 'taskId'))
  const intent = text(formData, 'intent') as TaskIntent
  if (!taskId.success || !(TASK_INTENTS as readonly string[]).includes(intent)) done(returnTo, 'record-not-found')
  const transition = TASK_TRANSITIONS[intent]
  const { supabase, userId, timeZone } = await getPageSession()
  const { data, error } = await supabase.from('tasks').update(getTaskStatusUpdate(transition.to, new Date()))
    .eq('id', taskId.data).eq('user_id', userId).in('status', [...transition.from]).select(COMPLETED_TASK_SELECT).maybeSingle()
  if (error) done(returnTo, 'save-failed')
  if (data) {
    // Only the request that actually completed the task creates the next occurrence, so a double click makes one.
    const spawned = intent === 'complete' && await createNextOccurrence(supabase, userId, data as CompletedTask, timeZone)
    done(returnTo, spawned ? 'task-complete-repeat' : `task-${intent}`)
  }
  // Nothing matched: a repeated submit (already in the target status) is reported as done; anything else changed meanwhile.
  const { data: current } = await supabase.from('tasks').select('status').eq('id', taskId.data).eq('user_id', userId).maybeSingle()
  done(returnTo, !current ? 'record-not-found' : current.status === transition.to ? `task-${intent}` : 'task-unchanged')
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const returnTo = safeTasksReturn(text(formData, 'returnTo'))
  const taskId = uuidSchema.safeParse(text(formData, 'taskId'))
  if (!taskId.success) done(returnTo, 'record-not-found')
  if (text(formData, 'confirm') !== 'delete') done(returnTo, 'task-delete-confirm')
  const { supabase, userId } = await getPageSession()
  const { data, error } = await supabase.from('tasks').delete().eq('id', taskId.data).eq('user_id', userId).select('id').maybeSingle()
  done(returnTo, error ? 'save-failed' : data ? 'task-deleted' : 'record-not-found')
}
