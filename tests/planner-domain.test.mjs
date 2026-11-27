import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { REVIEW_PROMPTS, addDays, parsePlannerDate, plannedDue, plannedLoad, plannerHref, reviewInputSchema } from '../features/planner/planner-domain.ts'

const TODAY = '2026-11-27'

test('planner dates are real and within a year of today', () => {
  assert.equal(parsePlannerDate(undefined, TODAY), TODAY)
  assert.equal(parsePlannerDate('2026-11-30', TODAY), '2026-11-30')
  assert.equal(parsePlannerDate('2026-02-30', TODAY), TODAY)
  assert.equal(parsePlannerDate('2026-11-27T00:00', TODAY), TODAY)
  assert.equal(parsePlannerDate('2030-01-01', TODAY), TODAY)
  assert.equal(parsePlannerDate(addDays(TODAY, -366), TODAY), addDays(TODAY, -366))
  assert.equal(plannerHref(TODAY, TODAY), '/planner')
  assert.equal(plannerHref('2026-11-28', TODAY), '/planner?date=2026-11-28')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
})

test('planning keeps a task’s time of day and never invents one', () => {
  assert.deepEqual(plannedDue('plan', '2026-11-28', null), { date: '2026-11-28', time: '23:59' })
  assert.deepEqual(plannedDue('plan', '2026-11-28', { date: '2026-11-20', time: '09:30' }), { date: '2026-11-28', time: '09:30' })
  assert.deepEqual(plannedDue('next_day', '2026-11-28', { date: '2026-11-28', time: '09:30' }), { date: '2026-11-29', time: '09:30' })
  assert.deepEqual(plannedDue('next_day', '2026-11-28', null), { date: '2026-11-29', time: '23:59' })
  assert.equal(plannedDue('unplan', '2026-11-28', { date: '2026-11-28', time: '09:30' }), null)
  // A kept time that has already passed today becomes the end of the day.
  const now = { date: '2026-11-27', time: '18:21' }
  assert.deepEqual(plannedDue('plan', '2026-11-27', { date: '2026-11-26', time: '18:00' }, now), { date: '2026-11-27', time: '23:59' })
  assert.deepEqual(plannedDue('plan', '2026-11-27', { date: '2026-11-26', time: '21:00' }, now), { date: '2026-11-27', time: '21:00' })
  assert.deepEqual(plannedDue('plan', '2026-11-28', { date: '2026-11-26', time: '08:00' }, now), { date: '2026-11-28', time: '08:00' })
})

test('daily review input', () => {
  assert.deepEqual(reviewInputSchema.parse({ date: TODAY, accomplished: ' Shipped ', learned: '', improve: '', gratitude: '', tomorrow: 'Rest' }),
    { date: TODAY, accomplished: 'Shipped', learned: null, improve: null, gratitude: null, tomorrow: 'Rest' })
  assert.equal(reviewInputSchema.safeParse({ date: 'today', accomplished: '', learned: '', improve: '', gratitude: '', tomorrow: '' }).success, false)
  assert.equal(reviewInputSchema.safeParse({ date: TODAY, accomplished: 'x'.repeat(2001), learned: '', improve: '', gratitude: '', tomorrow: '' }).success, false)
  // Review prompts map to real daily_reviews columns.
  const core = readFileSync(new URL('../supabase/migrations/202611110001_lifeos_core.sql', import.meta.url), 'utf8')
  const table = core.slice(core.indexOf('create table public.daily_reviews'), core.indexOf('create table public.weekly_reviews'))
  for (const { field } of REVIEW_PROMPTS) assert.match(table, new RegExp(`\\n\\s*${field} text,`), field)
  assert.match(table, /unique \(user_id, review_date\)/)
})

test('planned load counts estimates and flags tasks without one', () => {
  assert.deepEqual(plannedLoad([{ estimatedMinutes: 30 }, { estimatedMinutes: null }, { estimatedMinutes: 45 }]), { minutes: 75, unestimated: 1 })
  assert.deepEqual(plannedLoad([]), { minutes: 0, unestimated: 0 })
})
