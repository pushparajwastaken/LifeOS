// Life Analytics (M5): metric catalogue and pure weekly aggregation helpers.
// Self-contained (no `@/` imports) so it can be unit-tested with node:test directly.
// Contract: docs/ANALYTICS_METRICS.md.

export const ANALYTICS_WEEKS = 12

export const METRIC_KINDS = ['event_exact', 'event_approximate', 'current_state'] as const
export type MetricKind = (typeof METRIC_KINDS)[number]

export const APPROXIMATION_REASONS = ['editable_timestamp', 'undoable', 'mutable_config', 'automatic_purge'] as const
export type ApproximationReason = (typeof APPROXIMATION_REASONS)[number]

export const APPROXIMATION_NOTES: Record<ApproximationReason, string> = {
  editable_timestamp: 'Dates can be edited after the fact, so past weeks may shift.',
  undoable: 'Completions can be undone, so past weeks may shrink.',
  mutable_config: 'Editing a schedule re-scores earlier weeks.',
  automatic_purge: 'Expired or purged source data is no longer counted.',
}

export const METRIC_GROUPS = ['productivity', 'habits', 'learning_effort', 'collection', 'learning_progress'] as const
export type MetricGroup = (typeof METRIC_GROUPS)[number]

export const METRIC_GROUP_LABELS: Record<MetricGroup, { title: string; summary: string }> = {
  productivity: { title: 'Productivity', summary: 'Tasks and goals you moved forward.' },
  habits: { title: 'Habit consistency', summary: 'How often scheduled habits were done. Rest days are excluded and today is never counted as missed.' },
  learning_effort: { title: 'Learning effort', summary: 'Time you actually spent learning, from your learning log.' },
  collection: { title: 'Resource collection', summary: 'What you saved and imported. Collecting is not learning, so none of this counts as effort.' },
  learning_progress: { title: 'Learning progress', summary: 'Resources, objectives, milestones and quests you finished.' },
}

type MetricDefinition = { group: MetricGroup; label: string; kind: MetricKind; reasons: readonly ApproximationReason[]; unit?: 'minutes' | 'percent' }

const def = (group: MetricGroup, label: string, kind: MetricKind, reasons: readonly ApproximationReason[] = [], unit?: MetricDefinition['unit']): MetricDefinition =>
  ({ group, label, kind, reasons, unit })

/** The approved metric catalogue. Every metric declares exactly one kind; groups are never combined into a score. */
export const METRICS = {
  tasks_completed: def('productivity', 'Tasks completed', 'event_approximate', ['undoable']),
  tasks_on_time_rate: def('productivity', 'Completed on time', 'event_approximate', ['undoable', 'editable_timestamp'], 'percent'),
  goal_progress_updates: def('productivity', 'Goal progress updates', 'event_approximate', ['editable_timestamp']),
  goal_milestones_completed: def('productivity', 'Goal milestones reached', 'event_approximate', ['undoable']),
  tasks_overdue: def('productivity', 'Overdue tasks', 'current_state'),
  goals_completed: def('productivity', 'Goals completed', 'current_state'),
  habit_consistency: def('habits', 'Consistency', 'event_approximate', ['mutable_config'], 'percent'),
  habit_missed: def('habits', 'Missed check-ins', 'event_approximate', ['mutable_config']),
  habit_current_streak: def('habits', 'Best current streak', 'current_state'),
  learning_minutes: def('learning_effort', 'Learning time', 'event_approximate', ['editable_timestamp'], 'minutes'),
  learning_sessions: def('learning_effort', 'Sessions', 'event_approximate', ['editable_timestamp']),
  learning_active_days: def('learning_effort', 'Active days', 'event_approximate', ['editable_timestamp']),
  learning_target_attainment: def('learning_effort', 'Weekly targets this week', 'current_state'),
  resources_added: def('collection', 'Resources added', 'event_approximate', ['automatic_purge']),
  import_duplicates: def('collection', 'Duplicate matches on import', 'event_approximate', ['automatic_purge']),
  imports_completed: def('collection', 'Imports completed', 'event_exact'),
  resource_backlog: def('collection', 'Backlog (to learn)', 'current_state'),
  resources_attached: def('collection', 'Attached to a quest', 'current_state'),
  resources_completed: def('learning_progress', 'Resources completed', 'event_approximate', ['undoable']),
  objectives_achieved: def('learning_progress', 'Objectives achieved', 'event_approximate', ['undoable']),
  quest_milestones_completed: def('learning_progress', 'Quest milestones completed', 'event_approximate', ['undoable']),
  quests_completed: def('learning_progress', 'Quests completed', 'event_approximate', ['undoable']),
  quest_progress: def('learning_progress', 'Structured quest progress', 'current_state', [], 'percent'),
} as const satisfies Record<string, MetricDefinition>

export type MetricId = keyof typeof METRICS

// ---------------------------------------------------------------------------
// Dates: local date keys (YYYY-MM-DD) in the profile timezone; weeks start Monday.
// ---------------------------------------------------------------------------

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

function parseKey(key: string): Date {
  if (!DATE_KEY.test(key)) throw new Error(`invalid date key: ${key}`)
  return new Date(`${key}T00:00:00Z`)
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(key: string, days: number): string {
  const date = parseKey(key)
  date.setUTCDate(date.getUTCDate() + days)
  return toKey(date)
}

/** Monday of the week containing `key`. */
export function weekStartOf(key: string): string {
  const weekday = parseKey(key).getUTCDay() // 0 = Sunday
  return addDays(key, -((weekday + 6) % 7))
}

/** The `weeks` Monday keys ending with the current week, oldest first. */
export function weekWindow(today: string, weeks = ANALYTICS_WEEKS): string[] {
  const current = weekStartOf(today)
  return Array.from({ length: weeks }, (_, index) => addDays(current, (index - weeks + 1) * 7))
}

/** Local calendar date of an instant in `timeZone`. */
export function localDateKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Index of the window week containing `dateKey`, or -1 outside the window (including future dates). */
export function weekIndex(dateKey: string, weeks: readonly string[], today: string): number {
  if (dateKey > today || weeks.length === 0 || dateKey < weeks[0]) return -1
  return weeks.indexOf(weekStartOf(dateKey))
}

// ---------------------------------------------------------------------------
// Weekly series. Event series never contain current_state metrics.
// ---------------------------------------------------------------------------

export type WeeklySeries = (number | null)[]

export function countByWeek(dateKeys: readonly string[], weeks: readonly string[], today: string): number[] {
  return sumByWeek(dateKeys.map((date) => ({ date, value: 1 })), weeks, today)
}

export function sumByWeek(items: ReadonlyArray<{ date: string; value: number }>, weeks: readonly string[], today: string): number[] {
  const totals = weeks.map(() => 0)
  for (const { date, value } of items) {
    const index = weekIndex(date, weeks, today)
    if (index >= 0) totals[index] += value
  }
  return totals
}

export function distinctDaysByWeek(dateKeys: readonly string[], weeks: readonly string[], today: string): number[] {
  return countByWeek([...new Set(dateKeys)], weeks, today)
}

/** Share of hits per week as a whole percentage; null (blank, not 0%) when a week has no eligible items. */
export function rateByWeek(items: ReadonlyArray<{ date: string; hit: boolean }>, weeks: readonly string[], today: string): WeeklySeries {
  const hits = sumByWeek(items.map(({ date, hit }) => ({ date, value: hit ? 1 : 0 })), weeks, today)
  const totals = countByWeek(items.map(({ date }) => date), weeks, today)
  return totals.map((total, index) => (total === 0 ? null : Math.round((hits[index] / total) * 100)))
}

/** Sum of a count series; for rate series use `pooledRate` instead. */
export function seriesTotal(series: readonly number[]): number {
  return series.reduce((sum, value) => sum + value, 0)
}

/** Overall rate across the window from the raw items (not an average of weekly rates). */
export function pooledRate(items: ReadonlyArray<{ date: string; hit: boolean }>, weeks: readonly string[], today: string): number | null {
  const inWindow = items.filter(({ date }) => weekIndex(date, weeks, today) >= 0)
  if (inWindow.length === 0) return null
  return Math.round((inWindow.filter(({ hit }) => hit).length / inWindow.length) * 100)
}

/** Totals per key within the window, largest first; ties keep label order. */
export function breakdown(items: ReadonlyArray<{ date: string; key: string; value: number }>, weeks: readonly string[], today: string, limit = 6): Array<{ key: string; value: number }> {
  const totals = new Map<string, number>()
  for (const { date, key, value } of items) {
    if (weekIndex(date, weeks, today) < 0) continue
    totals.set(key, (totals.get(key) ?? 0) + value)
  }
  return [...totals.entries()]
    .map(([key, value]) => ({ key, value }))
    .filter(({ value }) => value > 0)
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
    .slice(0, limit)
}

/** A task is on time when it was completed at or before its due instant (completed_at <= due_at). */
export function isCompletedOnTime(completedAt: string, dueAt: string): boolean {
  return new Date(completedAt).getTime() <= new Date(dueAt).getTime()
}

/** Distinct approximation reasons for a set of metrics, for the group footnote. */
export function footnoteReasons(ids: readonly MetricId[]): ApproximationReason[] {
  const reasons = new Set<ApproximationReason>()
  for (const id of ids) for (const reason of METRICS[id].reasons) reasons.add(reason)
  return APPROXIMATION_REASONS.filter((reason) => reasons.has(reason))
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

// ---------------------------------------------------------------------------
// Historical comparison (M9): last full week against the usual level of the four weeks before it.
// Shown only where the history makes it meaningful; never a score, never coloured good/bad.
// ---------------------------------------------------------------------------

export const COMPARISON_BASELINE_WEEKS = 4

/** Metrics that get a "last week vs usual" line. Sporadic or bad-news-only series (imports, missed check-ins) are left out. */
export const COMPARABLE_METRICS: Partial<Record<MetricId, 'rate' | 'count'>> = {
  tasks_completed: 'count',
  tasks_on_time_rate: 'rate',
  goal_progress_updates: 'count',
  habit_consistency: 'rate',
  learning_minutes: 'count',
  learning_sessions: 'count',
  learning_active_days: 'count',
  resources_added: 'count',
  resources_completed: 'count',
}

export type WeekComparison = {
  lastWeek: number
  usual: number
  direction: 'higher' | 'lower' | 'similar'
}

/**
 * Compares the last full week (the week before the current one) with the mean of the
 * COMPARISON_BASELINE_WEEKS weeks before it.
 * - Rates (`kind: 'rate'`, null = nothing to measure): needs last week measured and at least 3 of the 4 baseline weeks.
 * - Counts and sums: needs the user's first recorded activity in the window to be on or before the first baseline
 *   week, so weeks before they started using a feature are never read as zero effort.
 * "Similar" means within 5 percentage points (rates) or within 10% of the usual level and less than one unit.
 */
export function compareLastWeek(series: WeeklySeries, kind: 'rate' | 'count'): WeekComparison | null {
  const lastIndex = series.length - 2
  const firstBaseline = lastIndex - COMPARISON_BASELINE_WEEKS
  if (firstBaseline < 0) return null
  const lastWeek = series[lastIndex]
  if (lastWeek === null || lastWeek === undefined) return null
  const baseline = series.slice(firstBaseline, lastIndex)
  let usual: number
  if (kind === 'rate') {
    const measured = baseline.filter((value): value is number => value !== null)
    if (measured.length < COMPARISON_BASELINE_WEEKS - 1) return null
    usual = Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length)
  } else {
    const firstActive = series.findIndex((value) => value !== null && value > 0)
    if (firstActive === -1 || firstActive > firstBaseline) return null
    usual = Math.round((baseline.reduce<number>((sum, value) => sum + (value ?? 0), 0) / baseline.length) * 10) / 10
  }
  const delta = lastWeek - usual
  const similar = kind === 'rate' ? Math.abs(delta) <= 5 : Math.abs(delta) < 1 || Math.abs(delta) <= usual * 0.1
  return { lastWeek, usual, direction: similar ? 'similar' : delta > 0 ? 'higher' : 'lower' }
}
