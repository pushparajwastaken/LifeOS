import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { HABIT_PILLARS } from '../features/habits/habit-domain.ts'
import {
  RESTORE_WINDOW_DAYS,
  SESSION_PILLARS,
  SESSION_TYPES,
  formatDuration,
  groupByLocalDate,
  isWithinRestoreWindow,
  restoreDeadline,
  sessionInputSchema,
  sessionInputToRow,
  sumMinutesBetween,
  utcToZonedParts,
  weeklyTargetAttainment,
  zonedLocalToUtcIso,
} from '../features/learning/learning-domain.ts'

const sql = readFileSync(new URL('../supabase/migrations/20261126110000_learning_sessions.sql', import.meta.url), 'utf8')
const QUEST = '11111111-2222-4333-8444-555555555555'
const base = { questId: '', resourceId: '', topic: 'Cryptography basics', pillar: 'intellectual', sessionType: 'read', date: '2026-11-26', time: '09:30', durationMinutes: '45', notes: '' }

test('constants mirror the migration', () => {
  const types = sql.match(/session_type in \(([^)]*)\)/)[1].split(',').map((v) => v.trim().replace(/'/g, ''))
  assert.deepEqual([...SESSION_TYPES], types)
  assert.deepEqual([...SESSION_PILLARS], [...HABIT_PILLARS])
  assert.match(sql, /duration_minutes between 1 and 1440/)
  assert.match(sql, new RegExp(`interval '${RESTORE_WINDOW_DAYS} days'`))
})

test('standalone sessions need a non-empty topic; quest sessions do not', () => {
  assert.equal(sessionInputSchema.safeParse({ ...base, topic: '' }).success, false)
  assert.equal(sessionInputSchema.safeParse({ ...base, topic: '   ' }).success, false)
  const withQuest = sessionInputSchema.parse({ ...base, topic: '', questId: QUEST })
  assert.equal(withQuest.topic, null)
  assert.equal(withQuest.questId, QUEST)
})

test('duration must be a whole number from 1 to 1440 minutes', () => {
  for (const bad of ['0', '1441', '-5', '12.5', 'abc', '']) {
    assert.equal(sessionInputSchema.safeParse({ ...base, durationMinutes: bad }).success, false, bad)
  }
  assert.equal(sessionInputSchema.parse({ ...base, durationMinutes: '1' }).durationMinutes, 1)
  assert.equal(sessionInputSchema.parse({ ...base, durationMinutes: '1440' }).durationMinutes, 1440)
})

test('rejects invalid type, pillar, date, time and quest id', () => {
  for (const bad of [{ sessionType: 'nap' }, { pillar: 'spiritual' }, { date: '2026-02-30' }, { time: '24:00' }, { time: '9:30' }, { questId: 'not-a-uuid' }, { resourceId: 'nope' }, { topic: 'x'.repeat(161) }]) {
    assert.equal(sessionInputSchema.safeParse({ ...base, ...bad }).success, false, JSON.stringify(bad))
  }
})

test('local time converts to UTC in the user timezone, including DST', () => {
  assert.equal(zonedLocalToUtcIso('2026-11-26', '09:30', 'UTC'), '2026-11-26T09:30:00.000Z')
  assert.equal(zonedLocalToUtcIso('2026-11-26', '09:30', 'Asia/Kolkata'), '2026-11-26T04:00:00.000Z')
  assert.equal(zonedLocalToUtcIso('2026-07-01', '12:00', 'America/New_York'), '2026-07-01T16:00:00.000Z')
  assert.equal(zonedLocalToUtcIso('2026-12-01', '12:00', 'America/New_York'), '2026-12-01T17:00:00.000Z')
  // 2026-03-08 02:30 does not exist in New York (clocks jump 02:00 -> 03:00): resolves to a real instant
  const skipped = zonedLocalToUtcIso('2026-03-08', '02:30', 'America/New_York')
  assert.ok(['2026-03-08T07:30:00.000Z', '2026-03-08T06:30:00.000Z'].includes(skipped), skipped)
  assert.deepEqual(utcToZonedParts('2026-11-26T04:00:00.000Z', 'Asia/Kolkata'), { date: '2026-11-26', time: '09:30' })
  assert.deepEqual(utcToZonedParts('2026-11-26T23:30:00.000Z', 'Asia/Kolkata'), { date: '2026-11-27', time: '05:00' })
})

test('row mapping keeps pillar only for standalone sessions', () => {
  const standalone = sessionInputToRow(sessionInputSchema.parse(base), 'Asia/Kolkata')
  assert.deepEqual(standalone, {
    quest_id: null, resource_id: null, topic: 'Cryptography basics', pillar: 'intellectual', session_type: 'read',
    started_at: '2026-11-26T04:00:00.000Z', duration_minutes: 45, notes: null,
  })
  const linked = sessionInputToRow(sessionInputSchema.parse({ ...base, questId: QUEST }), 'UTC')
  assert.equal(linked.pillar, null)
  assert.equal(linked.quest_id, QUEST)
})

test('summaries: week totals, target attainment, grouping', () => {
  const sessions = [
    { localDate: '2026-11-22', minutes: 60 },
    { localDate: '2026-11-23', minutes: 30 },
    { localDate: '2026-11-29', minutes: 45 },
    { localDate: '2026-11-30', minutes: 90 },
  ]
  assert.equal(sumMinutesBetween(sessions, '2026-11-23', '2026-11-29'), 75)
  assert.deepEqual(weeklyTargetAttainment(75, 150), { minutes: 75, target: 150, percent: 50 })
  assert.deepEqual(weeklyTargetAttainment(75, null), { minutes: 75, target: null, percent: null })
  const groups = groupByLocalDate([{ localDate: '2026-11-23', id: 'a' }, { localDate: '2026-11-25', id: 'b' }, { localDate: '2026-11-23', id: 'c' }])
  assert.deepEqual(groups.map((g) => `${g.date}:${g.items.map((i) => i.id).join('')}`), ['2026-11-25:b', '2026-11-23:ac'])
})

test('restore window helpers and duration formatting', () => {
  const deleted = '2026-11-01T10:00:00.000Z'
  assert.equal(isWithinRestoreWindow(deleted, new Date('2026-11-30T09:59:00.000Z')), true)
  assert.equal(isWithinRestoreWindow(deleted, new Date('2026-12-01T10:00:00.000Z')), false)
  assert.equal(restoreDeadline(deleted).toISOString(), '2026-12-01T10:00:00.000Z')
  assert.equal(formatDuration(45), '45 min')
  assert.equal(formatDuration(120), '2 h')
  assert.equal(formatDuration(135), '2 h 15 min')
})
