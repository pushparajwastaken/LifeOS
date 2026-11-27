'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getLocalDateKey } from '@/features/habits/habit-domain'
import { utcToZonedParts, zonedLocalToUtcIso } from '@/features/learning/learning-domain'
import { uuidSchema } from '@/features/quests/quest-domain'
import { getPageSession } from '@/lib/page-session'
import { PLAN_INTENTS, isDateKey, parsePlannerDate, plannedDue, plannerHref, reviewInputSchema, type PlanIntent } from './planner-domain'

function text(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function finish(path: string, notice: string, anchor = ''): never {
  revalidatePath('/planner')
  revalidatePath('/tasks')
  revalidatePath('/')
  redirect(`${path}${path.includes('?') ? '&' : '?'}notice=${notice}${anchor}`)
}

/** Plans an open task for a day (sets its due date), moves it to the next day, or unschedules it. */
export async function planTaskAction(formData: FormData): Promise<void> {
  const { supabase, userId, timeZone } = await getPageSession()
  const today = getLocalDateKey(new Date(), timeZone)
  const date = parsePlannerDate(text(formData, 'date'), today)
  const path = plannerHref(date, today)
  const taskId = uuidSchema.safeParse(text(formData, 'taskId'))
  const intent = text(formData, 'intent') as PlanIntent
  if (!taskId.success || !(PLAN_INTENTS as readonly string[]).includes(intent)) finish(path, 'record-not-found')

  const { data: task } = await supabase.from('tasks').select('id,due_at,status').eq('id', taskId.data).eq('user_id', userId).maybeSingle()
  if (!task) finish(path, 'record-not-found')
  if (task.status !== 'todo' && task.status !== 'in_progress') finish(path, 'task-unchanged')
  // The due date the user saw: if it changed since (another tab, or a second click that ran after the first),
  // do nothing rather than move the task again.
  const expected = text(formData, 'expectedDue')
  const seen = expected ? Date.parse(expected) : null
  const actual = task.due_at ? Date.parse(task.due_at) : null
  if (seen !== actual) finish(path, 'planner-already')
  const due = plannedDue(intent, date, task.due_at ? utcToZonedParts(task.due_at, timeZone) : null, utcToZonedParts(new Date().toISOString(), timeZone))
  // Guarded on the due date read above, so two quick clicks never move a task two days.
  let update = supabase.from('tasks').update({ due_at: due ? zonedLocalToUtcIso(due.date, due.time, timeZone) : null })
    .eq('id', task.id).eq('user_id', userId).in('status', ['todo', 'in_progress'])
  update = task.due_at ? update.eq('due_at', task.due_at) : update.is('due_at', null)
  const { data, error } = await update.select('id').maybeSingle()
  finish(path, error ? 'save-failed' : data ? `planner-${intent.replace('_', '-')}` : 'task-unchanged')
}

/** Saves (creates or replaces) the daily review for one day, never for a future day. */
export async function saveDailyReviewAction(formData: FormData): Promise<void> {
  const { supabase, userId, timeZone } = await getPageSession()
  const today = getLocalDateKey(new Date(), timeZone)
  const rawDate = text(formData, 'date')
  const path = plannerHref(parsePlannerDate(rawDate, today), today)
  const parsed = reviewInputSchema.safeParse({
    date: rawDate,
    accomplished: text(formData, 'accomplished'),
    learned: text(formData, 'learned'),
    improve: text(formData, 'improve'),
    gratitude: text(formData, 'gratitude'),
    tomorrow: text(formData, 'tomorrow'),
  })
  if (!parsed.success || !isDateKey(rawDate) || parsed.data.date > today) finish(path, 'review-invalid', '#reflect')
  const { date, ...fields } = parsed.data
  const { error } = await supabase.from('daily_reviews').upsert({ user_id: userId, review_date: date, ...fields }, { onConflict: 'user_id,review_date' })
  finish(path, error ? 'save-failed' : 'review-saved', '#reflect')
}
