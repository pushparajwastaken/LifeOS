# Integrations

| Integration | Status | Credential handling | Notes |
|---|---|---|---|
| Google Calendar | Connect, test and disconnect implemented; event sync not implemented | Vercel Connect connector `google/lifeos-calendar` holds tokens; LifeOS stores only connection status (`habit_calendar_connections`) | `habit_calendar_events` exists but is unused |
| Chrome bookmarks (HTML file) | Complete (M4) | No credentials | Server-side parsing of an uploaded export (any Netscape-format browser export works); preview and explicit selection before import; links are never fetched |
| YouTube | Blocked (M6) | Planned: separate Vercel Connect connector, `youtube.readonly` | Requires custom verified domain, Google sensitive-scope verification, `/privacy` and `/terms` pages, verifying that Vercel Connect revocation revokes at Google, and `pg_cron` for the 30-day purge. API data (ids, titles, thumbnails) must be refreshed or deleted within 30 days; no derived metrics from API data. |
| Chrome extension | Planned (M7) | None: page-to-extension messaging with origin allowlist and popup approval | Optional `bookmarks` permission, read-only code |
| X (Twitter) bookmarks | Feasibility review (M8) | Unresolved: Vercel Connect support for X unconfirmed | Pay-per-use API; bookmarks endpoint returns the 800 most recent |

No integration stores OAuth tokens in LifeOS tables.
