import 'server-only'

import type { createClient } from '@/lib/supabase/server'
import { getLocalDateKey } from '@/features/habits/habit-domain'
import { utcToZonedParts, zonedLocalToUtcIso } from '@/features/learning/learning-domain'
import { nextDueDate, readRepeat } from './task-recurrence'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type CompletedTask = { id: string; title: string; description: string | null; priority: string; pillar: string | null; due_at: string | null; estimated_minutes: number | null; recurrence: unknown }
export const COMPLETED_TASK_SELECT = 'id,title,description,priority,pillar,due_at,estimated_minutes,recurrence'

/**
 * After a repeating task is completed, creates its next occurrence (same details, next due date, keeping the
 * time of day). Non-repeating tasks are ignored. Returns whether a new task was created.
 */
export async function createNextOccurrence(supabase: Supabase, userId: string, task: CompletedTask, timeZone: string): Promise<boolean> {
  const repeat = readRepeat(task.recurrence)
  if (repeat === 'none') return false
  const today = getLocalDateKey(new Date(), timeZone)
  const current = task.due_at ? utcToZonedParts(task.due_at, timeZone) : { date: today, time: '23:59' }
  const date = nextDueDate(current.date, repeat, today)
  const { error } = await supabase.from('tasks').insert({
    user_id: userId,
    title: task.title,
    description: task.description,
    priority: task.priority,
    pillar: task.pillar,
    estimated_minutes: task.estimated_minutes,
    recurrence: task.recurrence,
    status: 'todo',
    due_at: zonedLocalToUtcIso(date, current.time, timeZone),
  })
  return !error
}
