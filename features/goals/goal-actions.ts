'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getLocalDateKey } from '@/features/habits/habit-domain'
import { zonedLocalToUtcIso } from '@/features/learning/learning-domain'
import { uuidSchema } from '@/features/quests/quest-domain'
import { getPageSession } from '@/lib/page-session'
import {
  GOAL_INTENTS,
  GOAL_TRANSITIONS,
  goalInputSchema,
  goalInputToRow,
  milestoneInputSchema,
  progressInputSchema,
  type GoalIntent,
} from './goal-domain'
import { getOwnedGoal } from './goal-service'

function text(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function finish(path: string, notice: string, anchor = ''): never {
  revalidatePath('/goals', 'layout')
  revalidatePath('/')
  revalidatePath('/analytics')
  redirect(`${path}${path.includes('?') ? '&' : '?'}notice=${notice}${anchor}`)
}

function parseGoal(formData: FormData) {
  return goalInputSchema.safeParse({
    title: text(formData, 'title'),
    description: text(formData, 'description'),
    pillar: text(formData, 'pillar'),
    period: text(formData, 'period') || '90_day',
    startsOn: text(formData, 'startsOn'),
    endsOn: text(formData, 'endsOn'),
    targetValue: text(formData, 'targetValue'),
    unit: text(formData, 'unit'),
  })
}

/** Resolves the goal id from the form and checks the signed-in user owns it before any child write. */
async function requireGoal(formData: FormData) {
  const goalId = uuidSchema.safeParse(text(formData, 'goalId'))
  if (!goalId.success) finish('/goals', 'record-not-found')
  const session = await getPageSession()
  const goal = await getOwnedGoal(session.supabase, session.userId, goalId.data)
  if (!goal) finish('/goals', 'record-not-found')
  return { ...session, goal, path: `/goals/${goal.id}` }
}

export async function createGoalAction(formData: FormData): Promise<void> {
  const parsed = parseGoal(formData)
  if (!parsed.success) finish('/goals', 'goal-invalid', '#new-goal')
  const { supabase, userId } = await getPageSession()
  const { data, error } = await supabase.from('goals').insert({ user_id: userId, status: 'active', ...goalInputToRow(parsed.data) }).select('id').single()
  if (error || !data) finish('/goals', 'save-failed')
  finish(`/goals/${data.id}`, 'goal-created')
}

export async function updateGoalAction(formData: FormData): Promise<void> {
  const { supabase, userId, goal, path } = await requireGoal(formData)
  const parsed = parseGoal(formData)
  if (!parsed.success) finish(path, 'goal-invalid', '#edit-goal')
  const { error } = await supabase.from('goals').update(goalInputToRow(parsed.data)).eq('id', goal.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'goal-updated')
}

export async function setGoalStatusAction(formData: FormData): Promise<void> {
  const { supabase, userId, goal, path } = await requireGoal(formData)
  const intent = text(formData, 'intent') as GoalIntent
  if (!(GOAL_INTENTS as readonly string[]).includes(intent)) finish(path, 'record-not-found')
  const transition = GOAL_TRANSITIONS[intent]
  if (goal.status === transition.to) finish(path, `goal-${intent}`)
  if (!transition.from.includes(goal.status)) finish(path, 'goal-unchanged')
  const { data, error } = await supabase.from('goals').update({ status: transition.to })
    .eq('id', goal.id).eq('user_id', userId).in('status', [...transition.from]).select('id').maybeSingle()
  finish(path, error ? 'save-failed' : data ? `goal-${intent}` : 'goal-unchanged')
}

export async function deleteGoalAction(formData: FormData): Promise<void> {
  const { supabase, userId, goal, path } = await requireGoal(formData)
  if (text(formData, 'confirm') !== 'delete') finish(path, 'goal-delete-confirm', '#delete-goal')
  const { error } = await supabase.from('goals').delete().eq('id', goal.id).eq('user_id', userId)
  finish(error ? path : '/goals', error ? 'save-failed' : 'goal-deleted')
}

export async function addProgressAction(formData: FormData): Promise<void> {
  const { supabase, userId, goal, path, timeZone } = await requireGoal(formData)
  const parsed = progressInputSchema.safeParse({ value: text(formData, 'value'), date: text(formData, 'date'), note: text(formData, 'note') })
  const today = getLocalDateKey(new Date(), timeZone)
  if (!parsed.success || parsed.data.date > today) finish(path, 'progress-invalid', '#log-progress')
  // Today keeps the real time; an earlier day is recorded at local noon so it stays on that date in every view.
  const recordedAt = parsed.data.date === today ? new Date().toISOString() : zonedLocalToUtcIso(parsed.data.date, '12:00', timeZone)
  const { error } = await supabase.from('goal_progress_entries').insert({ user_id: userId, goal_id: goal.id, value: parsed.data.value, note: parsed.data.note, recorded_at: recordedAt })
  finish(path, error ? 'save-failed' : 'progress-added')
}

export async function deleteProgressAction(formData: FormData): Promise<void> {
  const { supabase, userId, goal, path } = await requireGoal(formData)
  const entryId = uuidSchema.safeParse(text(formData, 'entryId'))
  if (!entryId.success) finish(path, 'record-not-found')
  const { data, error } = await supabase.from('goal_progress_entries').delete().eq('id', entryId.data).eq('goal_id', goal.id).eq('user_id', userId).select('id').maybeSingle()
  finish(path, error ? 'save-failed' : data ? 'progress-deleted' : 'record-not-found')
}

export async function addGoalMilestoneAction(formData: FormData): Promise<void> {
  const { supabase, userId, goal, path } = await requireGoal(formData)
  const parsed = milestoneInputSchema.safeParse({ title: text(formData, 'title'), dueOn: text(formData, 'dueOn') })
  if (!parsed.success) finish(path, 'milestone-invalid', '#milestones')
  const { error } = await supabase.from('goal_milestones').insert({ user_id: userId, goal_id: goal.id, title: parsed.data.title, due_on: parsed.data.dueOn })
  finish(path, error ? 'save-failed' : 'goal-milestone-added', '#milestones')
}

export async function toggleGoalMilestoneAction(formData: FormData): Promise<void> {
  const { supabase, userId, goal, path } = await requireGoal(formData)
  const milestoneId = uuidSchema.safeParse(text(formData, 'milestoneId'))
  const done = text(formData, 'done') === 'true'
  if (!milestoneId.success) finish(path, 'record-not-found')
  // Guarded on the current state so a repeated submit never moves the original completion time.
  let query = supabase.from('goal_milestones').update({ completed_at: done ? new Date().toISOString() : null })
    .eq('id', milestoneId.data).eq('goal_id', goal.id).eq('user_id', userId)
  query = done ? query.is('completed_at', null) : query.not('completed_at', 'is', null)
  const { error } = await query
  finish(path, error ? 'save-failed' : done ? 'goal-milestone-done' : 'goal-milestone-reopened', '#milestones')
}

export async function deleteGoalMilestoneAction(formData: FormData): Promise<void> {
  const { supabase, userId, goal, path } = await requireGoal(formData)
  const milestoneId = uuidSchema.safeParse(text(formData, 'milestoneId'))
  if (!milestoneId.success) finish(path, 'record-not-found')
  const { data, error } = await supabase.from('goal_milestones').delete().eq('id', milestoneId.data).eq('goal_id', goal.id).eq('user_id', userId).select('id').maybeSingle()
  finish(path, error ? 'save-failed' : data ? 'goal-milestone-deleted' : 'record-not-found', '#milestones')
}
