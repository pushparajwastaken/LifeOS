export const HABIT_PILLARS = [
  'physical',
  'intellectual',
  'academic',
  'professional',
  'communication',
  'personal',
] as const

export const PILLAR_LABELS: Record<(typeof HABIT_PILLARS)[number], string> = {
  physical: 'Physical',
  intellectual: 'Intellectual',
  academic: 'Academic',
  professional: 'Professional',
  communication: 'Communication',
  personal: 'Personal',
}

export const WEEKDAYS = [
  { value: 0, short: 'Sun', long: 'Sunday' },
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
] as const

export const FAILURE_REASONS = [
  { value: 'forgot', label: 'I forgot' },
  { value: 'no-time', label: 'I ran out of time' },
  { value: 'too-tired', label: 'I was too tired' },
  { value: 'low-motivation', label: 'I did not feel motivated' },
  { value: 'poor-planning', label: 'I did not plan for it' },
  { value: 'environment', label: 'My environment got in the way' },
  { value: 'too-difficult', label: 'The habit felt too difficult' },
  { value: 'interruption', label: 'Something unexpected interrupted me' },
  { value: 'other', label: 'Something else' },
] as const

export type HabitPillar = (typeof HABIT_PILLARS)[number]
export type HabitTrackingType = 'boolean' | 'numeric' | 'duration'
export type HabitCadence = 'daily' | 'weekly' | 'custom'
export type HabitLogStatus = 'completed' | 'partial' | 'skipped' | 'rest'
export type FailureReason = (typeof FAILURE_REASONS)[number]['value']

export type BehaviorDesign = {
  identity: string
  cue: string
  craving: string
  routine: string
  reward: string
  stackAfterHabitId: string
  twoMinuteVersion: string
  smallestCompletion: string
  environmentPrep: string
  friction: string
  environmentChange: string
  obvious: string
  attractive: string
  easy: string
  satisfying: string
  isKeystone: boolean
  relatedHabitIds: string[]
}

export type HabitSchedule = {
  version: 1
  daysOfWeek: number[]
  startDate: string
  endDate: string | null
  archivedAt: string | null
  timeOfDay: string
  location: string
  behavior: BehaviorDesign
  [key: string]: unknown
}

export type Habit = {
  id: string
  name: string
  description: string | null
  pillar: string
  cadence_type: HabitCadence
  schedule: HabitSchedule
  tracking_type: HabitTrackingType
  target_value: number | null
  unit: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type HabitLog = {
  id: string
  habit_id: string
  log_date: string
  status: HabitLogStatus
  value: number | null
  duration_seconds: number | null
  skipped_reason: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export type PeriodMetrics = {
  opportunities: number
  completed: number
  partial: number
  skipped: number
  missed: number
  percentage: number | null
}

export type HabitLogMap = Map<string, HabitLog>

export type HabitReflection = {
  prevented: string
  systemArea: string
  adjustment: string
  additionalNote: string
}

export const EMPTY_BEHAVIOR: BehaviorDesign = {
  identity: '',
  cue: '',
  craving: '',
  routine: '',
  reward: '',
  stackAfterHabitId: '',
  twoMinuteVersion: '',
  smallestCompletion: '',
  environmentPrep: '',
  friction: '',
  environmentChange: '',
  obvious: '',
  attractive: '',
  easy: '',
  satisfying: '',
  isKeystone: false,
  relatedHabitIds: [],
}

const weekdayByName = new Map<string, number>([
  ['sun', 0], ['sunday', 0], ['mon', 1], ['monday', 1], ['tue', 2], ['tues', 2], ['tuesday', 2],
  ['wed', 3], ['wednesday', 3], ['thu', 4], ['thur', 4], ['thurs', 4], ['thursday', 4],
  ['fri', 5], ['friday', 5], ['sat', 6], ['saturday', 6],
])

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeTimeZone(value: string | null | undefined): string {
  if (!value) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return value
  } catch {
    return 'UTC'
  }
}

export function getLocalDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function addDateDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function getWeekdayIndex(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function getWeekStart(dateKey: string): string {
  const weekday = getWeekdayIndex(dateKey)
  return addDateDays(dateKey, -((weekday + 6) % 7))
}

export function getMonthStart(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`
}

export function formatDateKey(dateKey: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  if (!isDateKey(dateKey)) return dateKey
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

function normalizeWeekdays(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null
  const days = value.flatMap((entry) => {
    if (typeof entry === 'number' && Number.isInteger(entry) && entry >= 0 && entry <= 6) return [entry]
    if (typeof entry === 'string') {
      const weekday = weekdayByName.get(entry.trim().toLowerCase())
      return weekday === undefined ? [] : [weekday]
    }
    return []
  })
  return [...new Set(days)].sort((a, b) => a - b)
}

function normalizeBehavior(value: unknown): BehaviorDesign {
  const source = asRecord(value)
  return {
    identity: text(source.identity),
    cue: text(source.cue),
    craving: text(source.craving),
    routine: text(source.routine),
    reward: text(source.reward),
    stackAfterHabitId: text(source.stackAfterHabitId),
    twoMinuteVersion: text(source.twoMinuteVersion),
    smallestCompletion: text(source.smallestCompletion),
    environmentPrep: text(source.environmentPrep),
    friction: text(source.friction),
    environmentChange: text(source.environmentChange),
    obvious: text(source.obvious),
    attractive: text(source.attractive),
    easy: text(source.easy),
    satisfying: text(source.satisfying),
    isKeystone: source.isKeystone === true,
    relatedHabitIds: Array.isArray(source.relatedHabitIds)
      ? [...new Set(source.relatedHabitIds.filter((id): id is string => typeof id === 'string' && id.length <= 64))]
      : [],
  }
}

export function normalizeHabitSchedule(
  value: unknown,
  cadenceType: string,
  createdAt: string,
  timeZone: string,
): HabitSchedule {
  const source = asRecord(value)
  const localCreatedDate = getLocalDateKey(new Date(createdAt), timeZone)
  const sourceDays = normalizeWeekdays(source.daysOfWeek ?? source.weekdays ?? source.days)
  const daysOfWeek = sourceDays ?? (cadenceType === 'daily'
    ? [0, 1, 2, 3, 4, 5, 6]
    : cadenceType === 'weekly'
      ? [getWeekdayIndex(localCreatedDate)]
      : [])
  const startDateValue = text(source.startDate)
  const endDateValue = text(source.endDate)
  const archivedAtValue = text(source.archivedAt)

  return {
    ...source,
    version: 1,
    daysOfWeek,
    startDate: isDateKey(startDateValue) ? startDateValue : localCreatedDate,
    endDate: isDateKey(endDateValue) ? endDateValue : null,
    archivedAt: isDateKey(archivedAtValue) ? archivedAtValue : null,
    timeOfDay: text(source.timeOfDay),
    location: text(source.location),
    behavior: normalizeBehavior(source.behavior),
  }
}

export function isHabitScheduledOnDate(habit: Pick<Habit, 'schedule' | 'cadence_type' | 'created_at'>, dateKey: string): boolean {
  if (!isDateKey(dateKey)) return false
  const schedule = habit.schedule
  if (dateKey < schedule.startDate || (schedule.endDate && dateKey > schedule.endDate)) return false
  if (schedule.daysOfWeek.length === 0) return false
  return schedule.daysOfWeek.includes(getWeekdayIndex(dateKey))
}

export function getHabitEffectiveEndDate(habit: Habit, today: string, logs: HabitLog[] = []): string {
  const bounds = [today]
  if (habit.schedule.endDate) bounds.push(habit.schedule.endDate)
  if (!habit.active) {
    if (habit.schedule.archivedAt) bounds.push(habit.schedule.archivedAt)
    else if (logs.length > 0) bounds.push(logs.reduce((latest, log) => log.log_date > latest ? log.log_date : latest, logs[0].log_date))
    else bounds.push(addDateDays(habit.schedule.startDate, -1))
  }
  return bounds.reduce((earliest, current) => current < earliest ? current : earliest)
}

export function isHabitEnded(habit: Habit, today: string): boolean {
  return Boolean(habit.schedule.endDate && habit.schedule.endDate < today)
}

export function getNextScheduledDate(habit: Habit, today: string, maxDays = 366): string | null {
  for (let offset = 1; offset <= maxDays; offset += 1) {
    const candidate = addDateDays(today, offset)
    if (habit.schedule.endDate && candidate > habit.schedule.endDate) return null
    if (isHabitScheduledOnDate(habit, candidate)) return candidate
  }
  return null
}

export function getLatestUnloggedScheduledDate(habit: Habit, logs: HabitLog[], today: string, maxDays = 3650): string | null {
  const logMap = makeHabitLogMap(logs)
  const end = getHabitEffectiveEndDate(habit, today, logs)
  const earliest = addDateDays(today, -maxDays) > habit.schedule.startDate ? addDateDays(today, -maxDays) : habit.schedule.startDate
  for (let date = end; date >= earliest; date = addDateDays(date, -1)) {
    if (!isHabitScheduledOnDate(habit, date)) continue
    const log = logMap.get(`${habit.id}:${date}`)
    if (!log || log.status === 'skipped') return date
  }
  return null
}

export function makeHabitLogMap(logs: HabitLog[]): Map<string, HabitLog> {
  return new Map(logs.map((log) => [`${log.habit_id}:${log.log_date}`, log]))
}

function emptyMetrics(): PeriodMetrics {
  return { opportunities: 0, completed: 0, partial: 0, skipped: 0, missed: 0, percentage: null }
}

export function getPeriodMetrics(
  habit: Habit,
  logs: HabitLog[],
  startDate: string,
  endDate: string,
  today: string,
): PeriodMetrics {
  const start = startDate > habit.schedule.startDate ? startDate : habit.schedule.startDate
  const effectiveEnd = getHabitEffectiveEndDate(habit, today, logs)
  const end = endDate < effectiveEnd ? endDate : effectiveEnd
  if (end < start) return emptyMetrics()

  const logMap = makeHabitLogMap(logs)
  const metrics = emptyMetrics()
  for (let date = start; date <= end; date = addDateDays(date, 1)) {
    if (!isHabitScheduledOnDate(habit, date)) continue
    const log = logMap.get(`${habit.id}:${date}`)
    if (log?.status === 'rest') continue
    metrics.opportunities += 1
    if (log?.status === 'completed') metrics.completed += 1
    else if (log?.status === 'partial') metrics.partial += 1
    else if (log?.status === 'skipped') metrics.skipped += 1
    else if (date < today) metrics.missed += 1
  }
  metrics.percentage = metrics.opportunities > 0
    ? Math.round((metrics.completed / metrics.opportunities) * 100)
    : null
  return metrics
}

export function getHabitStreaks(habit: Habit, logs: HabitLog[], today: string): { current: number; longest: number } {
  const logMap = makeHabitLogMap(logs)
  const end = getHabitEffectiveEndDate(habit, today, logs)
  if (end < habit.schedule.startDate) return { current: 0, longest: 0 }

  let longest = 0
  let run = 0
  for (let date = habit.schedule.startDate; date <= end; date = addDateDays(date, 1)) {
    if (!isHabitScheduledOnDate(habit, date)) continue
    const status = logMap.get(`${habit.id}:${date}`)?.status
    if (status === 'rest') continue
    if (status === 'completed') {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 0
    }
  }

  let current = 0
  let cursor = end
  const todayLog = logMap.get(`${habit.id}:${today}`)
  if (today === end && isHabitScheduledOnDate(habit, today) && (!todayLog || todayLog.status === 'partial' || todayLog.status === 'rest')) {
    cursor = addDateDays(cursor, -1)
  } else if (today === end && todayLog?.status === 'skipped') {
    return { current: 0, longest }
  }

  for (let date = cursor; date >= habit.schedule.startDate; date = addDateDays(date, -1)) {
    if (!isHabitScheduledOnDate(habit, date)) continue
    const status = logMap.get(`${habit.id}:${date}`)?.status
    if (status === 'rest') continue
    if (status !== 'completed') break
    current += 1
  }
  return { current, longest }
}

export function getWeeklySeries(habits: Habit[], logs: HabitLog[], today: string, weeks = 12) {
  const startOfCurrentWeek = getWeekStart(today)
  return Array.from({ length: weeks }, (_, index) => {
    const startDate = addDateDays(startOfCurrentWeek, (index - weeks + 1) * 7)
    const endDate = addDateDays(startDate, 6) < today ? addDateDays(startDate, 6) : today
    const metrics = habits.reduce((total, habit) => {
      const habitLogs = logs.filter((log) => log.habit_id === habit.id)
      const next = getPeriodMetrics(habit, habitLogs, startDate, endDate, today)
      total.opportunities += next.opportunities
      total.completed += next.completed
      total.partial += next.partial
      total.missed += next.missed
      return total
    }, { opportunities: 0, completed: 0, partial: 0, missed: 0 })
    return {
      startDate,
      label: formatDateKey(startDate, { month: 'short', day: 'numeric' }),
      ...metrics,
      percentage: metrics.opportunities ? Math.round((metrics.completed / metrics.opportunities) * 100) : null,
    }
  })
}

export function getMonthlySeries(habit: Habit, logs: HabitLog[], today: string, months = 6) {
  const [year, month] = today.split('-').map(Number)
  return Array.from({ length: months }, (_, index) => {
    const first = new Date(Date.UTC(year, month - 1 - (months - 1 - index), 1))
    const startDate = `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-01`
    const nextMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
    const monthEnd = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}-${String(nextMonth.getUTCDate()).padStart(2, '0')}`
    const endDate = monthEnd < today ? monthEnd : today
    const metrics = getPeriodMetrics(habit, logs, startDate, endDate, today)
    return { startDate, label: formatDateKey(startDate, { month: 'short' }), ...metrics }
  })
}

export function getCalendarDays(habit: Habit, logs: HabitLog[], today: string, days = 182) {
  const firstDate = addDateDays(today, -(days - 1))
  const effectiveEnd = getHabitEffectiveEndDate(habit, today, logs)
  const logMap = makeHabitLogMap(logs)
  const entries: Array<{ date: string; scheduled: boolean; status: HabitLogStatus | 'missed' | 'upcoming' | 'unscheduled' }> = []
  for (let date = firstDate; date <= today; date = addDateDays(date, 1)) {
    const scheduled = date <= effectiveEnd && isHabitScheduledOnDate(habit, date)
    const log = logMap.get(`${habit.id}:${date}`)
    const status = !scheduled
      ? 'unscheduled'
      : log?.status ?? (date < today ? 'missed' : 'upcoming')
    entries.push({ date, scheduled, status })
  }
  return entries
}

export function getWeekdayPerformance(habit: Habit, logs: HabitLog[], today: string, days = 180) {
  const start = addDateDays(today, -(days - 1))
  const logMap = makeHabitLogMap(logs)
  return WEEKDAYS.map((weekday) => {
    let opportunities = 0
    let completed = 0
    for (let date = start; date <= today; date = addDateDays(date, 1)) {
      if (getWeekdayIndex(date) !== weekday.value || !isHabitScheduledOnDate(habit, date)) continue
      const status = logMap.get(`${habit.id}:${date}`)?.status
      if (status === 'rest') continue
      opportunities += 1
      if (status === 'completed') completed += 1
    }
    return { ...weekday, opportunities, completed, percentage: opportunities ? Math.round((completed / opportunities) * 100) : null }
  })
}

export function getCommonFailureInsight(logs: HabitLog[]): { label: string; count: number; suggestion: string } | null {
  const counts = new Map<string, number>()
  for (const log of logs) {
    if (log.status === 'skipped' && log.skipped_reason) {
      counts.set(log.skipped_reason, (counts.get(log.skipped_reason) ?? 0) + 1)
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  if (!top || top[1] < 2) return null
  const label = FAILURE_REASONS.find(({ value }) => value === top[0])?.label ?? 'Another obstacle'
  const suggestion: Record<string, string> = {
    forgot: 'Try placing a visible cue beside a routine you already do.',
    'no-time': 'A shorter version or a different time may be worth testing.',
    'too-tired': 'Consider moving it to a higher-energy part of your day.',
    'low-motivation': 'Pair the routine with something you already enjoy.',
    'poor-planning': 'Choose a specific time, place and trigger for the next attempt.',
    environment: 'Prepare one small part of the environment in advance.',
    'too-difficult': 'Try the smallest acceptable version for a week.',
    interruption: 'Choose a backup cue for days when your routine changes.',
    other: 'Experiment with one small change, then notice whether it helps.',
  }
  return { label, count: top[1], suggestion: suggestion[top[0]] ?? suggestion.other }
}

export function getHabitWeekdayInsight(habit: Habit, logs: HabitLog[], today: string, days = 180): string | null {
  const performances = getWeekdayPerformance(habit, logs, today, days)
    .filter((day) => day.opportunities >= 4 && day.percentage !== null)
    .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
  const best = performances[0]
  if (!best || (best.percentage ?? 0) < 60) return null
  return `Observation, not a cause: ${best.completed} of ${best.opportunities} scheduled ${best.long.toLowerCase()} sessions were completed.`
}

export function serializeHabitReflection(reflection: HabitReflection): string {
  return JSON.stringify({ type: 'lifeos-habit-reflection', version: 1, ...reflection })
}

export function parseHabitReflection(note: string | null): HabitReflection | null {
  if (!note) return null
  try {
    const value = JSON.parse(note) as Record<string, unknown>
    if (value.type !== 'lifeos-habit-reflection' || value.version !== 1) return null
    return {
      prevented: text(value.prevented),
      systemArea: text(value.systemArea),
      adjustment: text(value.adjustment),
      additionalNote: text(value.additionalNote),
    }
  } catch {
    return null
  }
}

export function displayHabitLogNote(note: string | null): string | null {
  if (!note) return null
  if (parseHabitReflection(note)) return null
  return note
}

export function getFailureReasonLabel(reason: string | null): string {
  return FAILURE_REASONS.find(({ value }) => value === reason)?.label ?? (reason || 'Not recorded')
}

export function getRelatedHabitObservation(
  firstHabitId: string,
  secondHabitId: string,
  habits: Habit[],
  logs: HabitLog[],
  startDate: string,
  endDate: string,
): string | null {
  const first = habits.find(({ id }) => id === firstHabitId)
  const second = habits.find(({ id }) => id === secondHabitId)
  if (!first || !second) return null
  const map = makeHabitLogMap(logs)
  let sharedOpportunities = 0
  let sharedCompletions = 0
  for (let date = startDate; date <= endDate; date = addDateDays(date, 1)) {
    if (!isHabitScheduledOnDate(first, date) || !isHabitScheduledOnDate(second, date)) continue
    sharedOpportunities += 1
    if (map.get(`${first.id}:${date}`)?.status === 'completed' && map.get(`${second.id}:${date}`)?.status === 'completed') {
      sharedCompletions += 1
    }
  }
  if (sharedOpportunities < 4) return null
  return `On ${sharedCompletions} of ${sharedOpportunities} dates when both were scheduled, both were completed. This is a user-defined pairing and an observed pattern, not evidence of cause.`
}
