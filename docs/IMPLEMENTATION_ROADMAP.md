# Implementation roadmap

Each milestone lands as its own reviewable branch with migrations tested on staging first. Production changes always need separate approval.

| Milestone | Scope | Status | Key dependencies |
|---|---|---|---|
| M0 | Task status fix; staging rebuilt from repo migrations; parity audit; auth-trigger EXECUTE revoke | Done | – |
| M1 | Side Quests (quests, objectives, milestones, notes links) and minimal Notes page at `/knowledge` | Done (commit `1524b05`) | – |
| M2 | Learning sessions: optional quest/resource, required topic when standalone, 1–1440 minutes, soft delete with strict 30-day restore, `active_learning_sessions` view, quest-delete topic trigger, TRUNCATE guard | Done (commit `934b170`) | M1 |
| M3 | Resource Library: canonical URLs, immutable origin, url/title provenance, source records, quest attachments, search; adds `learning_sessions.resource_id` | Done on branch `feature/m3-resource-library` | M2 |
| M4 | Chrome bookmarks HTML import: server-side staging, preview, selection, dedup, import history | Done on branch `feature/m4-chrome-import` | M3 |
| M5 | Life Analytics: metric kinds (`event_exact`, `event_approximate`, `current_state`), five metric groups, Right now / Over time zones; dashboard integration | Done on branch `feature/m5-life-analytics` (Home dashboard integration still to do) | M2–M4 |
| M6 | YouTube integration with 30-day refresh/purge and `pg_cron` | Blocked externally | Custom domain, Google verification, privacy/terms pages, Vercel Connect revocation check |
| M7 | Chrome extension (optional bookmarks permission, page-to-extension messaging) | Done on branch `feature/m7-chrome-extension` (manual check in real Chrome still to do) | M4 |
| M8 | X integration feasibility | Done: review in `docs/X_FEASIBILITY.md`; recommendation is links only, no API sync for now | Paid API, OAuth path |
| M9 | Advanced analytics and product polish | In progress on `feature/m9-advanced-analytics`: last-week-vs-usual comparisons, parallel analytics loading, Home weekly summary and the Tasks page done; Goals, Settings (profile/timezone), Daily planner, Physical and Calendar views still to do | M5 |

## Existing modules still to complete (in parallel)
- **Tasks**: task page with edit, delete, reopen, due dates, filters, search.
- **Goals**: create/edit goals, milestones, progress entries, detail page.
- **Daily planner**: plan the day from tasks, habits, calendar and learning sessions without duplicating them.
- **Calendar**: event sync for habit calendar events, calendar views.
- **Physical**: workouts, runs, body metrics, sleep (tables exist).
- **Settings**: profile, timezone, preferences, data management.
- **Home**: add learning, calendar and physical summaries once those modules exist.
