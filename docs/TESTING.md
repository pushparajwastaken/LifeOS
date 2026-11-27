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
M9 was checked with a seeded user (2 tasks and 60 min of learning in each of four baseline weeks, 5 tasks and 30 min last week, 1 task and 45 min over two days this week): Home showed 1 / 5 tasks, 45 min / 30 min, 2 / 1 days; `/analytics` showed tasks "higher than the usual 2", learning time "lower than the usual 1 h", sessions and active days "about the same", and no comparison for the unmeasured on-time rate. A second user saw zeros, no comparisons and only empty states. Both pages fit 375px.

M7 was checked on `/library/import` with the built `config.js`, `lib.js` and `content.js` loaded into the page and the service worker and approval window replaced by a stub: "not installed" state, detection, deny, cancel, a forged result with an unknown request id (ignored), approve (staged with the existing link flagged, markup in a title shown as text), confirm (resources saved with `origin = chrome_extension`, existing resource unchanged, provenance recorded, candidates removed), forged invalid payloads rejected by the server, 375px layout. **Not yet done:** loading `extension/dist` in a real Chrome profile (permission prompt, approval window, `documentId` delivery).

M5 was checked with a seeded user whose expected figures were worked out by hand (tasks on time and late, overdue, goal milestones and progress, a daily habit with rest and skipped days, quest sessions plus a soft-deleted one, weekly target, resources, an import with duplicates, structured quest progress) and a second user who must see only empty states. Also checked: 375px layout without horizontal scrolling.

M4 was exercised with a sample export: preview counts and skips, in-file and library duplicates, script-like titles rendered as text, empty selection, confirm with partial selection, re-import, cancel, non-bookmark/empty/oversize files, and the 375px layout.

Run the dev server with a temporary, gitignored `.env.local` pointing at staging, sign in as a disposable user, and exercise the workflow. Remove `.env.local` afterwards.

## Not yet automated
- No ESLint configuration in the repo.
- No UI test runner; browser QA is manual (scripted in the in-app browser).
