import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { normalize, splitStatements, stripComments } from './helpers/sql-statements.mjs'

const DIR = new URL('../supabase/migrations/', import.meta.url)
const FILE = new URL('20261128090000_harden_core_table_grants.sql', DIR)
const LEGACY = ['rabbit_holes', 'rabbit_hole_resources', 'rabbit_hole_experiments', 'study_sessions']

const raw = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n')
const statements = splitStatements(stripComments(raw)).map(normalize)
const tableList = (statement) => [...statement.matchAll(/public\.(\w+)/g)].map((match) => match[1])

test('only preconditions, one revoke and one grant', () => {
  assert.equal(statements.length, 3)
  assert.match(statements[0], /^do \$preconditions\$ .* \$preconditions\$$/)
  assert.match(statements[1], /^revoke all on table (public\.\w+, )*public\.\w+ from anon, authenticated$/)
  assert.match(statements[2], /^grant select, insert, update, delete on table (public\.\w+, )*public\.\w+ to authenticated$/)
})

test('preconditions are read-only and check existence and RLS', () => {
  const body = statements[0]
  for (const word of ['insert ', 'update ', 'delete ', 'drop ', 'alter ', 'create ', 'grant ', 'revoke ', 'truncate ']) {
    assert.ok(!body.includes(word), `preconditions must not contain "${word.trim()}"`)
  }
  assert.ok(body.includes('to_regclass'))
  assert.ok(body.includes('relrowsecurity'))
})

test('revoke and grant cover the same tables, never the legacy ones, and match the precondition list', () => {
  const revoked = tableList(statements[1])
  const granted = tableList(statements[2])
  assert.deepEqual(granted, revoked)
  assert.equal(new Set(revoked).size, revoked.length)
  for (const legacy of LEGACY) assert.ok(!revoked.includes(legacy), legacy)
  const expected = [...statements[0].matchAll(/'(\w+)'/g)].map((match) => match[1]).filter((name) => !['harden_core_table_grants', 'public'].includes(name))
  assert.deepEqual([...expected].sort(), [...revoked].sort())
})

test('every user table created before M1 is covered, except the preserved legacy tables', () => {
  const older = readdirSync(DIR).filter((file) => file.endsWith('.sql') && file < '20261126100000').map((file) => readFileSync(new URL(file, DIR), 'utf8')).join('\n')
  const created = [...older.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map((match) => match[1])
  const revoked = new Set(tableList(statements[1]))
  const uncovered = created.filter((table) => !revoked.has(table) && !LEGACY.includes(table))
  assert.deepEqual(uncovered, [], `older tables left with default grants: ${uncovered.join(', ')}`)
})
