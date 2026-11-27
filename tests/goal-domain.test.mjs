import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  GOAL_PERIODS,
  GOAL_PILLARS,
  GOAL_STATUSES,
  GOAL_TRANSITIONS,
  goalEndsOn,
  goalInputSchema,
  goalInputToRow,
  goalProgress,
  milestoneInputSchema,
  periodPosition,
  progressInputSchema,
} from '../features/goals/goal-domain.ts'

const core = readFileSync(new URL('../supabase/migrations/202611110001_lifeos_core.sql', import.meta.url), 'utf8')
const base = { title: 'Run 300 km', description: '', pillar: 'physical', period: '90_day', startsOn: '2026-11-01', endsOn: '', targetValue: '300', unit: 'km' }

test('domain literals match the core migration', () => {
  assert.match(core, new RegExp(`pillar in \\(${GOAL_PILLARS.map((p) => `'${p}'`).join(',')}\\)`))
  assert.match(core, new RegExp(`period in \\(${GOAL_PERIODS.map((p) => `'${p}'`).join(',')}\\)`))
  for (const status of GOAL_STATUSES) assert.ok(core.includes(`'${status}'`), status)
  assert.match(core, /title text not null check \(char_length\(title\) between 1 and 180\)/)
})

test('preset periods count the start day; custom keeps the chosen end', () => {
  assert.equal(goalEndsOn('30_day', '2026-11-01', ''), '2026-11-30')
  assert.equal(goalEndsOn('90_day', '2026-11-01', ''), '2027-01-29')
  assert.equal(goalEndsOn('annual', '2026-01-01', ''), '2026-12-31')
  assert.equal(goalEndsOn('custom', '2026-11-01', '2026-12-15'), '2026-12-15')
})

test('goal input is validated and converted to a row', () => {
  const row = goalInputToRow(goalInputSchema.parse({ ...base, targetValue: '1,200.5' }))
  assert.deepEqual(row, { title: 'Run 300 km', description: null, pillar: 'physical', period: '90_day', starts_on: '2026-11-01', ends_on: '2027-01-29', target_value: 1200.5, unit: 'km' })
  // A unit without a target is dropped.
  assert.equal(goalInputToRow(goalInputSchema.parse({ ...base, targetValue: '' })).unit, null)
  for (const bad of [
    { title: ' ' }, { title: 'x'.repeat(181) }, { pillar: 'spiritual' }, { period: 'weekly' }, { startsOn: '2026-02-30' },
    { period: 'custom', endsOn: '' }, { period: 'custom', endsOn: '2026-10-01' }, { targetValue: '0' }, { targetValue: '-5' },
    { targetValue: '1.234' }, { targetValue: '12abc' }, { targetValue: '99999999999' }, { unit: 'x'.repeat(31) },
  ]) {
    assert.equal(goalInputSchema.safeParse({ ...base, ...bad }).success, false, JSON.stringify(bad))
  }
})

test('progress and milestone input', () => {
  assert.deepEqual(progressInputSchema.parse({ value: '0', date: '2026-11-27', note: '' }), { value: 0, date: '2026-11-27', note: null })
  assert.equal(progressInputSchema.safeParse({ value: '-1', date: '2026-11-27', note: '' }).success, false)
  assert.equal(progressInputSchema.safeParse({ value: '5', date: 'today', note: '' }).success, false)
  assert.deepEqual(milestoneInputSchema.parse({ title: ' First 100 km ', dueOn: '' }), { title: 'First 100 km', dueOn: null })
  assert.equal(milestoneInputSchema.safeParse({ title: '', dueOn: '' }).success, false)
})

test('progress uses the latest reading against the target, else milestones', () => {
  assert.deepEqual(goalProgress({ target_value: 300 }, 120, []), { kind: 'target', current: 120, target: 300, percent: 40 })
  assert.deepEqual(goalProgress({ target_value: 300 }, 450, []), { kind: 'target', current: 450, target: 300, percent: 100 })
  assert.deepEqual(goalProgress({ target_value: 300 }, null, [{ completed_at: 'x' }]), { kind: 'target', current: null, target: 300, percent: 0 })
  assert.deepEqual(goalProgress({ target_value: null }, null, [{ completed_at: 'x' }, { completed_at: null }, { completed_at: null }]), { kind: 'milestones', done: 1, total: 3, percent: 33 })
  assert.deepEqual(goalProgress({ target_value: null }, 5, []), { kind: 'none' })
})

test('period position is clamped', () => {
  assert.deepEqual(periodPosition('2026-11-01', '2026-11-30', '2026-10-30'), { day: 0, totalDays: 30, state: 'upcoming' })
  assert.deepEqual(periodPosition('2026-11-01', '2026-11-30', '2026-11-01'), { day: 1, totalDays: 30, state: 'running' })
  assert.deepEqual(periodPosition('2026-11-01', '2026-11-30', '2026-11-30'), { day: 30, totalDays: 30, state: 'running' })
  assert.deepEqual(periodPosition('2026-11-01', '2026-11-30', '2026-12-05'), { day: 30, totalDays: 30, state: 'ended' })
})

test('status transitions use real statuses and are one step', () => {
  for (const { from, to } of Object.values(GOAL_TRANSITIONS)) {
    for (const status of [...from, to]) assert.ok(GOAL_STATUSES.includes(status))
    assert.ok(!from.includes(to))
  }
})
