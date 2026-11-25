import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { HABIT_PILLARS } from '../features/habits/habit-domain.ts'
import {
  QUEST_DIFFICULTIES,
  QUEST_PILLARS,
  QUEST_STATUSES,
  QUEST_STRUCTURES,
  canTransitionQuest,
  getQuestProgress,
  getQuestStatusUpdate,
  milestoneInputSchema,
  nextPosition,
  objectiveInputSchema,
  parseQuestFilter,
  questInputSchema,
  questInputToRow,
  sortQuests,
} from '../features/quests/quest-domain.ts'

const NOW = new Date('2026-11-26T10:00:00.000Z')
const STAMP = '2026-11-26T10:00:00.000Z'
const sql = readFileSync(new URL('../supabase/migrations/20261126100000_side_quests_core.sql', import.meta.url), 'utf8')

function checkList(name) {
  const match = sql.match(new RegExp(`constraint ${name}\\s+check \\([^\\n]*? in \\(([^)]*)\\)`))
  assert.ok(match, `${name} not found`)
  return match[1].split(',').map((v) => v.trim().replace(/'/g, ''))
}

test('domain constants mirror the migration check constraints', () => {
  assert.deepEqual([...QUEST_STATUSES], checkList('side_quests_status_check'))
  assert.deepEqual([...QUEST_STRUCTURES], checkList('side_quests_structure_check'))
  assert.deepEqual([...QUEST_DIFFICULTIES], checkList('side_quests_difficulty_check'))
  assert.deepEqual([...QUEST_PILLARS], checkList('side_quests_pillar_check'))
  assert.deepEqual([...QUEST_PILLARS], [...HABIT_PILLARS])
})

test('only approved status transitions are allowed', () => {
  const allowed = new Set(['backlog>active', 'active>paused', 'active>completed', 'paused>active', 'paused>completed', 'completed>active'])
  for (const from of QUEST_STATUSES) {
    for (const to of QUEST_STATUSES) {
      assert.equal(canTransitionQuest(from, to), allowed.has(`${from}>${to}`), `${from} -> ${to}`)
    }
  }
})

test('starting a quest stamps started_at once', () => {
  const started = getQuestStatusUpdate({ status: 'backlog', started_at: null, completed_at: null }, 'active', NOW)
  assert.deepEqual(started, { status: 'active', started_at: STAMP, completed_at: null })
  const resumed = getQuestStatusUpdate({ status: 'paused', started_at: '2026-01-01T00:00:00.000Z', completed_at: null }, 'active', NOW)
  assert.equal(resumed.started_at, '2026-01-01T00:00:00.000Z')
})

test('completing stamps completed_at and reopening clears it', () => {
  const done = getQuestStatusUpdate({ status: 'active', started_at: '2026-01-01T00:00:00.000Z', completed_at: null }, 'completed', NOW)
  assert.equal(done.completed_at, STAMP)
  const reopened = getQuestStatusUpdate({ status: 'completed', started_at: '2026-01-01T00:00:00.000Z', completed_at: STAMP }, 'active', NOW)
  assert.equal(reopened.completed_at, null, 'no stale completion timestamp')
  assert.equal(reopened.started_at, '2026-01-01T00:00:00.000Z')
})

test('invalid transitions return null', () => {
  assert.equal(getQuestStatusUpdate({ status: 'backlog', started_at: null, completed_at: null }, 'completed', NOW), null)
  assert.equal(getQuestStatusUpdate({ status: 'backlog', started_at: null, completed_at: null }, 'paused', NOW), null)
  assert.equal(getQuestStatusUpdate({ status: 'active', started_at: STAMP, completed_at: null }, 'backlog', NOW), null)
})

test('structured progress is milestone completion, null with no milestones', () => {
  const none = getQuestProgress({ structure: 'structured', objectives: [], milestones: [] })
  assert.equal(none.kind, 'milestones')
  assert.equal(none.percent, null)
  const some = getQuestProgress({
    structure: 'structured',
    objectives: [{ achieved_at: STAMP }, { achieved_at: null }],
    milestones: [{ completed_at: STAMP }, { completed_at: null }, { completed_at: null }],
  })
  assert.deepEqual(some, { kind: 'milestones', completed: 1, total: 3, percent: 33, objectivesAchieved: 1, objectivesTotal: 2 })
})

test('exploratory quests never produce a percentage', () => {
  const progress = getQuestProgress({
    structure: 'exploratory',
    objectives: [{ achieved_at: STAMP }],
    milestones: [{ completed_at: STAMP }, { completed_at: null }],
  })
  assert.equal(progress.kind, 'exploratory')
  assert.ok(!('percent' in progress))
  assert.equal(progress.milestonesCompleted, 1)
})

test('quest input validation', () => {
  const base = { title: 'Computer Architecture', description: '', category: '', difficulty: '', structure: 'structured', pillar: 'intellectual', weeklyTargetMinutes: '', targetDate: '' }
  const ok = questInputSchema.parse(base)
  assert.deepEqual(questInputToRow(ok), {
    title: 'Computer Architecture', description: null, category: null, difficulty: null,
    structure: 'structured', pillar: 'intellectual', weekly_target_minutes: null, target_date: null,
  })
  assert.equal(questInputSchema.parse({ ...base, weeklyTargetMinutes: '120', targetDate: '2027-02-28' }).weeklyTargetMinutes, 120)
  for (const bad of [
    { title: '   ' },
    { title: 'x'.repeat(161) },
    { structure: 'freeform' },
    { pillar: 'spiritual' },
    { difficulty: 'impossible' },
    { weeklyTargetMinutes: '0' },
    { weeklyTargetMinutes: '10081' },
    { weeklyTargetMinutes: '12.5' },
    { targetDate: '2027-02-30' },
    { targetDate: 'tomorrow' },
    { category: 'c'.repeat(61) },
  ]) {
    assert.equal(questInputSchema.safeParse({ ...base, ...bad }).success, false, JSON.stringify(bad))
  }
})

test('objective and milestone validation', () => {
  assert.equal(objectiveInputSchema.safeParse({ title: '' }).success, false)
  assert.equal(objectiveInputSchema.safeParse({ title: 'Explain pipelining' }).success, true)
  assert.equal(milestoneInputSchema.parse({ title: 'Build a CPU', description: '', dueOn: '' }).dueOn, null)
  assert.equal(milestoneInputSchema.safeParse({ title: 'M', description: '', dueOn: '2027-13-01' }).success, false)
})

test('helpers: next position, filter parsing and ordering', () => {
  assert.equal(nextPosition([]), 0)
  assert.equal(nextPosition([{ position: 0 }, { position: 4 }]), 5)
  assert.equal(parseQuestFilter('paused'), 'paused')
  assert.equal(parseQuestFilter('nonsense'), 'all')
  const sorted = sortQuests([
    { status: 'completed', updated_at: '2026-11-03' },
    { status: 'backlog', updated_at: '2026-11-02' },
    { status: 'active', updated_at: '2026-11-01' },
    { status: 'active', updated_at: '2026-11-05' },
  ])
  assert.deepEqual(sorted.map((q) => `${q.status}:${q.updated_at}`), ['active:2026-11-05', 'active:2026-11-01', 'backlog:2026-11-02', 'completed:2026-11-03'])
})
