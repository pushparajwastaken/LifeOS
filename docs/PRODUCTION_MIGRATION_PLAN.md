# Production migration plan: M1–M9 schema

Status: **executed 2026-11-28 with owner approval.** All six files applied in order, each succeeded.
Production project: `qebolligppjfthobviqr`. Prepared 2026-11-28 from read-only checks.

## Result
| Check | Result |
|---|---|
| Six `apply_migration` calls (in plan order) | All succeeded; recorded as `20261127190000` … `20261127190210` (mapping in `ARCHITECTURE.md`) |
| Recorded statements vs repository files | Identical for all six (comments and whitespace ignored) |
| Whole-schema comparison with staging | Identical in columns, constraints, policies, triggers, indexes, the view, table grants and function permissions (1,412 items). The only difference is whitespace and comments inside the two pre-existing core functions `lifeos_handle_new_user` and `lifeos_set_updated_at`, which predates this rollout |
| Not-signed-in API request to `tasks`, `profiles`, `goals`, `side_quests`, `learning_sessions` | `42501` (refused); legacy `rabbit_holes` still returns `[]` as intended |
| Security advisor | Only the known "leaked password protection disabled" |
| Performance advisor | Known items only: per-row `auth.uid()` in RLS (51 policies, a planned later migration), unused indexes on empty new tables, one unindexed FK on `habit_calendar_events` (pre-existing) |
| Signed-in check on the live site | **Pending: owner** |

## Why
`lifeos-v2` (commit `8c1ca8e`) is deployed, but production's database still stops at the November core and
Google Calendar migrations. Side Quests, the learning log, the library and imports fail to load, and Home,
Analytics, Planner and Calendar show load errors for learning and quest data, until these migrations run.

## Read-only findings (2026-11-28)
| Check | Result |
|---|---|
| Postgres | 17.11 |
| Users / data | 1 account (the owner); its profile is the only row in the core tables; all new-table names are free |
| Existing schema vs staging | **Identical**: fingerprint of 700 columns, constraints, policies and triggers on the 41 existing tables matches staging (`67ef211f…`), so production is in exactly the state the migrations were tested against |
| M1 preconditions | `lifeos_set_updated_at()` present; `knowledge_notes` present with `unique (id, user_id)`; Side Quest tables and `lifeos_reject_truncate()` absent |
| M2–M4 preconditions | All objects they create are absent |
| Grants migration | All 37 target tables exist with RLS enabled |
| `20261126090000` | Already in effect (`lifeos_handle_new_user` executable by `postgres` and `service_role` only); applying it again is a no-op that records it |
| Security advisor | Only "leaked password protection disabled" (known, owner decision) |
| Migration history | 9 records with other version numbers (`20261111175517` …); see "How" |

## What runs, in order
All six files are additive: new tables, indexes, functions, triggers, a view, RLS policies and grants. No
existing row is read, changed or deleted. Two new nullable columns are added only to tables that these same
migrations create. Each file starts with a read-only preconditions block that aborts the file if the state is
not what it expects.

| # | File | Creates / changes |
|---|---|---|
| 1 | `20261126090000_revoke_handle_new_user_execute.sql` | Re-asserts the existing EXECUTE restriction (no change) |
| 2 | `20261126100000_side_quests_core.sql` | `side_quests`, `quest_objectives`, `quest_milestones`, `quest_notes` (references `knowledge_notes`), TRUNCATE guard |
| 3 | `20261126110000_learning_sessions.sql` | `learning_sessions`, `active_learning_sessions` view, soft-delete guard, quest-delete topic trigger |
| 4 | `20261126120000_resource_library.sql` | `learning_resources`, `resource_source_records`, `quest_resources`, `learning_sessions.resource_id`, view refresh |
| 5 | `20261126130000_resource_imports.sql` | `import_runs`, `import_candidates`, `resource_source_records.import_run_id` |
| 6 | `20261128090000_harden_core_table_grants.sql` | Removes anon access and TRUNCATE/REFERENCES/TRIGGER on the 37 pre-M1 tables (legacy tables untouched) |

## How
- **Do not use `supabase db push`** against production: its history uses different version numbers and the
  CLI would try to re-apply the core migrations.
- Apply each file unchanged, one at a time, with the Supabase `apply_migration` call, named after the file
  (for example `side_quests_core`). Each runs as one transaction, so a failing precondition or statement leaves
  that file fully unapplied. The history then records each with a new timestamp version; the mapping to repo
  versions is written into `ARCHITECTURE.md` afterwards. Never use `migration repair` to hide anything.
- Stop at the first failure and report; do not continue to the next file.

## Checks
After each file: confirm its objects exist (tables, RLS on, policies, grants exactly as on staging).

After all six:
1. Schema fingerprint of all 51 tables matches staging.
2. Grant audit: nothing for `anon` except the 4 legacy tables; no `TRUNCATE` except legacy.
3. Not-signed-in API request (publishable key only) to `tasks`, `profiles`, `side_quests` returns `401 / 42501`.
4. Security and performance advisors: no new findings beyond the known ones.
5. Owner signs in on the live site and opens Home, Side Quests, Learning log, Library, Imports, Analytics,
   Planner, Calendar, Tasks, Goals, Physical and Settings (no test accounts on production; no production data
   is created by me).

## Rollback (only if needed)
All new tables are empty right after the rollout, so each file can be undone by dropping what it created, in
reverse order (M4 → M1: drop the new tables, the `active_learning_sessions` view, the new functions and the
added columns). The grants change is undone by re-granting the previous privileges (not recommended).
Rollback SQL would be written and reviewed before use; it is not pre-run.

## Before starting
- Confirm a recent backup exists (Supabase dashboard → Database → Backups).
- The deployed app keeps working on the older tables throughout; locks are brief (new, empty tables).
