# Database schema

Source of truth: `supabase/migrations/`. Applied in this order (text order of versions):

| Version | File | Contents |
|---|---|---|
| 202611110001 | `202611110001_lifeos_core.sql` | 39 tables: profiles, habits, habit_logs, tasks, reviews, goals (+ milestones, progress entries), physical, reading and knowledge, academic, professional, rabbit holes, DSA, communication; `lifeos_set_updated_at`, `lifeos_handle_new_user` + trigger on `auth.users`; owner RLS on every table |
| 20261112 | `20261112_habit_google_calendar_sync.sql` | `habit_calendar_connections`, `habit_calendar_events` (status only; tokens live in Vercel Connect) |
| 20261126090000 | `20261126090000_revoke_handle_new_user_execute.sql` | Revokes EXECUTE on the SECURITY DEFINER auth trigger function from public/anon/authenticated (matches production) |
| 20261126100000 | `20261126100000_side_quests_core.sql` | Side Quests (below) and the TRUNCATE guard |
| 20261126110000 | `20261126110000_learning_sessions.sql` | Learning sessions, `active_learning_sessions` view, soft-delete guard, quest-delete topic trigger |
| 20261126120000 | `20261126120000_resource_library.sql` | Resource Library tables, `learning_sessions.resource_id`, guard and view updated for it |
| 20261126130000 | `20261126130000_resource_imports.sql` | `import_runs`, `import_candidates`, `resource_source_records.import_run_id` |
| 20261128090000 | `20261128090000_harden_core_table_grants.sql` | Grants only: revokes everything from `anon` and `authenticated` on the 37 pre-M1 tables (core and Google Calendar), then grants `select, insert, update, delete` to `authenticated`. Legacy `rabbit_holes`, `rabbit_hole_resources`, `rabbit_hole_experiments`, `study_sessions` deliberately unchanged. **Applied to staging only.** |

## Ownership pattern (every user-owned table)
- `user_id uuid not null references auth.users on delete cascade`
- `unique (id, user_id)` so children can reference `(parent_id, user_id)`
- Foreign keys to user-owned parents include `user_id`: Postgres checks foreign keys without RLS, so this is what prevents linking to another user's rows.
- RLS policy `lifeos_<table>_owner_access`: `for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)`
- `updated_at` maintained by the `lifeos_updated_at` trigger (link tables have no `updated_at`).

## Side Quests (M1)
| Table | Key columns | Notes |
|---|---|---|
| `side_quests` | title (1–160, not blank), description (≤4000), category (≤60), difficulty (intro/intermediate/advanced/expert), structure (structured/exploratory, default exploratory), status (backlog/active/paused/completed, default backlog), pillar (default intellectual), weekly_target_minutes (1–10080), target_date, started_at, completed_at | Checks: `completed ⇔ completed_at is set`; non-backlog requires started_at; completed_at ≥ started_at. TRUNCATE rejected by trigger. |
| `quest_objectives` | quest_id, title (1–240), position, achieved_at | FK `(quest_id, user_id)` → side_quests, cascade |
| `quest_milestones` | quest_id, title (1–180), description (≤2000), due_on, position, completed_at | FK `(quest_id, user_id)` → side_quests, cascade |
| `quest_notes` | quest_id, note_id, created_at; PK (quest_id, note_id) | FKs to side_quests and knowledge_notes, both `(…, user_id)`, cascade from either side; `authenticated` has no UPDATE |

Grants: `anon` none; `authenticated` select/insert/update/delete (select/insert/delete on `quest_notes`). Supabase's default privileges would otherwise grant everything, so the migration revokes first.

## Learning sessions (M2)
| Object | Details |
|---|---|
| `learning_sessions` | quest_id (optional; FK `(quest_id, user_id)` → side_quests **on delete set null (quest_id)**), topic (≤160; required when there is no quest), pillar (standalone only), session_type (study/practice/build/watch/read/other), started_at, duration_minutes (1–1440), notes (≤4000), deleted_at. resource_id (optional; FK `(resource_id, user_id)` → learning_resources **on delete set null (resource_id)**, added in M3). |
| `lifeos_session_guard` (BEFORE INSERT OR UPDATE) | Inserts start active; soft delete stamps `deleted_at = now()`; restore only within 30 days by the database clock and only without other edits; deleted rows cannot be edited except the system changes (quest_id → null, empty topic filled). |
| `lifeos_preserve_session_topics` (BEFORE DELETE on side_quests) | Copies the quest title into empty session topics so deleting a quest never invalidates or destroys sessions. Runs with the caller's privileges. |
| `active_learning_sessions` view | `security_invoker = true`; all normal reads and analytics use it. Only "Recently deleted" reads the table directly. |
| TRUNCATE | Rejected by `lifeos_no_truncate`. |

Physical cleanup of expired soft-deleted rows happens lazily under the user's session when the learning log loads (31-day cutoff, conservative); logical expiry is enforced by the trigger.

## Resource Library (M3)
| Table | Key columns | Notes |
|---|---|---|
| `learning_resources` | url (http(s) only), canonical_url (https, **unique per user**), url_source and title_source (user/youtube/chrome/x), title (1–500), resource_type (article, documentation, video, playlist, book, paper, course, post, repository, other), origin (manual/chrome_html/chrome_extension/youtube/x; **immutable**, enforced by `lifeos_origin_guard`), category, status (saved/in_progress/completed/archived), completed_at (set ⇔ completed), notes, generated `search_document` | TRUNCATE rejected (and cascading into sessions is blocked by the sessions guard) |
| `resource_source_records` | resource_id, provider, external_id (**unique per user + provider**), source_url, source_title, provider_metadata (jsonb object), metadata_refreshed_at, sync_state, first_seen_at, last_seen_at | Provider data kept apart from the core record; cascades with its resource. Written by imports; `import_run_id` (M4, optional; FK `(import_run_id, user_id)` → import_runs **on delete set null (import_run_id)**) records which import touched the resource. |
| `quest_resources` | quest_id, resource_id, position, added_at; PK (quest_id, resource_id) | Both FKs include user_id; no UPDATE grant |

Canonical URLs (`canonicalizeUrl` in `features/resources/resource-domain.ts`): http(s) only; lowercase host without `www.`/trailing dot; default ports dropped; `https` in the key; fragment, `utm_*` and common click-id parameters removed; remaining parameters sorted; trailing slash removed; YouTube videos → `https://youtube.com/watch?v=ID`, playlists → `https://youtube.com/playlist?list=ID`; X/Twitter posts → `https://x.com/i/status/ID`. The original URL is kept for display.

## Imports (M4)
| Table | Key columns | Notes |
|---|---|---|
| `import_runs` | provider (chrome_html/chrome_extension/youtube/x), status (staged/completed/failed/cancelled/expired), file_name (≤255), items_seen/staged/skipped/imported/duplicate (≥0), error_code (slug only), expires_at (default now()+24h), completed_at (set ⇔ completed) | One row per upload; kept as import history. `updated_at` trigger. |
| `import_candidates` | import_run_id (FK `(import_run_id, user_id)` **on delete cascade**), position, url (http(s)), canonical_url (https; **unique per run**), title (≤500), folder_path (≤1000), resource_type, source_added_at, already_in_library | Short-lived staging rows; deleted when the run is confirmed, cancelled or expires. No UPDATE grant. |

## Legacy tables kept unchanged
`rabbit_holes`, `rabbit_hole_resources`, `rabbit_hole_experiments`, `study_sessions` are preserved and unused by the app. `knowledge_notes` is reused by the Notes page.

## Rollback notes
- 20261126130000: drop the `resource_source_records.import_run_id` column (and its FK and index), then `import_candidates` and `import_runs`. Resources created by imports are unaffected.
- 20261126120000: drop `quest_resources`, `resource_source_records`, the `learning_sessions.resource_id` column (after recreating the M2 view and guard), and `learning_resources`.
- 20261126110000: drop `active_learning_sessions`, the `lifeos_preserve_session_topics` trigger on side_quests, `learning_sessions`, and both functions.
- 20261126100000: no automatic down migration. If never used, drop `quest_notes`, `quest_milestones`, `quest_objectives`, `side_quests` and `lifeos_reject_truncate()`; no legacy object depends on them.
- 20261126090000: `grant execute on function public.lifeos_handle_new_user() to public, anon, authenticated;` restores the previous state (not recommended).
