import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  COMPLETED_TASK_STATUS,
  DEFAULT_TASK_STATUS,
  OPEN_TASK_STATUSES,
  TASK_STATUSES,
  filterOpenTasks,
  getTaskStatusUpdate,
  isOpenTaskStatus,
  isTaskStatus,
} from '../features/tasks/task-status.ts'

const NOW = new Date('2026-11-25T09:30:00.000Z')

function makeTask(status, id = status) {
  return { id, title: `Task ${id}`, status }
}

test('task statuses match the tasks.status check constraint in the core migration', () => {
  const sql = readFileSync(new URL('../supabase/migrations/202611110001_lifeos_core.sql', import.meta.url), 'utf8')
  const tasksTable = sql.slice(sql.indexOf('create table public.tasks'))
  const match = tasksTable.match(/status text not null default '(\w+)' check \(status in \(([^)]*)\)\)/)
  assert.ok(match, 'tasks.status check constraint not found in migration')
  const allowed = match[2].split(',').map((value) => value.trim().replace(/'/g, ''))
  assert.deepEqual([...TASK_STATUSES], allowed)
  assert.equal(DEFAULT_TASK_STATUS, match[1])
})

test('completing a task writes done and stamps completed_at', () => {
  const update = getTaskStatusUpdate(COMPLETED_TASK_STATUS, NOW)
  assert.equal(COMPLETED_TASK_STATUS, 'done')
  assert.deepEqual(update, {
    status: 'done',
    completed_at: '2026-11-25T09:30:00.000Z',
    updated_at: '2026-11-25T09:30:00.000Z',
  })
})

test('reopening or cancelling a task clears completed_at', () => {
  for (const status of ['todo', 'in_progress', 'cancelled']) {
    const update = getTaskStatusUpdate(status, NOW)
    assert.equal(update.status, status)
    assert.equal(update.completed_at, null, `${status} must not keep a completion timestamp`)
    assert.equal(update.updated_at, '2026-11-25T09:30:00.000Z')
  }
})

test('invalid task statuses are rejected', () => {
  for (const value of ['completed', 'complete', 'archived', 'canceled', 'DONE', ' done', '', null, undefined, 1]) {
    assert.equal(isTaskStatus(value), false, `${String(value)} should not be a task status`)
    assert.throws(() => getTaskStatusUpdate(value, NOW), RangeError)
  }
})

test('open tasks include todo and in_progress only', () => {
  assert.deepEqual([...OPEN_TASK_STATUSES], ['todo', 'in_progress'])
  const tasks = [
    makeTask('todo'),
    makeTask('in_progress'),
    makeTask('done'),
    makeTask('cancelled'),
    makeTask('completed', 'legacy'),
  ]
  assert.deepEqual(filterOpenTasks(tasks).map(({ id }) => id), ['todo', 'in_progress'])
  assert.equal(isOpenTaskStatus('done'), false)
  assert.equal(isOpenTaskStatus('cancelled'), false)
  assert.equal(isOpenTaskStatus('todo'), true)
  assert.equal(isOpenTaskStatus('in_progress'), true)
})

test('every open status is a valid status', () => {
  for (const status of OPEN_TASK_STATUSES) assert.equal(isTaskStatus(status), true)
  assert.equal(isTaskStatus(COMPLETED_TASK_STATUS), true)
  assert.equal(isOpenTaskStatus(COMPLETED_TASK_STATUS), false)
})
