import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addDateDays,
  getHabitStreaks,
  getLocalDateKey,
  getPeriodMetrics,
  getWeekStart,
  getWeekdayIndex,
  isHabitScheduledOnDate,
  normalizeHabitSchedule,
} from '../features/habits/habit-domain.ts'

function makeHabit({ daysOfWeek = [1, 3, 5], startDate = '2026-11-02', endDate = null, active = true } = {}) {
  const createdAt = `${startDate}T12:00:00.000Z`
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Walk',
    description: null,
    pillar: 'physical',
    cadence_type: 'custom',
    schedule: normalizeHabitSchedule({ daysOfWeek, startDate, endDate }, 'custom', createdAt, 'UTC'),
    tracking_type: 'boolean',
    target_value: null,
    unit: null,
    active,
    created_at: createdAt,
    updated_at: createdAt,
  }
}

function makeLog(habit, date, status = 'completed') {
  return {
    id: `${habit.id}-${date}`,
    habit_id: habit.id,
    log_date: date,
    status,
    value: null,
    duration_seconds: null,
    skipped_reason: null,
    note: null,
    created_at: `${date}T12:00:00.000Z`,
    updated_at: `${date}T12:00:00.000Z`,
  }
}

test('local date keys respect configured timezone boundaries', () => {
  assert.equal(getLocalDateKey(new Date('2026-11-12T07:30:00.000Z'), 'America/Los_Angeles'), '2026-11-11')
  assert.equal(getLocalDateKey(new Date('2026-11-12T08:30:00.000Z'), 'America/Los_Angeles'), '2026-11-12')
})

test('date-only arithmetic remains stable across month and week boundaries', () => {
  assert.equal(addDateDays('2026-11-30', 1), '2026-12-01')
  assert.equal(getWeekStart('2026-11-12'), '2026-11-09')
  assert.equal(getWeekdayIndex('2026-11-08'), 0)
})

test('weekday schedules exclude unscheduled dates and respect inclusive date bounds', () => {
  const habit = makeHabit({ daysOfWeek: [1, 3, 5], startDate: '2026-11-02', endDate: '2026-11-20' })
  assert.equal(isHabitScheduledOnDate(habit, '2026-11-02'), true)
  assert.equal(isHabitScheduledOnDate(habit, '2026-11-03'), false)
  assert.equal(isHabitScheduledOnDate(habit, '2026-11-21'), false)
})

test('weekly metrics count scheduled opportunities only and keep partial separate', () => {
  const habit = makeHabit({ daysOfWeek: [1, 3, 5], startDate: '2026-11-02' })
  const logs = [makeLog(habit, '2026-11-02'), makeLog(habit, '2026-11-04', 'partial'), makeLog(habit, '2026-11-06', 'skipped')]
  const metrics = getPeriodMetrics(habit, logs, '2026-11-02', '2026-11-08', '2026-11-08')
  assert.deepEqual(metrics, { opportunities: 3, completed: 1, partial: 1, skipped: 1, missed: 0, percentage: 33 })
})

test('streaks ignore unscheduled days, but a missed scheduled day breaks the run', () => {
  const habit = makeHabit({ daysOfWeek: [1, 3, 5], startDate: '2026-11-02' })
  const logs = [
    makeLog(habit, '2026-11-02'),
    makeLog(habit, '2026-11-04'),
    makeLog(habit, '2026-11-06'),
    makeLog(habit, '2026-11-09'),
  ]
  assert.deepEqual(getHabitStreaks(habit, logs, '2026-11-10'), { current: 4, longest: 4 })
  const withMiss = [...logs, makeLog(habit, '2026-11-11', 'skipped')]
  assert.deepEqual(getHabitStreaks(habit, withMiss, '2026-11-11'), { current: 0, longest: 4 })
})

test('an open current-day opportunity does not prematurely end the prior streak', () => {
  const habit = makeHabit({ daysOfWeek: [1, 3, 5], startDate: '2026-11-02' })
  const logs = [makeLog(habit, '2026-11-09'), makeLog(habit, '2026-11-11')]
  assert.equal(getHabitStreaks(habit, logs, '2026-11-13').current, 2)
})
