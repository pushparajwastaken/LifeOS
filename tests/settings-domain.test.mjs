import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { DEFAULT_DISPLAY_NAME, EXPORT_TABLES, LEGACY_TIME_ZONE_NAMES, exportFileName, isValidTimeZone, profileInputSchema, timeZoneOptions } from '../features/settings/settings-domain.ts'

test('timezones are validated against the runtime', () => {
  for (const zone of ['UTC', 'Asia/Kolkata', 'America/New_York', 'America/Argentina/Buenos_Aires']) assert.equal(isValidTimeZone(zone), true, zone)
  for (const zone of ['', 'Mars/Olympus', 'Asia/Kolkata; drop table', '../etc', 'x'.repeat(65)]) assert.equal(isValidTimeZone(zone), false, zone)
  const options = timeZoneOptions('Asia/Kolkata')
  assert.equal(options[0], 'UTC')
  assert.ok(options.includes('Asia/Kolkata'))
  assert.equal(new Set(options).size, options.length)
  // Current IANA names are offered instead of ICU's legacy ones, and every offered name is accepted.
  for (const [legacy, modern] of Object.entries(LEGACY_TIME_ZONE_NAMES)) {
    assert.ok(isValidTimeZone(modern), modern)
    assert.ok(!options.includes(legacy) || legacy === 'Asia/Kolkata', `legacy ${legacy} still offered`)
  }
  assert.ok(timeZoneOptions('UTC').includes('Asia/Kolkata'))
  assert.ok(timeZoneOptions('UTC').includes('Europe/Kyiv'))
})

test('profile input: name is cleaned, empty falls back to the default', () => {
  assert.deepEqual(profileInputSchema.parse({ displayName: '  Ada\u0000 Lovelace ', timeZone: 'Europe/London' }), { displayName: 'Ada Lovelace', timeZone: 'Europe/London' })
  assert.equal(profileInputSchema.parse({ displayName: '   ', timeZone: 'UTC' }).displayName, DEFAULT_DISPLAY_NAME)
  assert.equal(profileInputSchema.safeParse({ displayName: 'x'.repeat(81), timeZone: 'UTC' }).success, false)
  assert.equal(profileInputSchema.safeParse({ displayName: 'Ada', timeZone: 'Nowhere/Land' }).success, false)
})

test('export covers every user-owned table created by the migrations', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url)
  const sql = readdirSync(dir).filter((file) => file.endsWith('.sql')).map((file) => readFileSync(new URL(file, dir), 'utf8')).join('\n')
  const owned = new Set()
  for (const match of sql.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
    if (/\n\s*user_id\s+uuid/i.test(match[2])) owned.add(match[1])
  }
  const exported = new Set(EXPORT_TABLES.map((entry) => entry.table))
  const missing = [...owned].filter((table) => !exported.has(table))
  assert.deepEqual(missing, [], `tables with user_id missing from the export: ${missing.join(', ')}`)
  assert.ok(owned.size >= 45, `expected the migrations to define at least 45 user tables, found ${owned.size}`)
  assert.ok(exported.has('profiles'))
  assert.equal(exported.size, EXPORT_TABLES.length, 'no table listed twice')
  for (const entry of EXPORT_TABLES) {
    assert.match(entry.table, /^[a-z_]+$/)
    assert.ok(entry.order.length > 0)
  }
})

test('export file name is dated', () => {
  assert.equal(exportFileName(new Date('2026-11-27T22:00:00Z')), 'lifeos-export-2026-11-27.json')
})
