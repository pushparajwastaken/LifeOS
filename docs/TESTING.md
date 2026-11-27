# Testing

## Unit and static tests (no network)
```bash
node --test tests/*.test.mjs
```
| File | Covers |
|---|---|
| `habit-domain.test.mjs` | Timezones, schedules, period metrics, streaks |
| `task-status.test.mjs` | Task status contract vs the database constraint, completion and reopen timestamps, open-task filter |
| `quest-domain.test.mjs` | Quest constants vs SQL checks and `HABIT_PILLARS`, status transitions, timestamps, progress (no percentage for exploratory), input validation |
| `note-domain.test.mjs` | Note types vs SQL check, http(s)-only links, validation, search normalisation |
| `learning-domain.test.mjs` | Session constants vs SQL, topic rule, 1–1440 minutes, timezone and DST conversion, week totals, target attainment, restore window |
| `learning-sessions-migration.test.mjs` | Static allowlist for M2; only change to an existing table is the quest-delete trigger; soft-delete rules present |
| `resource-domain.test.mjs` | URL canonicalization (unsafe schemes, host/query/port normalisation, tracking params, YouTube and X variants), type detection, validation, filters |
| `resource-library-migration.test.mjs` | Static allowlist for M3 including the permitted changes to M2 objects; constants vs SQL; dedup and FK rules |
| `core-grants-migration.test.mjs` | Grants migration has only read-only preconditions, one revoke and one grant over the same tables; never touches the legacy tables; covers every table created before M1 |
| `calendar-view-domain.test.mjs` | Month parsing and limits, month shifting across years, six-week Monday-first grids, selected day kept inside the grid, per-day summaries and accessible descriptions, links |
| `physical-domain.test.mjs` | Physical limits vs the core migration, duration parsing (minutes, m:ss, h:mm:ss), pace and clock formatting, km/mi conversion, workout/run/body/sleep/set validation, weight change against an entry at least 4 weeks older (unit-aware) |
| `planner-domain.test.mjs` | Planner date parsing and links, due-time rules (keep the time, never plan into the past, next day, unschedule), review input and that review prompts are real `daily_reviews` columns, planned load |
| `settings-domain.test.mjs` | Timezone validation and picker (current IANA names instead of ICU legacy ones), profile name cleaning and default, export table list covers every migration table with a `user_id` column, export file name |
| `goal-domain.test.mjs` | Goal literals vs the core migration (pillars, periods, statuses, title length), period end dates, goal/progress/milestone validation (decimals, commas, limits, custom end after start), latest-reading progress capped at 100%, milestone fallback, period position, status transitions |
| `task-domain.test.mjs` | Task input validation (trim, limits, real dates, times, estimates), end-of-day default and date clearing, filter parsing and links, return-path allowlist, LIKE escaping, status transitions against the status contract, overdue/today/upcoming/undated grouping |
| `analytics-domain.test.mjs` | Metric catalogue vs the contract (kinds, reasons, groups), Monday weeks and 12-week window, timezone and DST dates, weekly counts/sums/distinct days, blank (null) rates, on-time rule, breakdowns, footnotes, last-week-vs-usual comparisons (history rules, blanks, thresholds); module importable without the bundler |
| `extension-lib.test.mjs` | Extension helpers (folder listing, http(s)-only collection, duplicates, limits), page-message protocol, exact origin checks, build-script origin validation and manifest permissions, and the real content script run against stubbed `window`/`chrome` (own window and origin only, own extension only, inert elsewhere) |
| `extension-payload.test.mjs` | Server-side validation of extension payloads: schema, size and count limits, unsafe schemes, re-canonicalisation and de-duplication, text cleaning |
| `bookmark-parser.test.mjs` | Netscape bookmark parsing: folders, entities, unsafe schemes skipped, in-file duplicates, limits, non-bookmark input |
| `resource-imports-migration.test.mjs` | Static allowlist for M4; only change to an existing table is `resource_source_records.import_run_id`; constants vs SQL |
| `side-quests-migration.test.mjs` | Static allowlist: every statement in the M1 migration matches an approved shape; legacy tables untouched; RLS, policies, grants, triggers present; every FK includes `user_id` |

## Staging integration tests (real Supabase Auth sessions)
`tests/integration/side-quests-rls.test.mjs`, `learning-sessions-rls.test.mjs` , `resource-library-rls.test.mjs` and `resource-imports-rls.test.mjs` are skipped unless these variables are set (never commit them):
`LIFEOS_TEST_SUPABASE_URL`, `LIFEOS_TEST_SUPABASE_ANON_KEY`, `LIFEOS_PRODUCTION_PROJECT_REF` (only used to refuse production),
`LIFEOS_TEST_USER_A_EMAIL`, `LIFEOS_TEST_USER_A_PASSWORD`, `LIFEOS_TEST_USER_B_EMAIL`, `LIFEOS_TEST_USER_B_PASSWORD`.

```bash
node --test tests/integration/*.test.mjs
```

### Disposable staging users
Create two users **in staging only** (SQL editor or the Supabase plugin) with your own throwaway passwords:
```sql
-- repeat per user; replace <id>, <email>, <password>
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token)
values ('00000000-0000-0000-0000-000000000000', '<id>', 'authenticated', 'authenticated', '<email>',
  extensions.crypt('<password>', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"display_name":"QA"}',
  now(), now(), '', '', '', '', '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '<id>', '<id>', jsonb_build_object('sub', '<id>', 'email', '<email>', 'email_verified', true), 'email', now(), now(), now());
```
Remove them afterwards (cascades all their data; never use TRUNCATE):
```sql
delete from auth.users where email like 'qa-rls-%@lifeos-staging.test';
```

## Database checks run as postgres on staging (M1)
- `truncate public.side_quests cascade` → rejected by `lifeos_no_truncate`.
- Reopening a completed quest while keeping `completed_at` → `23514`.
- Re-running the M1 preconditions → fails with "tables already exist".
- Legacy-table fingerprint (columns, constraints, indexes, policies, triggers, RLS, grants) identical before and after the migration.

## Database checks run as postgres on staging (M2)
Run in one transaction that ends with a deliberate exception (nothing persists): inserts start active; standalone without topic, blank topic, 0 and 1441 minutes rejected; soft delete stamps now(); view hides deleted rows; editing a deleted row, changing deleted_at, and restoring with edits are rejected; restore within 30 days works and after 30 days fails; deleting a quest keeps its sessions with the topic preserved; TRUNCATE rejected.

## Database checks run as postgres on staging (M3)
Rolled back: duplicate canonical URL per user rejected (other users allowed); javascript: URL rejected; origin change rejected; completed without timestamp rejected; cross-user link rejected; view exposes resource_id; TRUNCATE rejected; deleting a quest keeps resources; deleting a resource keeps sessions (including a soft-deleted one, which stays deleted) and removes source records.

## Browser QA (staging)
Core grants hardening (2026-11-28): after applying the migration to staging, signed in as a test user and wrote through the app to every changed table type (tasks, goals, goal readings and milestones, runs, sleep, body weight, workouts, exercises, sets, daily review, profile, habit and check-in, note); `/analytics`, `/calendar`, `/goals`, `/tasks`, `/planner`, `/physical` loaded; the data export read all 51 tables with no errors; new users still got profiles from the auth trigger; integration tests 4/4.

Calendar view (M9): seeded tasks due and done, learning, a run, a rest day, a goal end, goal and quest milestones and another user's task; today's cell read "2 tasks due, 1 done, 45 min learning, 1 training session", Monday 30 Nov "1 task due, 2 deadlines", 2 Dec "1 deadline", the rest day "rest day"; today's agenda listed every record in order with times; next month, selecting 15 Dec (agenda and planner link), invalid month/day falling back to this month, no other user's data, 375px (41px cells, no horizontal scroll) and 1280px.

Physical (M9): seeded two weeks across a Monday boundary with a run in miles; "this week" (1 workout, 12.8 km over 2 runs, 7 h average sleep, 73.2 kg with -1.8 kg since Oct 23) and last week's chart values (2 workouts, 5 km, 7.5 h) matched hand calculations; paces correct; invalid duration and a future date refused; run, weight and sleep logged (re-logging a night replaced it); workout created and opened, exercise and sets added, empty set refused, set deleted; user B replaying user A's add-set form refused and nothing written; rest day counted separately; delete from the recent list; 375px.

Daily planner (M9): overdue task carried over and planned for today (a passed 18:00 time became end of day), backlog task planned, task moved to the next day (time kept), task unscheduled back to the backlog, complete from the planner, quick add with estimate, daily review saved and shown on its day, a forged future-dated review refused, tomorrow showing today's intention, past days read-only for planning, invalid date falling back to today, quest titles shown for sessions of any quest status, 375px. A double-clicked "next day" first moved the task two days (server actions run one after another); fixed by sending the due date the user saw and by disabling row buttons while pending, then re-tested.

Settings (M9): profile save (markup in the name shown as text, sidebar updated), injected unknown timezone rejected, "use this device's timezone" mapping the browser's `Asia/Calcutta` to `Asia/Kolkata`, data export (51 tables, all 1,005 seeded sessions across pages, no other user's rows, attachment with `no-store`), signed-out export redirected to login, sign out from Settings, 375px.

Goals (M9): create (invalid custom period rejected), "Day 27 of 90", readings (latest counts, 120 of 300 km = 40%; future date and negative value rejected), milestones (add, double-submitted reach recorded once, reopen, delete), pause/resume/achieve/reopen, edit to a custom period without a target (progress switches to milestones), delete refused without and done with the confirmation, user B replaying user A's milestone form refused with "record not found" and nothing written, B's list and A's URL show none of A's data, 375px. Note: scripted rapid re-submits while a navigation was in flight created duplicate milestones; real clicks are protected because submit buttons disable while pending.

Tasks (M9) were checked as a user in Asia/Kolkata: grouping (overdue, upcoming, no date), add with date and time (09:30 IST stored as 04:00 UTC), invalid input rejected, literal `%` search, complete, start, cancel, reopen from the Done view (filters kept), double-clicked complete reported once without error, edit with the date cleared, delete refused without the confirmation box and done with it, another user's task never shown, 375px layout, Home "All tasks" link.

M9 was checked with a seeded user (2 tasks and 60 min of learning in each of four baseline weeks, 5 tasks and 30 min last week, 1 task and 45 min over two days this week): Home showed 1 / 5 tasks, 45 min / 30 min, 2 / 1 days; `/analytics` showed tasks "higher than the usual 2", learning time "lower than the usual 1 h", sessions and active days "about the same", and no comparison for the unmeasured on-time rate. A second user saw zeros, no comparisons and only empty states. Both pages fit 375px.

M7 was checked on `/library/import` with the built `config.js`, `lib.js` and `content.js` loaded into the page and the service worker and approval window replaced by a stub: "not installed" state, detection, deny, cancel, a forged result with an unknown request id (ignored), approve (staged with the existing link flagged, markup in a title shown as text), confirm (resources saved with `origin = chrome_extension`, existing resource unchanged, provenance recorded, candidates removed), forged invalid payloads rejected by the server, 375px layout. **Not yet done:** loading `extension/dist` in a real Chrome profile (permission prompt, approval window, `documentId` delivery).

M5 was checked with a seeded user whose expected figures were worked out by hand (tasks on time and late, overdue, goal milestones and progress, a daily habit with rest and skipped days, quest sessions plus a soft-deleted one, weekly target, resources, an import with duplicates, structured quest progress) and a second user who must see only empty states. Also checked: 375px layout without horizontal scrolling.

M4 was exercised with a sample export: preview counts and skips, in-file and library duplicates, script-like titles rendered as text, empty selection, confirm with partial selection, re-import, cancel, non-bookmark/empty/oversize files, and the 375px layout.

Run the dev server with a temporary, gitignored `.env.local` pointing at staging, sign in as a disposable user, and exercise the workflow. Remove `.env.local` afterwards.

## Not yet automated
- No ESLint configuration in the repo.
- No UI test runner; browser QA is manual (scripted in the in-app browser).
