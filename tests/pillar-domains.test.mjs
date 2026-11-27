import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { decimalNumber, isDateKey, optionalText, optionalWebUrl, percent, plural, weekStartOf } from '../features/pillars/pillar-domain.ts'
import { BOOK_STATUSES, bookInputSchema, bookProgress, readingSessionSchema, statusDates } from '../features/intellectual/intellectual-domain.ts'
import { ERROR_STATUSES, TOPIC_STATUSES, assessmentInputSchema, averagePercent, isDue, scheduleReview, scorePercent } from '../features/academic/academic-domain.ts'
import { DSA_OUTCOMES, MILESTONE_STATUSES, PROJECT_STATUSES, PROJECT_TASK_STATUSES, dsaInputSchema, milestoneCompletion, projectInputSchema, projectProgress } from '../features/professional/professional-domain.ts'
import { PRACTICE_TYPES, VIDEO_STATUSES, adjacentStage, averageRating, publishedAtFor, speakingInputSchema } from '../features/communication/communication-domain.ts'
import { parseReviewWeek, weekRangeLabel, weeklyReviewSchema } from '../features/reviews/review-domain.ts'

const core = readFileSync(new URL('../supabase/migrations/202611110001_lifeos_core.sql', import.meta.url), 'utf8')
const checkList = (values) => values.map((value) => `'${value}'`).join(',')

test('status enums match the core migration', () => {
  assert.ok(core.includes(`status in (${checkList(['to_read', 'reading', 'completed', 'paused', 'abandoned'])})`))
  assert.deepEqual([...BOOK_STATUSES].sort(), ['abandoned', 'completed', 'paused', 'reading', 'to_read'])
  assert.ok(core.includes(`status in (${checkList(TOPIC_STATUSES)})`))
  assert.ok(core.includes(`status in (${checkList(ERROR_STATUSES)})`))
  assert.ok(core.includes(`status in (${checkList(PROJECT_STATUSES)})`))
  assert.ok(core.includes(`status in (${checkList(MILESTONE_STATUSES)})`))
  assert.ok(core.includes(`status in (${checkList(['todo', 'in_progress', 'done', 'blocked'])})`))
  assert.deepEqual([...PROJECT_TASK_STATUSES].sort(), ['blocked', 'done', 'in_progress', 'todo'])
  assert.ok(core.includes(`outcome in (${checkList(['attempted', 'solved', 'reviewed'])})`))
  assert.deepEqual([...DSA_OUTCOMES].sort(), ['attempted', 'reviewed', 'solved'])
  assert.ok(core.includes(`practice_type in (${checkList(PRACTICE_TYPES)})`))
  assert.ok(core.includes(`status in (${checkList(VIDEO_STATUSES)})`))
})

test('shared helpers', () => {
  assert.equal(isDateKey('2026-02-29'), false)
  assert.equal(isDateKey('2028-02-29'), true)
  assert.equal(weekStartOf('2026-11-29'), '2026-11-23')
  assert.equal(weekStartOf('2026-11-23'), '2026-11-23')
  assert.equal(plural(1, 'book'), '1 book')
  assert.equal(plural(0, 'book'), '0 books')
  assert.equal(plural(1284, 'member'), '1,284 members')
  assert.equal(percent(1, 3), 33)
  assert.equal(percent(5, 0), 0)
  assert.equal(percent(9, 4), 100)
  assert.equal(optionalText(10).parse('  \u0000 hi \n there '), 'hi \n there')
  assert.equal(optionalText(10).parse('   '), null)
  assert.equal(optionalWebUrl.parse('https://example.com/a?b=1'), 'https://example.com/a?b=1')
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.test', 'not a url']) assert.equal(optionalWebUrl.safeParse(bad).success, false, bad)
  assert.equal(decimalNumber(0, 2000).parse('1,200.5'), 1200.5)
  assert.equal(decimalNumber(0, 100).safeParse('100.01').success, false)
  assert.equal(decimalNumber(0, 100).safeParse('1.234').success, false)
})

test('books: input, status dates and progress', () => {
  assert.deepEqual(bookInputSchema.parse({ title: ' Dune ', author: '', totalPages: '412', status: 'reading' }), { title: 'Dune', author: null, totalPages: 412, status: 'reading' })
  for (const bad of [{ title: '' }, { title: 'x'.repeat(201) }, { totalPages: '0' }, { totalPages: '1.5' }, { status: 'lost' }]) {
    assert.equal(bookInputSchema.safeParse({ title: 'A', author: '', totalPages: '', status: 'to_read', ...bad }).success, false, JSON.stringify(bad))
  }
  assert.equal(readingSessionSchema.safeParse({ date: '2026-11-27', pages: '', minutes: '', notes: '' }).success, false)
  assert.deepEqual(readingSessionSchema.parse({ date: '2026-11-27', pages: '', minutes: '30', notes: '' }), { date: '2026-11-27', pages: 0, minutes: 30, notes: null })
  const today = '2026-11-27'
  assert.deepEqual(statusDates('reading', { started_on: null, finished_on: null }, today), { started_on: today, finished_on: null })
  assert.deepEqual(statusDates('reading', { started_on: '2026-10-01', finished_on: '2026-10-20' }, today), { started_on: '2026-10-01', finished_on: null })
  assert.deepEqual(statusDates('completed', { started_on: null, finished_on: null }, today), { started_on: today, finished_on: today })
  assert.deepEqual(statusDates('completed', { started_on: '2026-12-05', finished_on: null }, today), { started_on: today, finished_on: today }) // never finished before started
  assert.deepEqual(statusDates('to_read', { started_on: '2026-10-01', finished_on: null }, today), { started_on: null, finished_on: null })
  assert.deepEqual(bookProgress(300, 120, 'reading'), { pagesRead: 120, percent: 40, remaining: 180 })
  assert.deepEqual(bookProgress(null, 50, 'reading'), { pagesRead: 50, percent: null, remaining: null })
  assert.equal(bookProgress(300, 120, 'completed').percent, 100)
  assert.equal(bookProgress(300, 450, 'reading').percent, 100)
})

test('spaced revision schedule', () => {
  const now = new Date('2026-11-27T10:00:00Z')
  const again = scheduleReview({ interval_days: 10, ease_factor: 2.5 }, 'again', now)
  assert.equal(again.interval_days, 1)
  assert.equal(again.ease_factor, 2.3)
  assert.equal(again.next_review_at, '2026-11-28T10:00:00.000Z')
  assert.deepEqual(scheduleReview({ interval_days: 1, ease_factor: 2.5 }, 'good', now).interval_days, 3)
  assert.equal(scheduleReview({ interval_days: 10, ease_factor: 2.5 }, 'good', now).interval_days, 25)
  assert.equal(scheduleReview({ interval_days: 10, ease_factor: 2.5 }, 'hard', now).interval_days, 12)
  const easy = scheduleReview({ interval_days: 10, ease_factor: 2.5 }, 'easy', now)
  assert.equal(easy.interval_days, 33)
  assert.equal(easy.ease_factor, 2.65)
  assert.equal(scheduleReview({ interval_days: 1, ease_factor: 1.3 }, 'again', now).ease_factor, 1.3) // database minimum
  assert.equal(scheduleReview({ interval_days: 300, ease_factor: 3 }, 'easy', now).interval_days, 365)
  assert.equal(isDue({ next_review_at: null, status: 'active' }, now), true)
  assert.equal(isDue({ next_review_at: '2026-11-27T09:00:00Z', status: 'active' }, now), true)
  assert.equal(isDue({ next_review_at: '2026-11-28T09:00:00Z', status: 'active' }, now), false)
  assert.equal(isDue({ next_review_at: null, status: 'suspended' }, now), false)
})

test('assessments', () => {
  assert.equal(scorePercent(37, 40), 92.5)
  assert.equal(averagePercent([{ score: 50, max_score: 100 }, { score: 9, max_score: 10 }]), 70)
  assert.equal(averagePercent([]), null)
  const base = { title: 'Quiz', date: '2026-11-27', score: '8', maxScore: '10', questions: '', notes: '' }
  assert.equal(assessmentInputSchema.safeParse(base).success, true)
  assert.equal(assessmentInputSchema.safeParse({ ...base, score: '11' }).success, false)
  assert.equal(assessmentInputSchema.safeParse({ ...base, maxScore: '0' }).success, false)
})

test('projects, milestones and practice', () => {
  const base = { name: 'LifeOS', description: '', repositoryUrl: '', startedOn: '2026-11-01', dueOn: '' }
  assert.equal(projectInputSchema.safeParse(base).success, true)
  assert.equal(projectInputSchema.safeParse({ ...base, dueOn: '2026-10-01' }).success, false)
  assert.equal(projectInputSchema.safeParse({ ...base, repositoryUrl: 'javascript:alert(1)' }).success, false)
  assert.deepEqual(projectProgress([{ status: 'done' }, { status: 'todo' }, { status: 'blocked' }, { status: 'done' }]), { done: 2, total: 4, percent: 50, blocked: 1 })
  assert.deepEqual(projectProgress([]), { done: 0, total: 0, percent: null, blocked: 0 })
  const now = new Date('2026-11-27T10:00:00Z')
  assert.deepEqual(milestoneCompletion('done', now), { status: 'done', completed_at: '2026-11-27T10:00:00.000Z' })
  assert.deepEqual(milestoneCompletion('todo', now), { status: 'todo', completed_at: null })
  assert.equal(dsaInputSchema.parse({ problem: 'Two Sum', platform: '', difficulty: '', outcome: 'solved', url: '', notes: '', date: '2026-11-27' }).difficulty, null)
})

test('communication', () => {
  assert.equal(adjacentStage('idea', -1), null)
  assert.equal(adjacentStage('idea', 1), 'scripting')
  assert.equal(adjacentStage('published', 1), null)
  const now = new Date('2026-11-27T10:00:00Z')
  assert.equal(publishedAtFor('published', null, now), '2026-11-27T10:00:00.000Z')
  assert.equal(publishedAtFor('published', '2026-10-01T00:00:00Z', now), '2026-10-01T00:00:00Z')
  assert.equal(publishedAtFor('editing', '2026-10-01T00:00:00Z', now), null)
  assert.equal(averageRating([{ self_evaluation: 3 }, { self_evaluation: null }, { self_evaluation: 4 }]), 3.5)
  assert.equal(averageRating([{ self_evaluation: null }]), null)
  assert.equal(speakingInputSchema.safeParse({ date: '2026-11-27', time: '', minutes: '10', type: 'impromptu', rating: '6', recordingUrl: '', feedback: '' }).success, false)
})

test('weekly reviews', () => {
  assert.equal(parseReviewWeek(undefined, '2026-11-27'), '2026-11-23')
  assert.equal(parseReviewWeek('2026-11-18', '2026-11-27'), '2026-11-16')
  assert.equal(parseReviewWeek('2026-12-07', '2026-11-27'), '2026-11-23') // future weeks fall back to this week
  assert.equal(weekRangeLabel('2026-12-28'), 'Dec 28 – Jan 3, 2027')
  assert.equal(weeklyReviewSchema.safeParse({ week: '2026-11-23', wins: 'x'.repeat(4001), failures: '', blockers: '', next_priorities: '' }).success, false)
})
