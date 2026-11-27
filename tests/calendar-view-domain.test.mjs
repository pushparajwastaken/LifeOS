import assert from 'node:assert/strict'
import test from 'node:test'
import { calendarHref, describeDay, monthGrid, parseMonth, parseSelectedDay, shiftMonth, summarizeDays } from '../features/calendar/calendar-view-domain.ts'

const TODAY = '2026-11-27'

test('month parsing and shifting', () => {
  assert.equal(parseMonth(undefined, TODAY), '2026-11')
  assert.equal(parseMonth('2027-02', TODAY), '2027-02')
  for (const bad of ['2026-13', '2026-1', 'x', '2040-01', '1999-12']) assert.equal(parseMonth(bad, TODAY), '2026-11', bad)
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.equal(shiftMonth('2026-03', -1), '2026-02')
})

test('grids are six Monday-first weeks covering the month', () => {
  const november = monthGrid('2026-11') // 1 Nov 2026 is a Sunday
  assert.equal(november.length, 42)
  assert.equal(november[0], '2026-10-26')
  assert.equal(new Date(`${november[0]}T00:00:00Z`).getUTCDay(), 1)
  assert.ok(november.includes('2026-11-01') && november.includes('2026-11-30'))
  const february = monthGrid('2027-02') // 1 Feb 2027 is a Monday
  assert.equal(february[0], '2027-02-01')
  assert.equal(february[41], '2027-03-14')
})

test('selected day stays inside the grid', () => {
  assert.equal(parseSelectedDay(undefined, '2026-11', TODAY), TODAY)
  assert.equal(parseSelectedDay(undefined, '2026-12', TODAY), '2026-12-01')
  assert.equal(parseSelectedDay('2026-10-28', '2026-11', TODAY), '2026-10-28') // visible leading day
  assert.equal(parseSelectedDay('2026-09-01', '2026-11', TODAY), TODAY)
  assert.equal(parseSelectedDay('2026-11-31', '2026-11', TODAY), TODAY)
})

test('day summaries and descriptions', () => {
  const days = summarizeDays([
    { kind: 'task_due', date: TODAY, title: 'a' },
    { kind: 'task_due', date: TODAY, title: 'b' },
    { kind: 'task_done', date: TODAY, title: 'c' },
    { kind: 'learning', date: TODAY, title: 'd', minutes: 25 },
    { kind: 'learning', date: TODAY, title: 'e', minutes: 20 },
    { kind: 'run', date: TODAY, title: 'f' },
    { kind: 'rest', date: '2026-11-26', title: 'g' },
    { kind: 'goal_end', date: '2026-11-30', title: 'h' },
    { kind: 'quest_milestone', date: '2026-11-30', title: 'i' },
  ])
  assert.deepEqual(days.get(TODAY), { due: 2, done: 1, learningMinutes: 45, training: 1, rest: 0, deadlines: 0, total: 6 })
  assert.equal(describeDay(days.get(TODAY)), '2 tasks due, 1 done, 45 min learning, 1 training session')
  assert.equal(describeDay(days.get('2026-11-26')), 'rest day')
  assert.equal(describeDay(days.get('2026-11-30')), '2 deadlines')
  assert.equal(describeDay(undefined), 'Nothing recorded')
})

test('links omit the current month', () => {
  assert.equal(calendarHref('2026-11', null, '2026-11'), '/calendar')
  assert.equal(calendarHref('2026-11', '2026-11-05', '2026-11'), '/calendar?day=2026-11-05')
  assert.equal(calendarHref('2026-12', null, '2026-11'), '/calendar?month=2026-12')
})
