import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TASK_PILLARS,
  TASK_TRANSITIONS,
  dueWallClock,
  escapeLikePattern,
  groupOpenTasks,
  parseTaskFilters,
  safeTasksReturn,
  taskInputSchema,
  tasksHref,
} from '../features/tasks/task-domain.ts'
import { TASK_STATUSES } from '../features/tasks/task-status.ts'

const base = { title: 'Write report', description: '', priority: 'high', pillar: '', dueDate: '', dueTime: '', estimatedMinutes: '' }

test('task input is trimmed, optional fields become null', () => {
  const result = taskInputSchema.parse({ ...base, title: '  Write report  ', description: '  ', estimatedMinutes: '45', pillar: 'professional' })
  assert.deepEqual(result, { title: 'Write report', description: null, priority: 'high', pillar: 'professional', dueDate: '', dueTime: '', estimatedMinutes: 45, repeat: 'none' })
})

test('task input rejects bad values', () => {
  for (const bad of [
    { title: '   ' },
    { title: 'x'.repeat(201) },
    { priority: 'urgent' },
    { pillar: 'spiritual' },
    { dueDate: '2026-02-30' },
    { dueDate: '26-11-27' },
    { dueDate: '2026-11-27', dueTime: '24:00' },
    { estimatedMinutes: '0' },
    { estimatedMinutes: '1441' },
    { estimatedMinutes: '1.5' },
    { description: 'x'.repeat(2001) },
  ]) {
    assert.equal(taskInputSchema.safeParse({ ...base, ...bad }).success, false, JSON.stringify(bad))
  }
})

test('due wall clock defaults to the end of the day', () => {
  assert.equal(dueWallClock({ dueDate: '', dueTime: '' }), null)
  assert.equal(dueWallClock({ dueDate: '', dueTime: '09:00' }), null) // clearing the date clears the deadline
  assert.deepEqual(dueWallClock({ dueDate: '2026-12-01', dueTime: '' }), { date: '2026-12-01', time: '23:59' })
  assert.deepEqual(dueWallClock({ dueDate: '2026-12-01', dueTime: '09:30' }), { date: '2026-12-01', time: '09:30' })
})

test('filters fall back to safe defaults and build canonical links', () => {
  assert.deepEqual(parseTaskFilters({}), { view: 'open', pillar: null, query: null })
  assert.deepEqual(parseTaskFilters({ view: 'done', pillar: 'academic', q: '  essay\u0000 ' }), { view: 'done', pillar: 'academic', query: 'essay' })
  assert.deepEqual(parseTaskFilters({ view: 'drop table', pillar: 'x', q: 'y'.repeat(300) }).query.length, 100)
  assert.equal(tasksHref(parseTaskFilters({})), '/tasks')
  assert.equal(tasksHref(parseTaskFilters({ view: 'done', q: 'a b' }), { pillar: 'physical' }), '/tasks?view=done&pillar=physical&q=a+b')
})

test('return paths are limited to the tasks page', () => {
  assert.equal(safeTasksReturn('/tasks?view=done&q=a+b'), '/tasks?view=done&q=a+b')
  assert.equal(safeTasksReturn('/planner'), '/planner')
  assert.equal(safeTasksReturn('/planner?date=2026-11-28'), '/planner?date=2026-11-28')
  for (const bad of ['/planner?date=x', '/planner/../tasks', 'https://evil.test/tasks', '//evil.test', '/tasks/../admin', '/tasks?x=<script>', '/habits', null, 'x'.repeat(400)]) {
    assert.equal(safeTasksReturn(bad), '/tasks', String(bad))
  }
})

test('search wildcards are escaped', () => {
  assert.equal(escapeLikePattern('100%_done\\'), '100\\%\\_done\\\\')
})

test('transitions only use real statuses and never complete twice', () => {
  for (const { from, to } of Object.values(TASK_TRANSITIONS)) {
    for (const status of [...from, to]) assert.ok(TASK_STATUSES.includes(status), status)
  }
  assert.ok(!TASK_TRANSITIONS.complete.from.includes('done'))
  assert.ok(!TASK_TRANSITIONS.cancel.from.includes('cancelled'))
  assert.deepEqual([...TASK_PILLARS].sort(), ['academic', 'communication', 'intellectual', 'personal', 'physical', 'professional'])
})

test('open tasks are grouped as overdue, today, upcoming and undated', () => {
  const now = new Date('2026-11-27T12:00:00Z')
  const task = (id, dueAt, dueDate, priority = 'medium', createdAt = '2026-11-01T00:00:00Z') => ({ id, dueAt, dueDate, priority, createdAt })
  const groups = groupOpenTasks([
    task('later-today', '2026-11-27T18:00:00Z', '2026-11-27'),
    task('morning-missed', '2026-11-27T08:00:00Z', '2026-11-27'),
    task('next-week', '2026-12-03T23:59:00Z', '2026-12-03'),
    task('tomorrow', '2026-11-28T09:00:00Z', '2026-11-28'),
    task('none-low', null, null, 'low'),
    task('none-high', null, null, 'high'),
  ], '2026-11-27', now)
  assert.deepEqual(groups.map((g) => [g.id, g.tasks.map((t) => t.id)]), [
    ['overdue', ['morning-missed']],
    ['today', ['later-today']],
    ['upcoming', ['tomorrow', 'next-week']],
    ['none', ['none-high', 'none-low']],
  ])
  assert.deepEqual(groupOpenTasks([], '2026-11-27', now), [])
})

test('repeating tasks: next due dates and stored rule', async () => {
  const { nextDueDate, readRepeat, recurrenceFor } = await import('../features/tasks/task-recurrence.ts')
  assert.equal(nextDueDate('2026-11-27', 'daily', '2026-11-27'), '2026-11-28')
  assert.equal(nextDueDate('2026-11-27', 'weekly', '2026-11-27'), '2026-12-04')
  assert.equal(nextDueDate('2026-11-27', 'weekdays', '2026-11-27'), '2026-11-30') // Friday -> Monday
  assert.equal(nextDueDate('2026-01-31', 'monthly', '2026-01-31'), '2026-02-28') // clamped to the month
  assert.equal(nextDueDate('2028-01-31', 'monthly', '2028-01-31'), '2028-02-29')
  assert.equal(nextDueDate('2026-11-01', 'daily', '2026-11-27'), '2026-11-28') // overdue: next one is in the future
  assert.equal(nextDueDate('2026-11-02', 'weekly', '2026-11-27'), '2026-11-30')
  assert.deepEqual(recurrenceFor('weekly'), { every: 'weekly' })
  assert.equal(recurrenceFor('none'), null)
  assert.equal(readRepeat({ every: 'monthly' }), 'monthly')
  for (const bad of [null, {}, { every: 'hourly' }, { every: 'none' }, ['weekly'], 'weekly']) assert.equal(readRepeat(bad), 'none')
  const { taskInputSchema } = await import('../features/tasks/task-domain.ts')
  assert.equal(taskInputSchema.safeParse({ ...base, repeat: 'yearly' }).success, false)
  assert.equal(taskInputSchema.parse({ ...base, repeat: 'weekdays' }).repeat, 'weekdays')
})
