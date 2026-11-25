# Database schema

Source of truth: `supabase/migrations/`. Applied in this order (text order of versions):

| Version | File | Contents |
|---|---|---|
| 202611110001 | `202611110001_lifeos_core.sql` | 39 tables: profiles, habits, habit_logs, tasks, reviews, goals (+ milestones, progress entries), physical, reading and knowledge, academic, professional, rabbit holes, DSA, communication; `lifeos_set_updated_at`, `lifeos_handle_new_user` + trigger on `auth.users`; owner RLS on every table |
| 20261112 | `20261112_habit_google_calendar_sync.sql` | `habit_calendar_connections`, `habit_calendar_events` (status only; tokens live in Vercel Connect) |
| 20261126090000 | `20261126090000_revoke_handle_new_user_execute.sql` | Revokes EXECUTE on the SECURITY DEFINER auth trigger function from public/anon/authenticated (matches production) |
| 20261126100000 | `20261126100000_side_quests_core.sql` | Side Quests (below) and the TRUNCATE guard |
| 20261126110000 | `20261126110000_learning_sessions.sql` | Learning sessions, `active_learning_sessions` view, soft-delete guard, quest-delete topic trigger |

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
| `learning_sessions` | quest_id (optional; FK `(quest_id, user_id)` → side_quests **on delete set null (quest_id)**), topic (≤160; required when there is no quest), pillar (standalone only), session_type (study/practice/build/watch/read/other), started_at, duration_minutes (1–1440), notes (≤4000), deleted_at. `resource_id` is added in M3 with `learning_resources`. |
| `lifeos_session_guard` (BEFORE INSERT OR UPDATE) | Inserts start active; soft delete stamps `deleted_at = now()`; restore only within 30 days by the database clock and only without other edits; deleted rows cannot be edited except the system changes (quest_id → null, empty topic filled). |
| `lifeos_preserve_session_topics` (BEFORE DELETE on side_quests) | Copies the quest title into empty session topics so deleting a quest never invalidates or destroys sessions. Runs with the caller's privileges. |
| `active_learning_sessions` view | `security_invoker = true`; all normal reads and analytics use it. Only "Recently deleted" reads the table directly. |
| TRUNCATE | Rejected by `lifeos_no_truncate`. |

Physical cleanup of expired soft-deleted rows happens lazily under the user's session when the learning log loads (31-day cutoff, conservative); logical expiry is enforced by the trigger.

## Legacy tables kept unchanged
`rabbit_holes`, `rabbit_hole_resources`, `rabbit_hole_experiments`, `study_sessions` are preserved and unused by the app. `knowledge_notes` is reused by the Notes page.

## Rollback notes
- 20261126110000: drop `active_learning_sessions`, the `lifeos_preserve_session_topics` trigger on side_quests, `learning_sessions`, and both functions.
- 20261126100000: no automatic down migration. If never used, drop `quest_notes`, `quest_milestones`, `quest_objectives`, `side_quests` and `lifeos_reject_truncate()`; no legacy object depends on them.
- 20261126090000: `grant execute on function public.lifeos_handle_new_user() to public, anon, authenticated;` restores the previous state (not recommended).
