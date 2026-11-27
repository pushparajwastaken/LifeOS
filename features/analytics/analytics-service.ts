import type { createClient } from '@/lib/supabase/server'
import { PILLAR_LABELS, getHabitStreaks, getPeriodMetrics } from '@/features/habits/habit-domain'
import { getHabitManagementData } from '@/features/habits/habit-service'
import { SESSION_TYPE_LABELS, type SessionType } from '@/features/learning/learning-domain'
import { getQuestProgress } from '@/features/quests/quest-domain'
import {
  addDays,
  COMPARABLE_METRICS,
  breakdown,
  compareLastWeek,
  countByWeek,
  distinctDaysByWeek,
  isCompletedOnTime,
  localDateKey,
  pooledRate,
  rateByWeek,
  seriesTotal,
  sumByWeek,
  weekWindow,
  type MetricGroup,
  type WeekComparison,
  type MetricId,
  type WeeklySeries,
} from './analytics-domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

/** An event metric: one value per window week (null = nothing to measure) plus a window summary. */
export type EventMetric = { id: MetricId; series: WeeklySeries; summary: number | null; comparison: WeekComparison | null }
/** A current_state metric: a single "as of today" value; never trended or compared. */
export type StateMetric = { id: MetricId; value: number | null; detail?: string }
export type BreakdownRow = { key: string; value: number }

export type AnalyticsGroupData = {
  group: MetricGroup
  events: EventMetric[]
  state: StateMetric[]
  breakdowns?: Array<{ title: string; unit: 'minutes' | 'count'; rows: BreakdownRow[] }>
  hasData: boolean
}

export type AnalyticsData = {
  today: string
  timeZone: string
  weeks: string[]
  groups: AnalyticsGroupData[]
  hasLoadError: boolean
  /** True when a source hit its row cap, so older weeks may be undercounted. */
  truncated: boolean
}

const ROW_CAP = 5000

type TaskRow = { status: string; due_at: string | null; completed_at: string | null }
type SessionRow = { quest_id: string | null; pillar: string | null; session_type: SessionType; started_at: string; duration_minutes: number }
type QuestRow = { id: string; title: string; pillar: string; structure: 'structured' | 'exploratory'; status: string; completed_at: string | null; weekly_target_minutes: number | null }
type ResourceRow = { created_at: string; origin: string; status: string; completed_at: string | null }

const ORIGIN_LABELS: Record<string, string> = { manual: 'Added by hand', chrome_html: 'Bookmark import', chrome_extension: 'Chrome extension', youtube: 'YouTube', x: 'X' }

const event = (id: MetricId, series: WeeklySeries, summary?: number | null): EventMetric => {
  const kind = COMPARABLE_METRICS[id]
  return { id, series, summary: summary === undefined ? seriesTotal(series as number[]) : summary, comparison: kind ? compareLastWeek(series, kind) : null }
}

export async function getAnalyticsData(supabase: Supabase, userId: string): Promise<AnalyticsData> {
  const now = new Date()
  const nowIso = now.toISOString()
  // Computed before the profile timezone is known so every query can run in parallel with the habits load:
  // the window of (UTC today - 1 day) starts no later than the local window, and one more day of slack covers
  // the timezone offset at the boundary. The domain then buckets events exactly by local date.
  const since = `${addDays(weekWindow(addDays(nowIso.slice(0, 10), -1))[0], -1)}T00:00:00Z`

  const [habitsData, tasksDone, tasksOverdue, goalsCompleted, goalMilestones, goalProgress, sessions, quests, objectives, questMilestones, resourcesAdded, resourcesCompleted, backlog, attached, imports] = await Promise.all([
    getHabitManagementData(supabase, userId),
    supabase.from('tasks').select('status,due_at,completed_at').eq('user_id', userId).eq('status', 'done').gte('completed_at', since).limit(ROW_CAP),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['todo', 'in_progress']).lt('due_at', nowIso),
    supabase.from('goals').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'completed'),
    supabase.from('goal_milestones').select('completed_at').eq('user_id', userId).gte('completed_at', since).limit(ROW_CAP),
    supabase.from('goal_progress_entries').select('recorded_at').eq('user_id', userId).gte('recorded_at', since).limit(ROW_CAP),
    supabase.from('active_learning_sessions').select('quest_id,pillar,session_type,started_at,duration_minutes').eq('user_id', userId).gte('started_at', since).limit(ROW_CAP),
    supabase.from('side_quests').select('id,title,pillar,structure,status,completed_at,weekly_target_minutes').eq('user_id', userId).limit(ROW_CAP),
    supabase.from('quest_objectives').select('quest_id,achieved_at').eq('user_id', userId).limit(ROW_CAP),
    supabase.from('quest_milestones').select('quest_id,completed_at').eq('user_id', userId).limit(ROW_CAP),
    supabase.from('learning_resources').select('created_at,origin,status,completed_at').eq('user_id', userId).gte('created_at', since).limit(ROW_CAP),
    supabase.from('learning_resources').select('completed_at').eq('user_id', userId).eq('status', 'completed').gte('completed_at', since).limit(ROW_CAP),
    supabase.from('learning_resources').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['saved', 'in_progress']),
    supabase.from('quest_resources').select('resource_id').eq('user_id', userId).limit(ROW_CAP),
    supabase.from('import_runs').select('completed_at,items_duplicate').eq('user_id', userId).eq('status', 'completed').gte('completed_at', since).limit(ROW_CAP),
  ])

  const { today, timeZone } = habitsData
  const weeks = weekWindow(today)
  const results = [tasksDone, tasksOverdue, goalsCompleted, goalMilestones, goalProgress, sessions, quests, objectives, questMilestones, resourcesAdded, resourcesCompleted, backlog, attached, imports]
  const hasLoadError = habitsData.hasLoadError || results.some((result) => Boolean(result.error))
  const truncated = !habitsData.historyComplete || results.some((result) => Array.isArray(result.data) && result.data.length >= ROW_CAP)
  const local = (iso: string) => localDateKey(iso, timeZone)

  // Productivity
  const doneTasks = (tasksDone.data ?? []) as TaskRow[]
  const completedDates = doneTasks.flatMap((task) => (task.completed_at ? [local(task.completed_at)] : []))
  const onTimeItems = doneTasks.flatMap((task) => (task.completed_at && task.due_at ? [{ date: local(task.completed_at), hit: isCompletedOnTime(task.completed_at, task.due_at) }] : []))
  const goalMilestoneDates = ((goalMilestones.data ?? []) as Array<{ completed_at: string }>).map((row) => local(row.completed_at))
  const goalProgressDates = ((goalProgress.data ?? []) as Array<{ recorded_at: string }>).map((row) => local(row.recorded_at))
  const productivity: AnalyticsGroupData = {
    group: 'productivity',
    events: [
      event('tasks_completed', countByWeek(completedDates, weeks, today)),
      event('tasks_on_time_rate', rateByWeek(onTimeItems, weeks, today), pooledRate(onTimeItems, weeks, today)),
      event('goal_progress_updates', countByWeek(goalProgressDates, weeks, today)),
      event('goal_milestones_completed', countByWeek(goalMilestoneDates, weeks, today)),
    ],
    state: [
      { id: 'tasks_overdue', value: tasksOverdue.error ? null : tasksOverdue.count ?? 0 },
      { id: 'goals_completed', value: goalsCompleted.error ? null : goalsCompleted.count ?? 0 },
    ],
    hasData: false,
  }

  // Habit consistency (re-scored from schedules, so approximate). Today only counts once it has been logged,
  // so an unlogged today never lowers the rate (and is never "missed").
  const logsByHabit = new Map<string, typeof habitsData.logs>()
  for (const log of habitsData.logs) {
    const list = logsByHabit.get(log.habit_id)
    if (list) list.push(log)
    else logsByHabit.set(log.habit_id, [log])
  }
  const loggedToday = new Set(habitsData.logs.filter((log) => log.log_date === today).map((log) => log.habit_id))
  const habitWeeks = weeks.map((startDate) => {
    const weekEnd = addDays(startDate, 6) < today ? addDays(startDate, 6) : today
    const totals = habitsData.habits.reduce((sum, habit) => {
      const end = weekEnd === today && !loggedToday.has(habit.id) ? addDays(today, -1) : weekEnd
      if (end < startDate) return sum
      const metrics = getPeriodMetrics(habit, logsByHabit.get(habit.id) ?? [], startDate, end, today)
      return { opportunities: sum.opportunities + metrics.opportunities, completed: sum.completed + metrics.completed, missed: sum.missed + metrics.missed }
    }, { opportunities: 0, completed: 0, missed: 0 })
    return { ...totals, percentage: totals.opportunities ? Math.round((totals.completed / totals.opportunities) * 100) : null }
  })
  const habitOpportunities = habitWeeks.reduce((sum, week) => sum + week.opportunities, 0)
  const habitCompleted = habitWeeks.reduce((sum, week) => sum + week.completed, 0)
  const activeHabits = habitsData.habits.filter((habit) => habit.active)
  const streaks = activeHabits.map((habit) => ({ name: habit.name, ...getHabitStreaks(habit, logsByHabit.get(habit.id) ?? [], today) }))
  const bestStreak = streaks.reduce<(typeof streaks)[number] | null>((best, next) => (!best || next.current > best.current ? next : best), null)
  const habits: AnalyticsGroupData = {
    group: 'habits',
    events: [
      event('habit_consistency', habitWeeks.map((week) => week.percentage), habitOpportunities ? Math.round((habitCompleted / habitOpportunities) * 100) : null),
      event('habit_missed', habitWeeks.map((week) => (week.opportunities ? week.missed : null)), habitOpportunities ? habitWeeks.reduce((sum, week) => sum + week.missed, 0) : null),
    ],
    state: [{ id: 'habit_current_streak', value: bestStreak ? bestStreak.current : null, detail: bestStreak && bestStreak.current > 0 ? bestStreak.name : undefined }],
    hasData: false,
  }

  // Learning effort (sessions only; saving or importing resources never counts)
  const questRows = (quests.data ?? []) as QuestRow[]
  const questById = new Map(questRows.map((quest) => [quest.id, quest]))
  const sessionRows = ((sessions.data ?? []) as SessionRow[]).map((row) => ({ ...row, date: local(row.started_at) }))
  const minutesItems = sessionRows.map((row) => ({ date: row.date, value: row.duration_minutes }))
  const currentWeekStart = weeks[weeks.length - 1]
  const targets = questRows.filter((quest) => quest.weekly_target_minutes && (quest.status === 'active' || quest.status === 'paused'))
  const targetsMet = targets.filter((quest) => {
    const minutes = sessionRows.filter((row) => row.quest_id === quest.id && row.date >= currentWeekStart && row.date <= today).reduce((sum, row) => sum + row.duration_minutes, 0)
    return minutes >= (quest.weekly_target_minutes ?? Infinity)
  }).length
  const pillarOf = (row: SessionRow) => {
    const pillar = row.quest_id ? questById.get(row.quest_id)?.pillar : row.pillar
    return pillar ? PILLAR_LABELS[pillar as keyof typeof PILLAR_LABELS] ?? pillar : 'No pillar'
  }
  const learningEffort: AnalyticsGroupData = {
    group: 'learning_effort',
    events: [
      event('learning_minutes', sumByWeek(minutesItems, weeks, today)),
      event('learning_sessions', countByWeek(sessionRows.map((row) => row.date), weeks, today)),
      event('learning_active_days', distinctDaysByWeek(sessionRows.map((row) => row.date), weeks, today)),
    ],
    state: [{ id: 'learning_target_attainment', value: targets.length ? targetsMet : null, detail: targets.length ? `of ${targets.length} quest ${targets.length === 1 ? 'target' : 'targets'} met so far this week` : undefined }],
    breakdowns: [
      { title: 'By quest', unit: 'minutes', rows: breakdown(sessionRows.map((row) => ({ date: row.date, key: row.quest_id ? questById.get(row.quest_id)?.title ?? 'Quest' : 'Standalone', value: row.duration_minutes })), weeks, today) },
      { title: 'By pillar', unit: 'minutes', rows: breakdown(sessionRows.map((row) => ({ date: row.date, key: pillarOf(row), value: row.duration_minutes })), weeks, today) },
      { title: 'By type', unit: 'minutes', rows: breakdown(sessionRows.map((row) => ({ date: row.date, key: SESSION_TYPE_LABELS[row.session_type] ?? row.session_type, value: row.duration_minutes })), weeks, today) },
    ],
    hasData: false,
  }

  // Resource collection
  const addedRows = ((resourcesAdded.data ?? []) as ResourceRow[]).map((row) => ({ ...row, date: local(row.created_at) }))
  const importRows = ((imports.data ?? []) as Array<{ completed_at: string; items_duplicate: number }>).map((row) => ({ date: local(row.completed_at), duplicates: row.items_duplicate }))
  const attachedCount = new Set(((attached.data ?? []) as Array<{ resource_id: string }>).map((row) => row.resource_id)).size
  const collection: AnalyticsGroupData = {
    group: 'collection',
    events: [
      event('resources_added', countByWeek(addedRows.map((row) => row.date), weeks, today)),
      event('imports_completed', countByWeek(importRows.map((row) => row.date), weeks, today)),
      event('import_duplicates', sumByWeek(importRows.map((row) => ({ date: row.date, value: row.duplicates })), weeks, today)),
    ],
    state: [
      { id: 'resource_backlog', value: backlog.error ? null : backlog.count ?? 0 },
      { id: 'resources_attached', value: attached.error ? null : attachedCount },
    ],
    breakdowns: [{ title: 'Added by origin', unit: 'count', rows: breakdown(addedRows.map((row) => ({ date: row.date, key: ORIGIN_LABELS[row.origin] ?? row.origin, value: 1 })), weeks, today) }],
    hasData: false,
  }

  // Learning progress
  const objectiveRows = (objectives.data ?? []) as Array<{ quest_id: string; achieved_at: string | null }>
  const milestoneRows = (questMilestones.data ?? []) as Array<{ quest_id: string; completed_at: string | null }>
  const structured = questRows
    .filter((quest) => quest.structure === 'structured' && quest.status !== 'completed')
    .map((quest) => ({
      quest,
      progress: getQuestProgress({ structure: 'structured', objectives: objectiveRows.filter((o) => o.quest_id === quest.id), milestones: milestoneRows.filter((m) => m.quest_id === quest.id) }),
    }))
    .filter(({ progress }) => progress.kind === 'milestones' && progress.percent !== null)
  const progressValues = structured.map(({ progress }) => (progress.kind === 'milestones' ? progress.percent ?? 0 : 0))
  const learningProgress: AnalyticsGroupData = {
    group: 'learning_progress',
    events: [
      event('resources_completed', countByWeek(((resourcesCompleted.data ?? []) as Array<{ completed_at: string }>).map((row) => local(row.completed_at)), weeks, today)),
      event('objectives_achieved', countByWeek(objectiveRows.flatMap((row) => (row.achieved_at ? [local(row.achieved_at)] : [])), weeks, today)),
      event('quest_milestones_completed', countByWeek(milestoneRows.flatMap((row) => (row.completed_at ? [local(row.completed_at)] : [])), weeks, today)),
      event('quests_completed', countByWeek(questRows.flatMap((quest) => (quest.completed_at ? [local(quest.completed_at)] : [])), weeks, today)),
    ],
    state: [{
      id: 'quest_progress',
      value: progressValues.length ? Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length) : null,
      detail: progressValues.length ? `average milestone completion across ${progressValues.length} open structured ${progressValues.length === 1 ? 'quest' : 'quests'}` : undefined,
    }],
    hasData: false,
  }

  const groups = [productivity, habits, learningEffort, collection, learningProgress].map((group) => ({
    ...group,
    hasData: group.events.some((metric) => metric.series.some((value) => value !== null && value > 0)) || group.state.some((metric) => metric.value !== null && metric.value > 0),
  }))

  return { today, timeZone, weeks, groups, hasLoadError, truncated }
}
