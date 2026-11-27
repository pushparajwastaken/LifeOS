import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  ANALYTICS_WEEKS,
  APPROXIMATION_REASONS,
  METRICS,
  METRIC_GROUPS,
  breakdown,
  countByWeek,
  distinctDaysByWeek,
  footnoteReasons,
  formatMinutes,
  isCompletedOnTime,
  localDateKey,
  pooledRate,
  rateByWeek,
  sumByWeek,
  weekIndex,
  weekStartOf,
  weekWindow,
} from '../features/analytics/analytics-domain.ts'

const TODAY = '2026-11-26' // a Thursday
const WEEKS = weekWindow(TODAY)

test('metric catalogue follows the approved contract', () => {
  const ids = Object.keys(METRICS)
  for (const id of ids) {
    const metric = METRICS[id]
    assert.ok(METRIC_GROUPS.includes(metric.group), id)
    if (metric.kind === 'event_approximate') assert.ok(metric.reasons.length > 0, `${id} must explain why it is approximate`)
    else assert.equal(metric.reasons.length, 0, `${id} has reasons but is not approximate`)
    for (const reason of metric.reasons) assert.ok(APPROXIMATION_REASONS.includes(reason))
  }
  for (const group of METRIC_GROUPS) assert.ok(ids.some((id) => METRICS[id].group === group), `group ${group} has metrics`)
  // Spot-check kinds named in docs/ANALYTICS_METRICS.md
  assert.equal(METRICS.imports_completed.kind, 'event_exact')
  assert.equal(METRICS.tasks_overdue.kind, 'current_state')
  assert.equal(METRICS.quest_progress.kind, 'current_state')
  assert.equal(METRICS.learning_target_attainment.kind, 'current_state')
  assert.deepEqual(METRICS.habit_consistency.reasons, ['mutable_config'])
  assert.deepEqual(METRICS.resources_added.reasons, ['automatic_purge'])
})

test('no metric counts collection as learning effort', () => {
  const effort = Object.entries(METRICS).filter(([, m]) => m.group === 'learning_effort').map(([id]) => id)
  assert.ok(effort.every((id) => id.startsWith('learning_')), effort.join(','))
})

test('weeks run Monday to Sunday over a 12-week window ending this week', () => {
  assert.equal(ANALYTICS_WEEKS, 12)
  assert.equal(weekStartOf('2026-11-26'), '2026-11-23')
  assert.equal(weekStartOf('2026-11-23'), '2026-11-23')
  assert.equal(weekStartOf('2026-11-29'), '2026-11-23', 'Sunday belongs to the week before')
  assert.equal(WEEKS.length, 12)
  assert.equal(WEEKS[11], '2026-11-23')
  assert.equal(WEEKS[0], '2026-09-07')
  assert.equal(weekIndex('2026-09-06', WEEKS, TODAY), -1, 'before the window')
  assert.equal(weekIndex('2026-09-07', WEEKS, TODAY), 0)
  assert.equal(weekIndex('2026-11-27', WEEKS, TODAY), -1, 'future dates are ignored')
})

test('local dates use the profile timezone, including across DST', () => {
  assert.equal(localDateKey('2026-11-26T03:30:00Z', 'America/New_York'), '2026-11-25')
  assert.equal(localDateKey('2026-11-26T03:30:00Z', 'Asia/Kolkata'), '2026-11-26')
  assert.equal(localDateKey('2026-03-08T06:59:00Z', 'America/New_York'), '2026-03-08')
  assert.equal(localDateKey('2026-11-26T23:30:00Z', 'Asia/Tokyo'), '2026-11-27')
})

test('weekly counts, sums and distinct days', () => {
  const counts = countByWeek(['2026-11-23', '2026-11-26', '2026-11-16', '2026-01-01', '2026-12-01'], WEEKS, TODAY)
  assert.equal(counts[11], 2)
  assert.equal(counts[10], 1)
  assert.equal(counts.reduce((a, b) => a + b, 0), 3)
  const sums = sumByWeek([{ date: '2026-11-24', value: 30 }, { date: '2026-11-24', value: 15 }], WEEKS, TODAY)
  assert.equal(sums[11], 45)
  assert.equal(distinctDaysByWeek(['2026-11-24', '2026-11-24', '2026-11-25'], WEEKS, TODAY)[11], 2)
})

test('rates are blank (null), not 0%, when there is nothing to measure', () => {
  const rates = rateByWeek([{ date: '2026-11-24', hit: true }, { date: '2026-11-25', hit: false }, { date: '2026-11-25', hit: true }], WEEKS, TODAY)
  assert.equal(rates[11], 67)
  assert.equal(rates[10], null)
  assert.equal(pooledRate([], WEEKS, TODAY), null)
  assert.equal(pooledRate([{ date: '2026-11-24', hit: false }], WEEKS, TODAY), 0)
  assert.equal(pooledRate([{ date: '2026-11-24', hit: true }, { date: '2026-11-17', hit: false }, { date: '2025-01-01', hit: false }], WEEKS, TODAY), 50)
})

test('on-time completion compares instants', () => {
  assert.equal(isCompletedOnTime('2026-11-24T10:00:00Z', '2026-11-24T10:00:00Z'), true)
  assert.equal(isCompletedOnTime('2026-11-24T10:00:01Z', '2026-11-24T10:00:00Z'), false)
})

test('breakdowns sum within the window, largest first', () => {
  const rows = breakdown([
    { date: '2026-11-24', key: 'Rust', value: 30 },
    { date: '2026-11-17', key: 'Rust', value: 20 },
    { date: '2026-11-24', key: 'Go', value: 60 },
    { date: '2025-01-01', key: 'Old', value: 500 },
    { date: '2026-11-24', key: 'Zero', value: 0 },
  ], WEEKS, TODAY)
  assert.deepEqual(rows, [{ key: 'Go', value: 60 }, { key: 'Rust', value: 50 }])
})

test('footnotes list each approximation reason once, in a stable order', () => {
  assert.deepEqual(footnoteReasons(['tasks_completed', 'tasks_on_time_rate', 'tasks_overdue']), ['editable_timestamp', 'undoable'])
  assert.deepEqual(footnoteReasons(['imports_completed']), [])
})

test('minutes format', () => {
  assert.equal(formatMinutes(45), '45 min')
  assert.equal(formatMinutes(120), '2 h')
  assert.equal(formatMinutes(135), '2 h 15 min')
})

test('the domain module stays importable without the app bundler', () => {
  const source = readFileSync(new URL('../features/analytics/analytics-domain.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /from '@\//)
  assert.doesNotMatch(source, /from '\.\.?\/[^']*(?<!\.ts)'/)
})

test('compareLastWeek compares the last full week with the four weeks before it', async () => {
  const { compareLastWeek } = await import('../features/analytics/analytics-domain.ts')
  // 12 weeks; index 10 is last full week, 11 is the current partial week (ignored).
  const counts = [0, 0, 0, 0, 0, 2, 4, 2, 4, 2, 8, 1]
  assert.deepEqual(compareLastWeek(counts, 'count'), { lastWeek: 8, usual: 3, direction: 'higher' })
  assert.deepEqual(compareLastWeek([0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 0], 'count'), { lastWeek: 3, usual: 3, direction: 'similar' })
  assert.deepEqual(compareLastWeek([0, 0, 0, 0, 0, 0, 30, 30, 30, 30, 0, 9], 'count'), { lastWeek: 0, usual: 30, direction: 'lower' })
  // Started using the feature too recently: weeks before the first activity are not zero effort.
  assert.equal(compareLastWeek([0, 0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 0], 'count'), null)
  assert.equal(compareLastWeek(Array(12).fill(0), 'count'), null)
  // Usual level keeps one decimal for counts.
  assert.equal(compareLastWeek([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0], 'count').usual, 0.3)
})

test('compareLastWeek treats rates with blanks conservatively', async () => {
  const { compareLastWeek } = await import('../features/analytics/analytics-domain.ts')
  const nulls = Array(6).fill(null)
  assert.deepEqual(compareLastWeek([...nulls, 80, 70, null, 90, 60, null], 'rate'), { lastWeek: 60, usual: 80, direction: 'lower' })
  assert.deepEqual(compareLastWeek([...nulls, 80, 70, 76, 90, 82, null], 'rate'), { lastWeek: 82, usual: 79, direction: 'similar' })
  assert.equal(compareLastWeek([...nulls, 80, null, null, 90, 60, null], 'rate'), null) // only 2 baseline weeks measured
  assert.equal(compareLastWeek([...nulls, 80, 70, 75, 90, null, 50], 'rate'), null) // last week not measured
  assert.equal(compareLastWeek([50, 60, 70], 'rate'), null) // too short
})
