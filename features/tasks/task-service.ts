import type { createClient } from '@/lib/supabase/server'
import { utcToZonedParts } from '@/features/learning/learning-domain'
import { TASK_LIMITS, escapeLikePattern, type TaskFilters } from './task-domain'
import { readRepeat, type TaskRepeat } from './task-recurrence'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type TaskView = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  pillar: string | null
  dueAt: string | null
  /** Local date and time of `dueAt` in the profile timezone. */
  dueDate: string | null
  dueTime: string | null
  estimatedMinutes: number | null
  repeat: TaskRepeat
  completedAt: string | null
  createdAt: string
}

export type TasksPageData = { tasks: TaskView[]; counts: { open: number; done: number }; truncated: boolean; hasLoadError: boolean }

const SELECT = 'id,title,description,status,priority,pillar,due_at,estimated_minutes,recurrence,completed_at,created_at'

type TaskRow = {
  id: string; title: string; description: string | null; status: string; priority: string; pillar: string | null
  due_at: string | null; estimated_minutes: number | null; recurrence: unknown; completed_at: string | null; created_at: string
}

export async function getTasksPageData(supabase: Supabase, userId: string, filters: TaskFilters, timeZone: string): Promise<TasksPageData> {
  let query = supabase.from('tasks').select(SELECT).eq('user_id', userId)
  if (filters.view === 'open') query = query.in('status', ['todo', 'in_progress'])
  else if (filters.view !== 'all') query = query.eq('status', filters.view)
  if (filters.pillar) query = query.eq('pillar', filters.pillar)
  if (filters.query) query = query.ilike('title', `%${escapeLikePattern(filters.query)}%`)
  query = filters.view === 'done'
    ? query.order('completed_at', { ascending: false, nullsFirst: false })
    : query.order('due_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })

  const [result, openCount, doneCount] = await Promise.all([
    query.limit(TASK_LIMITS.listCap + 1),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['todo', 'in_progress']),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'done'),
  ])
  const rows = (result.data ?? []) as TaskRow[]
  const tasks = rows.slice(0, TASK_LIMITS.listCap).map((row) => {
    const due = row.due_at ? utcToZonedParts(row.due_at, timeZone) : null
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      pillar: row.pillar,
      dueAt: row.due_at,
      dueDate: due?.date ?? null,
      dueTime: due?.time ?? null,
      estimatedMinutes: row.estimated_minutes,
      repeat: readRepeat(row.recurrence),
      completedAt: row.completed_at,
      createdAt: row.created_at,
    }
  })
  return {
    tasks,
    counts: { open: openCount.count ?? 0, done: doneCount.count ?? 0 },
    truncated: rows.length > TASK_LIMITS.listCap,
    hasLoadError: Boolean(result.error || openCount.error || doneCount.error),
  }
}
