# Analytics metrics (contract for M5)

Implemented in M5: `features/analytics/analytics-domain.ts` (metric catalogue and weekly maths), `features/analytics/analytics-service.ts` (queries), `/analytics` (page). The catalogue in code is checked against this contract by `tests/analytics-domain.test.mjs`.

## Rules
- Aggregate source tables on demand; no snapshot tables or materialized views.
- Default window 12 weeks; days in the profile timezone; weeks Monday–Sunday; empty data shows a blank, not 0%.
- Every metric declares a kind: `event_exact`, `event_approximate` (with reasons: `editable_timestamp`, `undoable`, `mutable_config`, `automatic_purge`) or `current_state`.
- "Over time" charts show events only; approximate events get a footnote; `current_state` metrics appear only as "as of today" with no trends or comparisons.
- The five groups are never combined into one score.

## Groups
| Group | Metrics (kind) |
|---|---|
| Productivity | tasks completed, on-time rate, goal progress trend, goal milestones (event_approximate); tasks overdue, goals completed (current_state) |
| Habit consistency | consistency %, missed, streaks (event_approximate: schedule edits re-score history); rest days excluded; today never counted as missed |
| Learning effort | minutes, sessions, active days, by quest/pillar/type (event_approximate: sessions are editable); weekly target attainment (current week only) |
| Resource collection | resources added, by origin, duplicate matches (event_approximate: automatic purge); import run counts (event_exact); backlog, attached (current_state) |
| Learning progress | resources, objectives, milestones, quests completed (event_approximate: undoable); quest progress % (current_state, structured quests only) |

Saving, importing, attaching or opening resources never counts as learning effort or activity.

## Implementation decisions (M5)
- **Reads only.** No new tables, views or migrations. Every query filters by `user_id` and runs as the signed-in user, so RLS applies.
- **Window.** Events from one day before the first window week are fetched, then bucketed exactly by local date in the profile timezone; future-dated events are ignored.
- **Tasks completed / on time.** Tasks with status `done`, bucketed by `completed_at`. On time means `completed_at <= due_at`; tasks without a due date are excluded from the rate (blank when none).
- **Goal progress trend.** Shown as the number of progress updates per week (`goal_progress_entries.recorded_at`), since goals use different units.
- **Habit consistency.** Completed ÷ scheduled opportunities per week, rest days excluded. Today counts only after it has been logged, so an unlogged today neither lowers the rate nor counts as missed. Skipped check-ins count against consistency but are not "missed". Best current streak uses the existing habit streak rules, active habits only.
- **Learning effort.** From `active_learning_sessions` (soft-deleted sessions excluded). Pillar for quest sessions comes from the quest. Weekly target attainment counts active or paused quests with a target whose minutes this week (Monday to today) reach it.
- **Resource collection.** Resources added by `created_at`; duplicate matches are the summed `items_duplicate` of completed imports; imports completed are completed `import_runs`. Backlog = saved + in progress; attached = distinct resources linked to any quest.
- **Learning progress.** Completions by their timestamps (resources, objectives `achieved_at`, quest milestones, quests). Quest progress = mean milestone completion across open structured quests that have milestones; exploratory quests never get a percentage.
- **Display.** Each group has a "Right now · as of today" zone (current_state only) and an "Over time · last 12 weeks" zone (events only, one bar per week, blank for weeks with nothing to measure). Approximate metrics carry an asterisk and a footnote listing their reasons. Each chart has an equivalent screen-reader table. Groups with no data show an empty state with a link to start.
- **Historical comparison (M9).** Selected event metrics (tasks completed, on-time rate, goal progress updates, habit consistency, learning minutes/sessions/active days, resources added and completed) show "Last full week X, higher / lower than / about the same as the usual Y (4 weeks before)". The current partial week is never compared. Rates need last week measured and at least 3 of the 4 baseline weeks; counts need the first recorded activity in the window on or before the first baseline week (earlier empty weeks are not read as zero effort). "About the same": within 5 points for rates, within 10% or under one unit for counts. Wording is neutral; no colours for good or bad. Imports, duplicates and missed check-ins are not compared. Logic: `compareLastWeek` in `analytics-domain.ts`.
- **Home summary (M9).** Home shows "This week so far" (Monday to today) for tasks completed, learning time and days with learning, each next to last week's full total, with a link to `/analytics`. It is a factual pair, not a comparison score.
- **Loading (M9).** All analytics queries run in parallel with the profile and habits load; the start date is derived from the UTC date one day back so it never starts after the local window.
- **Goal readings (M9).** A progress entry is a reading of the current total, not an increment; goal progress uses the latest reading against the target. Analytics still counts readings per week as "progress updates".
- **Limits.** Each source is capped at 5,000 rows per load; when a cap is hit, the page says older weeks may be undercounted.
