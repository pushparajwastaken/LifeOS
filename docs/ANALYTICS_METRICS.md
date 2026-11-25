# Analytics metrics (contract for M5)

Not implemented yet. This is the approved contract the implementation must follow.

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
