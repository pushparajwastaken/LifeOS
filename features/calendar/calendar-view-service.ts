import type { createClient } from '@/lib/supabase/server'
import { localDateKey } from '@/features/analytics/analytics-domain'
import { zonedLocalToUtcIso } from '@/features/learning/learning-domain'
import { addDays, monthGrid, type CalendarItem } from './calendar-view-domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

const CAP = 2000

/** Every LifeOS record with a date in the 42-day grid of `month`, as calendar items on local dates. */
export async function getCalendarMonth(supabase: Supabase, userId: string, month: string, timeZone: string) {
  const grid = monthGrid(month)
  const first = grid[0]
  const last = grid[grid.length - 1]
  const startIso = zonedLocalToUtcIso(first, '00:00', timeZone)
  const endIso = zonedLocalToUtcIso(addDays(last, 1), '00:00', timeZone)

  const [due, done, sessions, workouts, runs, goals, goalMilestones, questMilestones] = await Promise.all([
    supabase.from('tasks').select('id,title,due_at').eq('user_id', userId).in('status', ['todo', 'in_progress']).gte('due_at', startIso).lt('due_at', endIso).limit(CAP),
    supabase.from('tasks').select('id,title,completed_at').eq('user_id', userId).eq('status', 'done').gte('completed_at', startIso).lt('completed_at', endIso).limit(CAP),
    supabase.from('active_learning_sessions').select('id,topic,quest_id,started_at,duration_minutes').eq('user_id', userId).gte('started_at', startIso).lt('started_at', endIso).limit(CAP),
    supabase.from('workouts').select('id,title,performed_at,rest_day').eq('user_id', userId).gte('performed_at', startIso).lt('performed_at', endIso).limit(CAP),
    supabase.from('running_sessions').select('id,started_at,distance,distance_unit').eq('user_id', userId).gte('started_at', startIso).lt('started_at', endIso).limit(CAP),
    supabase.from('goals').select('id,title,ends_on').eq('user_id', userId).in('status', ['active', 'paused']).gte('ends_on', first).lte('ends_on', last).limit(CAP),
    supabase.from('goal_milestones').select('id,goal_id,title,due_on').eq('user_id', userId).is('completed_at', null).gte('due_on', first).lte('due_on', last).limit(CAP),
    supabase.from('quest_milestones').select('id,quest_id,title,due_on').eq('user_id', userId).is('completed_at', null).gte('due_on', first).lte('due_on', last).limit(CAP),
  ])

  const local = (iso: string) => localDateKey(iso, timeZone)
  const items: CalendarItem[] = [
    ...((due.data ?? []) as Array<{ id: string; title: string; due_at: string }>).map((row) => ({ kind: 'task_due' as const, date: local(row.due_at), title: row.title, href: '/tasks', at: row.due_at })),
    ...((done.data ?? []) as Array<{ id: string; title: string; completed_at: string }>).map((row) => ({ kind: 'task_done' as const, date: local(row.completed_at), title: row.title, href: '/tasks?view=done', at: row.completed_at })),
    ...((sessions.data ?? []) as Array<{ id: string; topic: string | null; quest_id: string | null; started_at: string; duration_minutes: number }>).map((row) => ({ kind: 'learning' as const, date: local(row.started_at), title: row.topic || 'Learning session', minutes: row.duration_minutes, href: row.quest_id ? `/quests/${row.quest_id}` : '/learning', at: row.started_at })),
    ...((workouts.data ?? []) as Array<{ id: string; title: string; performed_at: string; rest_day: boolean }>).map((row) => row.rest_day
      ? { kind: 'rest' as const, date: local(row.performed_at), title: 'Rest day', href: '/physical', at: row.performed_at }
      : { kind: 'workout' as const, date: local(row.performed_at), title: row.title, href: `/physical/workouts/${row.id}`, at: row.performed_at }),
    ...((runs.data ?? []) as Array<{ id: string; started_at: string; distance: number; distance_unit: string }>).map((row) => ({ kind: 'run' as const, date: local(row.started_at), title: `Run · ${Number(row.distance)} ${row.distance_unit}`, href: '/physical', at: row.started_at })),
    ...((goals.data ?? []) as Array<{ id: string; title: string; ends_on: string }>).map((row) => ({ kind: 'goal_end' as const, date: row.ends_on, title: row.title, href: `/goals/${row.id}` })),
    ...((goalMilestones.data ?? []) as Array<{ id: string; goal_id: string; title: string; due_on: string }>).map((row) => ({ kind: 'goal_milestone' as const, date: row.due_on, title: row.title, href: `/goals/${row.goal_id}` })),
    ...((questMilestones.data ?? []) as Array<{ id: string; quest_id: string; title: string; due_on: string }>).map((row) => ({ kind: 'quest_milestone' as const, date: row.due_on, title: row.title, href: `/quests/${row.quest_id}` })),
  ]
  const results = [due, done, sessions, workouts, runs, goals, goalMilestones, questMilestones]
  return {
    grid,
    items: items.filter((item) => item.date >= first && item.date <= last),
    truncated: results.some((result) => Array.isArray(result.data) && result.data.length >= CAP),
    hasLoadError: results.some((result) => Boolean(result.error)),
  }
}
