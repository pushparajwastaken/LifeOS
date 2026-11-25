import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { normalize, splitStatements, stripComments } from './helpers/sql-statements.mjs'

const FILE = new URL('../supabase/migrations/20261126110000_learning_sessions.sql', import.meta.url)
const sql = stripComments(readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n'))
const statements = splitStatements(sql).map(normalize)

const ALLOWED = [
  /^do \$preconditions\$ .* \$preconditions\$$/,
  /^create table public\.learning_sessions \(/,
  /^create index \w+ on public\.learning_sessions \(/,
  /^comment on table public\.learning_sessions is '/,
  /^create trigger (lifeos_updated_at|lifeos_session_guard) before (update|insert or update) on public\.learning_sessions for each row /,
  /^create trigger lifeos_no_truncate before truncate on public\.learning_sessions for each statement /,
  /^create trigger lifeos_preserve_session_topics before delete on public\.side_quests for each row execute function public\.lifeos_preserve_session_topics\(\)$/,
  /^create function public\.(lifeos_learning_session_guard|lifeos_preserve_session_topics)\(\) returns trigger language plpgsql set search_path = '' as \$\$/,
  /^revoke all on function public\.(lifeos_learning_session_guard|lifeos_preserve_session_topics)\(\) from public, anon, authenticated$/,
  /^create view public\.active_learning_sessions with \(security_invoker = true\) as select .* from public\.learning_sessions where deleted_at is null$/,
  /^alter table public\.learning_sessions enable row level security$/,
  /^create policy lifeos_learning_sessions_owner_access on public\.learning_sessions for all to authenticated using \(auth\.uid\(\) = user_id\) with check \(auth\.uid\(\) = user_id\)$/,
  /^revoke all on table public\.learning_sessions, public\.active_learning_sessions from anon, authenticated$/,
  /^grant select, insert, update, delete on table public\.learning_sessions to authenticated$/,
  /^grant select on table public\.active_learning_sessions to authenticated$/,
]

test('every statement matches an approved shape', () => {
  assert.ok(statements.length >= 15)
  for (const statement of statements) {
    assert.ok(ALLOWED.some((re) => re.test(statement)), `statement outside the allowlist: ${statement.slice(0, 180)}`)
  }
})

test('legacy tables are not referenced', () => {
  for (const table of ['rabbit_holes', 'rabbit_hole_resources', 'rabbit_hole_experiments', 'study_sessions', 'knowledge_notes']) {
    assert.ok(!new RegExp(`\\b${table}\\b`).test(sql), `${table} must not appear`)
  }
})

test('the only change to an existing table is the quest-delete trigger', () => {
  const touchingSideQuests = statements.filter((s) => /\bside_quests\b/.test(s) && !s.startsWith('do $preconditions$'))
  assert.equal(touchingSideQuests.length, 2, 'table FK + one trigger')
  assert.ok(touchingSideQuests.some((s) => s.startsWith('create table public.learning_sessions')))
  assert.ok(touchingSideQuests.some((s) => s.startsWith('create trigger lifeos_preserve_session_topics before delete on public.side_quests')))
})

test('integrity rules are present', () => {
  const table = statements.find((s) => s.startsWith('create table public.learning_sessions'))
  assert.match(table, /foreign key \(quest_id, user_id\) references public\.side_quests \(id, user_id\) on delete set null \(quest_id\)/)
  assert.match(table, /check \(quest_id is not null or btrim\(coalesce\(topic, ''\)\) <> ''\)/)
  assert.match(table, /check \(duration_minutes between 1 and 1440\)/)
  assert.match(table, /check \(session_type in \('study', 'practice', 'build', 'watch', 'read', 'other'\)\)/)
  const guard = statements.find((s) => s.startsWith('create function public.lifeos_learning_session_guard'))
  assert.match(guard, /new\.deleted_at := now\(\)/, 'client-supplied deletion times are ignored')
  assert.match(guard, /old\.deleted_at <= now\(\) - interval '30 days'/, 'restore window uses the database clock')
  assert.match(guard, /new\.deleted_at := null/, 'inserts start active')
})
