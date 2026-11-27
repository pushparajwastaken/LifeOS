# Security

## Access model
- Every user-owned table has RLS enabled with an owner-only policy (`auth.uid() = user_id`).
- Foreign keys to user-owned parents include `user_id`, so rows cannot be linked across users even by guessing ids.
- The application uses only the anon/publishable key plus the user's session. **No service-role key in app code.**
- Server actions validate input with zod, re-check ownership server-side, and filter every write by `user_id`.
- Redirect targets from forms are allow-listed (`safeReturnPath` in `features/notes/note-actions.ts`) to prevent open redirects.
- User text is rendered as plain text (React escaping); no `dangerouslySetInnerHTML` outside the chart style component. Note source links accept only http(s) and open with `rel="noopener noreferrer nofollow"`.

## Database hardening
- `lifeos_handle_new_user()` (SECURITY DEFINER) is executable only by `postgres` and `service_role`.
- `lifeos_reject_truncate()` blocks `TRUNCATE` (including `CASCADE`) on `side_quests` and `learning_sessions`.
- Learning-session soft delete is enforced in the database: deletion time comes from the database clock, restore is impossible after 30 days even before cleanup runs, and deleted rows cannot be edited. Superusers can still bypass triggers; never truncate these tables.
- New tables revoke Supabase's default ALL grants and grant only what the app needs; link tables have no UPDATE.
- Resource URLs: only http(s) accepted (domain and database checks); LifeOS never fetches user-supplied URLs (no SSRF surface); links open with `rel="noopener noreferrer nofollow"`.
- Bookmark imports: the file is read in a server action (≤5 MB by the parser; the server-action body limit is 6 MB), must be named `.html`/`.htm` and contain the Netscape bookmark doctype or structure. Parsing is a bounded tokenizer (no HTML evaluation, no DOM); only http(s) links survive canonicalization (bookmarklets, `javascript:`, `data:`, `chrome://` and `file:` are skipped). Titles are stored as text and rendered escaped by React. LifeOS does not visit any imported link.
- Confirming an import re-reads the selected candidates from the database (only UUIDs come from the form), checks the run is owned, staged and unexpired, verifies an optional quest's ownership, and inserts with `ignoreDuplicates` so existing resources are never overwritten.
- Resource origin is immutable (trigger); provenance of URL and title values is recorded for later provider purges.

## Verified on staging
- 41/41 two-user RLS and integrity tests on the reconstructed schema (2026-11-25).
- M1 two-user integration test: reads, updates, deletes, inserts, ownership spoofing, cross-user note links, duplicate links, constraint violations, quest deletion preserving notes.
- Supabase security advisor: no findings after migrations 20261126090000 and 20261126100000.

- M4 two-user integration test: import runs and candidates isolated per user; staging into another user's run, attributing provenance to another user's run, editing candidates and anonymous access are rejected. Security advisor clean after 20261126130000.

- M5 analytics only reads data: no new tables, functions or grants. Every query filters by `user_id` under the user's own session (RLS still applies), and the browser check confirmed a second user sees none of the first user's figures.

- M7 Chrome extension: no host permissions, no `tabs`, no `externally_connectable`; the `bookmarks` permission is optional, requested only from the extension's own approval window and can be given back after each send. The content script runs only on origins fixed at build time (https, or http for localhost) and relays only well-formed messages from its own window and origin. Requests are accepted only from a top frame of an allowlisted origin; results go only to the requesting tab and document and are accepted by the page only for its own random request id. Extension pages use `script-src 'self'` and set text with `textContent`. The server treats the payload as untrusted (zod, 5 MB and 5,000-link limits, http(s) only, re-canonicalised), and nothing is saved until the user confirms the review. Another extension on the same page could post fake results; the worst case is extra links in a review the user must still confirm.

- Tasks page (M9): every write goes through server actions that validate with zod, scope by `user_id` (RLS still applies), only move a task between allowed statuses, accept return paths only on `/tasks`, and escape LIKE wildcards in search.

- Goals (M9): every child write (readings, milestones, status) first loads the goal by id and `user_id` on the server; the composite `(goal_id, user_id)` foreign keys and RLS enforce the same in the database. Verified on staging by replaying another user's form.

- Settings (M9): the profile update is limited to the signed-in user's row and validates the timezone against the runtime. The data export (`/settings/export`) runs under the user's session (RLS) and also filters by owner; table names come from a static list checked against the migrations by a test; responses are `no-store` attachments; signed-out requests are redirected by the proxy. No tokens are stored in LifeOS tables, so none can be exported.

## Known items
- Production Auth: "leaked password protection" is disabled (Auth setting, owner decision).
- Performance advisor: RLS policies call `auth.uid()` per row (lint 0003) across all tables; switching to `(select auth.uid())` should be done for every table together in a dedicated migration.
- Disposable staging test users must be deleted after tests (see TESTING.md).
- **Broad table grants on the older core tables (staging and production, verified read-only 2026-11-27):** `anon` and `authenticated` hold every table privilege, including `TRUNCATE` (and `anon` holds writes), on about 40 tables created before M1 (for example `tasks`, `goals`, `habits`, `profiles`, `workouts`). RLS limits rows for SELECT/INSERT/UPDATE/DELETE, but `TRUNCATE` is not subject to RLS. The Data API does not expose TRUNCATE, so the practical exposure is low, but a hardening migration (revoke `TRUNCATE`, `REFERENCES`, `TRIGGER` from both roles and all privileges from `anon`, like the M1+ tables) is recommended. Not applied: production changes need the owner's authorization.
