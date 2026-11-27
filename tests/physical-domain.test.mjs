import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  PHYSICAL_LIMITS,
  bodyInputSchema,
  formatClock,
  formatPace,
  parseDurationSeconds,
  runInputSchema,
  setInputSchema,
  sleepInputSchema,
  toKm,
  weightChange,
  workoutInputSchema,
} from '../features/physical/physical-domain.ts'

const core = readFileSync(new URL('../supabase/migrations/202611110001_lifeos_core.sql', import.meta.url), 'utf8')

test('limits match the core migration', () => {
  assert.match(core, /workouts[\s\S]*?title text not null check \(char_length\(title\) between 1 and 160\)/)
  assert.match(core, /name text not null check \(char_length\(name\) between 1 and 120\)/)
  assert.match(core, /unit text not null default 'kg' check \(unit in \('kg','lb'\)\)/)
  assert.match(core, /distance_unit text not null default 'km' check \(distance_unit in \('km','mi'\)\)/)
  assert.match(core, /duration_minutes integer not null check \(duration_minutes between 0 and 1440\)/)
  assert.match(core, /recovery_score integer check \(recovery_score is null or recovery_score between 0 and 100\)/)
  assert.match(core, /unique \(user_id, sleep_date\)/)
  assert.equal(PHYSICAL_LIMITS.title, 160)
  assert.equal(PHYSICAL_LIMITS.maxSleepMinutes, 1440)
})

test('durations accept minutes, m:ss and h:mm:ss', () => {
  assert.equal(parseDurationSeconds('45'), 2700)
  assert.equal(parseDurationSeconds('28:45'), 1725)
  assert.equal(parseDurationSeconds('1:05:00'), 3900)
  for (const bad of ['', '1:60', '1:61:00', 'abc', '1:2:3:4', '-5', '1.5']) assert.equal(parseDurationSeconds(bad), null, bad)
})

test('pace, clock and unit conversion', () => {
  assert.equal(formatPace(1725, 5, 'km'), '5:45 /km')
  assert.equal(formatClock(3900), '1:05:00')
  assert.equal(formatClock(1725), '28:45')
  assert.ok(Math.abs(toKm(10, 'mi') - 16.09344) < 1e-9)
  assert.equal(toKm(5, 'km'), 5)
})

test('workout, run, body and sleep input', () => {
  assert.deepEqual(workoutInputSchema.parse({ title: ' Legs ', date: '2026-11-27', time: '', restDay: false, notes: '' }), { title: 'Legs', date: '2026-11-27', time: '12:00', restDay: false, notes: null })
  assert.equal(workoutInputSchema.safeParse({ title: '', date: '2026-11-27', time: '', restDay: false, notes: '' }).success, false)
  assert.deepEqual(runInputSchema.parse({ date: '2026-11-27', time: '07:15', distance: '5.25', unit: 'km', duration: '28:45', notes: '' }), { date: '2026-11-27', time: '07:15', distance: 5.25, unit: 'km', duration: 1725, notes: null })
  for (const bad of [{ distance: '0' }, { distance: '-1' }, { distance: '5.123' }, { duration: '0' }, { duration: '1:99' }, { unit: 'yd' }, { date: '2026-02-30' }, { time: '25:00' }]) {
    assert.equal(runInputSchema.safeParse({ date: '2026-11-27', time: '', distance: '5', unit: 'km', duration: '30', notes: '', ...bad }).success, false, JSON.stringify(bad))
  }
  assert.equal(bodyInputSchema.parse({ date: '2026-11-27', time: '', weight: '72.4', unit: 'kg', notes: '' }).weight, 72.4)
  assert.equal(bodyInputSchema.safeParse({ date: '2026-11-27', time: '', weight: '0', unit: 'kg', notes: '' }).success, false)
  assert.deepEqual(sleepInputSchema.parse({ date: '2026-11-26', hours: '7', minutes: '', recovery: '', notes: '' }), { date: '2026-11-26', hours: 7, minutes: 0, recovery: null, notes: null })
  for (const bad of [{ hours: '25' }, { hours: '24', minutes: '1' }, { minutes: '60' }, { recovery: '101' }, { hours: '' }]) {
    assert.equal(sleepInputSchema.safeParse({ date: '2026-11-26', hours: '7', minutes: '30', recovery: '80', notes: '', ...bad }).success, false, JSON.stringify(bad))
  }
})

test('sets need reps or weight', () => {
  assert.deepEqual(setInputSchema.parse({ reps: '8', weight: '60.5', unit: 'kg' }), { reps: 8, weight: 60.5, unit: 'kg' })
  assert.deepEqual(setInputSchema.parse({ reps: '', weight: '20', unit: 'lb' }), { reps: null, weight: 20, unit: 'lb' })
  assert.equal(setInputSchema.safeParse({ reps: '', weight: '', unit: 'kg' }).success, false)
  assert.equal(setInputSchema.safeParse({ reps: '-1', weight: '', unit: 'kg' }).success, false)
  assert.equal(setInputSchema.safeParse({ reps: '5', weight: '9999', unit: 'kg' }).success, false)
})

test('weight change compares with an entry at least four weeks older, in the latest unit', () => {
  assert.equal(weightChange([{ measuredAt: '2026-11-27T08:00:00Z', weight: 72, unit: 'kg' }]), null)
  assert.equal(weightChange([{ measuredAt: '2026-11-27T08:00:00Z', weight: 72, unit: 'kg' }, { measuredAt: '2026-11-20T08:00:00Z', weight: 73, unit: 'kg' }]), null)
  assert.deepEqual(weightChange([
    { measuredAt: '2026-11-27T08:00:00Z', weight: 72, unit: 'kg' },
    { measuredAt: '2026-11-20T08:00:00Z', weight: 73, unit: 'kg' },
    { measuredAt: '2026-10-25T08:00:00Z', weight: 74.5, unit: 'kg' },
    { measuredAt: '2026-10-01T08:00:00Z', weight: 76, unit: 'kg' },
  ]), { change: -2.5, unit: 'kg', sinceIso: '2026-10-25T08:00:00Z' })
  const mixed = weightChange([{ measuredAt: '2026-11-27T08:00:00Z', weight: 160, unit: 'lb' }, { measuredAt: '2026-10-20T08:00:00Z', weight: 75, unit: 'kg' }])
  assert.equal(mixed.unit, 'lb')
  assert.equal(mixed.change, -5.3) // 75 kg = 165.3 lb
})
