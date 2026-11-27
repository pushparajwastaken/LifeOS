# Integrations

| Integration | Status | Credential handling | Notes |
|---|---|---|---|
| Google Calendar | Connect, test and disconnect implemented; event sync not implemented | Vercel Connect connector `google/lifeos-calendar` holds tokens; LifeOS stores only connection status (`habit_calendar_connections`) | `habit_calendar_events` exists but is unused |
| Chrome bookmarks (HTML file) | Complete (M4) | No credentials | Server-side parsing of an uploaded export (any Netscape-format browser export works); preview and explicit selection before import; links are never fetched |
| YouTube | Blocked (M6) | Planned: separate Vercel Connect connector, `youtube.readonly` | Requires custom verified domain, Google sensitive-scope verification, `/privacy` and `/terms` pages, verifying that Vercel Connect revocation revokes at Google, and `pg_cron` for the 30-day purge. API data (ids, titles, thumbnails) must be refreshed or deleted within 30 days; no derived metrics from API data. |
| Chrome extension | Complete (M7), not published to the Chrome Web Store | None: page-to-extension messaging through a content script limited to allowlisted LifeOS origins; every send approved in an extension window | Optional, read-only `bookmarks` permission (can be given back after each send); no host permissions, no network requests. Bookmarks go through the same review step as the HTML import (`provider = chrome_extension`). See `extension/README.md`. |
| X (Twitter) bookmarks | Reviewed (M8): **not building an API sync now**; X post links can be saved by hand | Would need Vercel Connect (X connector listed; scopes, own-client and revocation unconfirmed) | Pay-per-use: $0.001/post only for the app owner, $0.005/post for anyone else; stored X content must be kept current and deleted within 24 h on request; use case needs X approval. See `X_FEASIBILITY.md`. |

No integration stores OAuth tokens in LifeOS tables.
