# Implementation status

Last updated: 2026-11-26 (M2 Learning sessions). Status values: **Complete**, **Partial**, **UI only**, **Backend only**, **Placeholder**, **Missing**, **Blocked**.
"Verified" means exercised against the staging Supabase project (`vexgemyvefxhizavhpqc`), not production.

## Platform and infrastructure

| Feature | Status | Files | Migration | Tests | Remaining blockers |
|---|---|---|---|---|---|
| Supabase CLI config + staging project | Complete | `supabase/config.toml`, `supabase/.gitignore`, `.gitignore` | – | Staging rebuilt from repo migrations; parity audit vs production | Production migration history uses different version numbers; never run `db push` against production (see ARCHITECTURE.md) |
| Auth (email/password, Supabase Auth) | Complete | `app/auth/*`, `app/login`, `lib/supabase/*`, `proxy.ts` | core | Real-session tests on staging | – |
| Auth trigger hardening (`lifeos_handle_new_user` EXECUTE) | Complete | `supabase/migrations/20261126090000_revoke_handle_new_user_execute.sql` | 20261126090000 | Staging advisor clean; sign-up still creates profile | Applied to staging only; production already in this state |
| Navigation (sidebar incl. Side Quests, Learning log, Library; breadcrumbs; mobile bar unchanged) | Complete | `components/layout/app-shell.tsx` | – | Browser QA desktop + 375px | – |
| Page session helper | Complete | `lib/page-session.ts` | – | Used by quest and notes pages | – |
| Next.js security upgrade (16.4.3 → 16.4.5) | Blocked (owner decision) | `package.json`, `pnpm-lock.yaml` (in `stash@{0}`) | – | – | Kept as a separate commit by request. Installed `node_modules` currently has 16.4.5 while the lockfile pins 16.4.3 |

## Modules

| Module | Feature | Status | Files | Migration | Tests | Remaining blockers |
|---|---|---|---|---|---|---|
| Home dashboard | Today overview, tasks, habits, goals list | Partial | `app/page.tsx`, `features/dashboard/*` | core | `tests/task-status.test.mjs` | Learning, calendar, physical and weekly summaries not yet on the dashboard (M5/M9) |
| Tasks | Create, complete (writes `done`), open-task filtering | Partial | `features/dashboard/dashboard-actions.ts`, `features/tasks/task-status.ts` | core | `tests/task-status.test.mjs`, staging RLS tests | No task page: edit, delete, reopen, due dates in UI, search, filters missing |
| Habits | Create/edit/archive, check-ins, partial, rest, streaks, analytics | Complete | `features/habits/*`, `app/habits/*` | core | `tests/habit-domain.test.mjs` | – |
| Goals | Read-only list on dashboard | Backend only | `features/dashboard/dashboard-service.ts` | core (goals, goal_milestones, goal_progress_entries) | staging FK tests | No goals UI (create, milestones, progress entries) |
| Daily planner | – | Placeholder | `app/[section]/page.tsx` | – | – | Not started |
| Calendar | Google Calendar OAuth connect/test/disconnect via Vercel Connect | Partial | `features/calendar/*`, `app/settings/calendar/*` | 20261112 | – | Event sync not implemented (`habit_calendar_events` unused); no calendar views |
| **Side Quests (M1)** | Quest CRUD, structured/exploratory, status lifecycle, objectives, milestones, progress, notes links, delete preserves notes and sessions, weekly-target attainment (current week) | **Complete** | `features/quests/*`, `app/quests/*` | 20261126100000 | `tests/quest-domain.test.mjs`, `tests/side-quests-migration.test.mjs`, `tests/integration/side-quests-rls.test.mjs`; browser QA on staging | – |
| **Knowledge vault – Notes (M1)** | List, full-text search, linked/unlinked filter, create, edit, delete, link/unlink quests | **Complete (minimal scope)** | `features/notes/*`, `app/knowledge/*` | core (knowledge_notes) + 20261126100000 (quest_notes) | `tests/note-domain.test.mjs`, integration test, browser QA | Tags, note-to-note links, book links deferred to a later Knowledge Vault milestone |
| **Learning sessions (M2)** | Log, edit, soft delete with Undo, Recently deleted (strict 30-day restore, DB clock), permanent delete, lazy cleanup, standalone sessions with topic/pillar, quest-linked sessions, quest panel with weekly target, timezone-aware entry | **Complete** | `features/learning/*`, `app/learning/*`, `features/quests/components/quest-detail.tsx` | 20261126110000 | `tests/learning-domain.test.mjs`, `tests/learning-sessions-migration.test.mjs`, `tests/integration/learning-sessions-rls.test.mjs`; 15 superuser integrity checks; browser QA on staging (Asia/Kolkata) | `resource_id` link arrives with M3 |
| Resource Library (M3) | – | Placeholder | `app/[section]/page.tsx` (`/library`) | – | – | Not started |
| Chrome bookmark import (M4) | – | Missing | – | – | – | Depends on M3 |
| Life Analytics (M5) | – | Placeholder | `app/[section]/page.tsx` (`/analytics`) | – | – | Depends on M2–M4 |
| YouTube (M6) | – | Blocked | – | – | – | Needs custom domain, Google OAuth verification, privacy/terms pages, Vercel Connect revocation check, pg_cron |
| Chrome extension (M7) | – | Missing | – | – | – | Depends on M4 |
| X integration (M8) | – | Blocked | – | – | – | Feasibility review: paid API, OAuth path unconfirmed |
| Physical | – | Placeholder | `app/[section]/page.tsx` | core (workouts, running_sessions, body_metrics, sleep_logs) | – | No UI |
| Settings | Google Calendar integration | Partial | `app/settings/page.tsx`, `features/calendar/*` | – | – | Profile, timezone, preferences, data management missing |
| Other pillars (Intellectual, Academic, Professional, Communication) | – | Placeholder | `app/[section]/page.tsx` | core tables exist | – | No UI |
| Weekly reviews | – | Placeholder | `app/[section]/page.tsx` (`/reviews`) | core | – | No UI |
