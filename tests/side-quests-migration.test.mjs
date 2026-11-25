import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { normalize, splitStatements, stripComments } from './helpers/sql-statements.mjs'

const FILE = new URL('../supabase/migrations/20261126100000_side_quests_core.sql', import.meta.url)
const NEW_TABLES = ['side_quests', 'quest_objectives', 'quest_milestones', 'quest_notes']
const NEW = `(?:${NEW_TABLES.join('|')})`
const LEGACY_FORBIDDEN = ['rabbit_holes', 'rabbit_hole_resources', 'rabbit_hole_experiments', 'study_sessions']

const raw = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n')
const sql = stripComments(raw)
const statements = splitStatements(sql).map(normalize)

const ALLOWED = [
  { kind: 'preconditions', re: /^do \$preconditions\$ .* \$preconditions\$$/ },
  { kind: 'create table', re: new RegExp(`^create table public\\.${NEW} \\(`) },
  { kind: 'create index', re: new RegExp(`^create index \\w+ on public\\.${NEW} \\(`) },
  { kind: 'comment', re: new RegExp(`^comment on table public\\.${NEW} is '`) },
  { kind: 'truncate guard function', re: /^create function public\.lifeos_reject_truncate\(\) returns trigger / },
  { kind: 'function grant', re: /^revoke all on function public\.lifeos_reject_truncate\(\) from public, anon, authenticated$/ },
  { kind: 'trigger', re: new RegExp(`^create trigger (lifeos_updated_at|lifeos_no_truncate) before (update|truncate) on public\\.${NEW} `) },
  { kind: 'enable rls', re: new RegExp(`^alter table public\\.${NEW} enable row level security$`) },
  { kind: 'policy', re: new RegExp(`^create policy lifeos_(${NEW_TABLES.join('|')})_owner_access on public\\.\\1 for all to authenticated using \\(auth\\.uid\\(\\) = user_id\\) with check \\(auth\\.uid\\(\\) = user_id\\)$`) },
  { kind: 'table revoke', re: new RegExp(`^revoke all on table public\\.${NEW}(, public\\.${NEW})* from anon, authenticated$`) },
  { kind: 'table grant', re: new RegExp(`^grant (select|insert|update|delete)(, (select|insert|update|delete))* on table public\\.${NEW} to authenticated$`) },
]

test('every statement matches an approved shape', () => {
  assert.ok(statements.length > 20, 'migration parsed into statements')
  for (const statement of statements) {
    const match = ALLOWED.find(({ re }) => re.test(statement))
    assert.ok(match, `statement outside the allowlist: ${statement.slice(0, 160)}`)
  }
})

test('preconditions block is read-only', () => {
  const block = statements.find((s) => s.startsWith('do $preconditions$'))
  assert.ok(block)
  const body = block.slice('do $preconditions$'.length, -'$preconditions$'.length)
  for (const word of ['insert', 'update', 'delete', 'drop', 'alter', 'truncate', 'create', 'grant', 'revoke', 'execute', 'perform', 'set']) {
    assert.ok(!new RegExp(`\\b${word}\\b`).test(body), `preconditions must not contain "${word}"`)
  }
})

test('legacy tables are not referenced or modified', () => {
  for (const table of LEGACY_FORBIDDEN) {
    assert.ok(!new RegExp(`\\b${table}\\b`).test(sql), `${table} must not appear in the migration`)
  }
  const mentions = sql.split('\n').filter((line) => line.includes('knowledge_notes'))
  const allowed = mentions.filter((line) =>
    /to_regclass\('public\.knowledge_notes'\)/.test(line)
    || /'public\.knowledge_notes'::regclass/.test(line)
    || /references public\.knowledge_notes \(id, user_id\) on delete cascade/.test(line)
    || /public\.knowledge_notes is missing|public\.knowledge_notes has no unique/.test(line))
  assert.equal(allowed.length, mentions.length, `unexpected knowledge_notes usage: ${mentions.join(' | ')}`)
  assert.equal((sql.match(/references public\.knowledge_notes/g) ?? []).length, 1)
})

test('every new table has RLS, an owner policy and authenticated grants', () => {
  for (const table of NEW_TABLES) {
    assert.equal(statements.filter((s) => s.startsWith(`create table public.${table} (`)).length, 1, `${table} created once`)
    assert.ok(statements.includes(`alter table public.${table} enable row level security`), `${table} RLS`)
    assert.ok(statements.some((s) => s.startsWith(`create policy lifeos_${table}_owner_access on public.${table} `)), `${table} policy`)
    assert.ok(statements.some((s) => s.startsWith('grant ') && s.endsWith(`on table public.${table} to authenticated`)), `${table} grant`)
  }
  assert.ok(statements.some((s) => s.startsWith('grant select, insert, delete on table public.quest_notes')), 'link rows are not updatable')
})

test('truncate guard and updated_at triggers are installed', () => {
  assert.ok(statements.some((s) => s.startsWith('create trigger lifeos_no_truncate before truncate on public.side_quests')))
  for (const table of ['side_quests', 'quest_objectives', 'quest_milestones']) {
    assert.ok(statements.some((s) => s.startsWith(`create trigger lifeos_updated_at before update on public.${table} `)), table)
  }
})

test('every foreign key to a user-owned parent includes user_id', () => {
  const fks = sql.match(/foreign key \([^)]*\)\s+references public\.\w+ \([^)]*\)/g) ?? []
  assert.equal(fks.length, 4)
  for (const fk of fks) assert.match(fk, /foreign key \(\w+, user_id\)\s+references public\.\w+ \(id, user_id\)/)
})
