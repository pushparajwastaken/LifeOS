import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { RESOURCE_TYPES, SOURCE_PROVIDERS } from '../features/resources/resource-domain.ts'
import { normalize, splitStatements, stripComments } from './helpers/sql-statements.mjs'

const sql = stripComments(readFileSync(new URL('../supabase/migrations/20261126130000_resource_imports.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n'))
const statements = splitStatements(sql).map(normalize)
const NEW = '(?:import_runs|import_candidates)'

const ALLOWED = [
  /^do \$preconditions\$ .* \$preconditions\$$/,
  new RegExp(`^create table public\\.${NEW} \\(`),
  new RegExp(`^create index \\w+ on public\\.${NEW} \\(`),
  /^create index resource_source_records_run_owner_idx on public\.resource_source_records \(import_run_id, user_id\)$/,
  /^comment on table public\.import_runs is '/,
  /^create trigger lifeos_updated_at before update on public\.import_runs for each row execute function public\.lifeos_set_updated_at\(\)$/,
  /^alter table public\.resource_source_records add column import_run_id uuid$/,
  /^alter table public\.resource_source_records add constraint resource_source_records_run_owner_fk foreign key \(import_run_id, user_id\) references public\.import_runs \(id, user_id\) on delete set null \(import_run_id\)$/,
  new RegExp(`^alter table public\\.${NEW} enable row level security$`),
  /^create policy lifeos_(import_runs|import_candidates)_owner_access on public\.\1 for all to authenticated using \(auth\.uid\(\) = user_id\) with check \(auth\.uid\(\) = user_id\)$/,
  /^revoke all on table public\.import_runs, public\.import_candidates from anon, authenticated$/,
  /^grant select, insert, update, delete on table public\.import_runs to authenticated$/,
  /^grant select, insert, delete on table public\.import_candidates to authenticated$/,
]

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

test('constants and ownership rules', () => {
  const providers = sql.match(/import_runs_provider_check\s+check \(provider in \(([^)]*)\)\)/)[1].split(',').map((v) => v.trim().replace(/'/g, ''))
  assert.deepEqual(providers, [...SOURCE_PROVIDERS])
  const types = sql.match(/import_candidates_type_check\s+check \(resource_type in \(([^)]*)\)\)/)[1].split(',').map((v) => v.trim().replace(/'/g, ''))
  assert.deepEqual(types, [...RESOURCE_TYPES])
  const fks = sql.match(/foreign key \([^)]*\)\s+references public\.\w+ \([^)]*\)/g) ?? []
  assert.equal(fks.length, 2)
  for (const fk of fks) assert.match(fk, /foreign key \(\w+, user_id\)\s+references public\.\w+ \(id, user_id\)/)
  assert.match(sql, /error_code ~ '\^\[a-z_\]\{1,64\}\$'/, 'error codes only, no raw messages')
})
