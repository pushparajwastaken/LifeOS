import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  RESOURCE_ORIGINS,
  RESOURCE_STATUSES,
  RESOURCE_TYPES,
  SOURCE_PROVIDERS,
  VALUE_SOURCES,
} from '../features/resources/resource-domain.ts'
import { normalize, splitStatements, stripComments } from './helpers/sql-statements.mjs'

const raw = readFileSync(new URL('../supabase/migrations/20261126120000_resource_library.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sql = stripComments(raw)
const statements = splitStatements(sql).map(normalize)
const NEW = '(?:learning_resources|resource_source_records|quest_resources)'

const ALLOWED = [
  /^do \$preconditions\$ .* \$preconditions\$$/,
  new RegExp(`^create table public\\.${NEW} \\(`),
  new RegExp(`^create index \\w+ on public\\.${NEW} (using gin )?\\(`),
  /^create index learning_sessions_resource_owner_idx on public\.learning_sessions \(resource_id, user_id\)$/,
  /^comment on table public\.learning_resources is '/,
  new RegExp(`^create trigger (lifeos_updated_at|lifeos_origin_guard) before update on public\\.${NEW} for each row `),
  /^create trigger lifeos_no_truncate before truncate on public\.learning_resources for each statement /,
  /^create function public\.lifeos_resource_origin_guard\(\) returns trigger language plpgsql set search_path = '' as \$\$/,
  /^create or replace function public\.lifeos_learning_session_guard\(\) returns trigger language plpgsql set search_path = '' as \$\$/,
  /^revoke all on function public\.(lifeos_resource_origin_guard|lifeos_learning_session_guard)\(\) from public, anon, authenticated$/,
  /^alter table public\.learning_sessions add column resource_id uuid$/,
  /^alter table public\.learning_sessions add constraint learning_sessions_resource_owner_fk foreign key \(resource_id, user_id\) references public\.learning_resources \(id, user_id\) on delete set null \(resource_id\)$/,
  /^create or replace view public\.active_learning_sessions with \(security_invoker = true\) as select id, user_id, quest_id, topic, pillar, session_type, started_at, duration_minutes, notes, created_at, updated_at, resource_id from public\.learning_sessions where deleted_at is null$/,
  new RegExp(`^alter table public\\.${NEW} enable row level security$`),
  new RegExp(`^create policy lifeos_(learning_resources|resource_source_records|quest_resources)_owner_access on public\\.\\1 for all to authenticated using \\(auth\\.uid\\(\\) = user_id\\) with check \\(auth\\.uid\\(\\) = user_id\\)$`),
  /^revoke all on table public\.learning_resources, public\.resource_source_records, public\.quest_resources from anon, authenticated$/,
  new RegExp(`^grant (select|insert|update|delete)(, (select|insert|update|delete))* on table public\\.${NEW} to authenticated$`),
  /^revoke all on table public\.active_learning_sessions from anon$/,
  /^grant select on table public\.active_learning_sessions to authenticated$/,
]

function checkList(name) {
  const match = sql.match(new RegExp(`constraint ${name}\\s+check \\([^\\n]*? in \\(([^)]*)\\)`))
  assert.ok(match, name)
  return match[1].split(',').map((v) => v.trim().replace(/'/g, ''))
}

test('every statement matches an approved shape', () => {
  for (const statement of statements) {
    assert.ok(ALLOWED.some((re) => re.test(statement)), `statement outside the allowlist: ${statement.slice(0, 200)}`)
  }
})

test('legacy tables are not referenced', () => {
  for (const table of ['rabbit_holes', 'rabbit_hole_resources', 'rabbit_hole_experiments', 'study_sessions', 'knowledge_notes']) {
    assert.ok(!new RegExp(`\\b${table}\\b`).test(sql), table)
  }
})

test('domain constants mirror the check constraints', () => {
  assert.deepEqual([...RESOURCE_TYPES], checkList('learning_resources_type_check'))
  assert.deepEqual([...RESOURCE_STATUSES], checkList('learning_resources_status_check'))
  assert.deepEqual([...RESOURCE_ORIGINS], checkList('learning_resources_origin_check'))
  assert.deepEqual([...VALUE_SOURCES], checkList('learning_resources_url_source_check'))
  assert.deepEqual([...VALUE_SOURCES], checkList('learning_resources_title_source_check'))
  assert.deepEqual([...SOURCE_PROVIDERS], checkList('resource_source_records_provider_check'))
})

test('ownership, dedup and integrity rules are present', () => {
  const resources = statements.find((s) => s.startsWith('create table public.learning_resources'))
  assert.match(resources, /constraint learning_resources_canonical_key unique \(user_id, canonical_url\)/)
  assert.match(resources, /check \(\(status = 'completed'\) = \(completed_at is not null\)\)/)
  const fks = sql.match(/foreign key \([^)]*\)\s+references public\.\w+ \([^)]*\)/g) ?? []
  assert.equal(fks.length, 4)
  for (const fk of fks) assert.match(fk, /foreign key \(\w+, user_id\)\s+references public\.\w+ \(id, user_id\)/)
  assert.ok(statements.some((s) => s.startsWith('grant select, insert, delete on table public.quest_resources')), 'links are not updatable')
  const guard = statements.find((s) => s.startsWith('create or replace function public.lifeos_learning_session_guard'))
  assert.match(guard, /new\.resource_id is distinct from old\.resource_id and new\.resource_id is not null/)
  assert.match(guard, /old\.deleted_at <= now\(\) - interval '30 days'/)
})
