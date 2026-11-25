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
| `side-quests-migration.test.mjs` | Static allowlist: every statement in the M1 migration matches an approved shape; legacy tables untouched; RLS, policies, grants, triggers present; every FK includes `user_id` |

## Staging integration tests (real Supabase Auth sessions)
`tests/integration/side-quests-rls.test.mjs` and `tests/integration/learning-sessions-rls.test.mjs` are skipped unless these variables are set (never commit them):
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

## Browser QA (staging)
Run the dev server with a temporary, gitignored `.env.local` pointing at staging, sign in as a disposable user, and exercise the workflow. Remove `.env.local` afterwards.

## Not yet automated
- No ESLint configuration in the repo.
- No UI test runner; browser QA is manual (scripted in the in-app browser).
