# X (Twitter) bookmarks: feasibility review (M8)

Review only. No code, tables or credentials were added. Researched 2026-11-27 from X's official docs
(pricing, bookmarks endpoints, OAuth 2.0, Developer Policy and Agreement) and Vercel's Connect pages.
X changes its terms and prices often; re-check every figure below before building anything.

## Recommendation
**Do not build an X API sync now.** Keep X support at what already works: saving a post link by hand
(`canonicalizeUrl` already turns any X/Twitter post URL into `https://x.com/i/status/ID`, so repeats are caught).
Revisit only if LifeOS stays a single-owner app and the owner accepts the compliance work listed under Option B.

| Option | What it means | Verdict |
|---|---|---|
| A. Links only (today) | Paste X post links into the library; no API, no tokens, no X content stored beyond the URL and a title the user types | **Recommended** |
| B. Owner-only sync | The LifeOS owner registers their own X developer app; only the owner's bookmarks are synced | Possible later; real cost and compliance work |
| C. Multi-user sync | Any LifeOS user connects X | **Not feasible now**: cost, approval and compliance (below) |

## Findings

### API access
- Endpoint `GET /2/users/{id}/bookmarks`; needs a **user** access token (OAuth 2.0 PKCE) with `bookmark.read`, `tweet.read`, `users.read`. Pages of up to 100, with `pagination_token`.
- Bookmark folders have their own endpoints (`/bookmarks/folders`, `/bookmarks/folders/{folder_id}`), so folders could map onto the library like Chrome folders.
- Access tokens last about two hours; a refresh token is issued only with the `offline.access` scope, which X describes to the user as staying connected "until you revoke access".
- The "only the 800 most recent bookmarks" limit noted earlier in `INTEGRATIONS.md` was **not confirmed** in the pages read; treat it as unverified until tested.

### Cost (pay-per-use; no free tier, credits bought up front)
- **Owned reads: $0.001 per post**, but only when the token belongs to **the owner of the developer app**. Bookmarks are explicitly in this list.
- Anyone else's bookmarks are standard post reads: **$0.005 per post**, and user objects (if authors are expanded) **$0.010 each**.
- Repeat reads of the same post within one UTC day are not charged again ("soft guarantee"). Pay-per-use is capped at 3 million post reads a month.
- Rough cost of one full sync of 800 bookmarks: owner **≈ $0.80**; any other user **≈ $4**, or more with author details, paid from the LifeOS operator's credits.
- Keeping stored content current (see compliance) means re-reading posts, which costs the same again on each refresh.

### Policy and compliance (X Developer Policy and Agreement, updated April 2026)
- **Approval:** X reviews every proposed use; you must describe the use case and get approval again before using X content for a new purpose. Pay-per-use is described as meant for hobbyists. Up to 3 apps (dev, staging, production).
- **Stored content must stay current:** anything stored "offline" must match its current state on X, and must be deleted or changed within 24 hours of a request (including posts deleted or made private). Displayed content should be fetched fresh from the API.
- **Post IDs count as X content**, so even storing only IDs carries these duties.
- **Consent:** signing in alone is not consent; express, informed consent is required for non-public content. Whether bookmarks count as non-public is not stated; LifeOS should assume they do (they are private to the user).
- **Not allowed:** training foundation models on X content, ad targeting off X, redistributing anything beyond IDs.
- **Credentials:** keys and tokens must be kept private, which matches the LifeOS rule of no tokens in our tables.

### Token handling (Vercel Connect)
- Vercel Connect lists an X connector ("read and create posts, manage DMs, access user data") with user-authorised access and managed token refresh.
- **Unconfirmed:** whether it is Vercel-managed or needs our own X client id and secret; which scopes it can request (`bookmark.read`, `offline.access`); and whether deleting the connection revokes the token at X (Connect says it revokes "at the provider when supported").
- Without Connect, LifeOS would have to store X refresh tokens itself, which breaks the "no OAuth tokens in LifeOS tables" rule. So Option B depends on Connect confirming the points above.

## What Option B would need (if chosen later)
1. Owner registers an X developer app, describes the LifeOS use case and gets it approved; buys credits and sets a spending limit.
2. Confirm in a Vercel Connect test project: X connector with own client id, `bookmark.read tweet.read users.read offline.access`, and revocation at X on disconnect.
3. Store as little as possible: post ID, canonical URL, author handle, and a title; keep `provider = 'x'` data in `resource_source_records` (the schema already allows it).
4. Refresh or delete synced X data on a schedule (`pg_cron`, also needed for YouTube in M6): re-read stored posts, remove anything deleted or made private within 24 hours, and delete all X data when the user disconnects.
5. Explicit consent screen before the first sync, a "disconnect and delete X data" control, and a spending guard (stop syncing at a monthly cap).
6. Tests: two-user RLS on staging, a fake X API for the sync, and deletion-on-disconnect checks.

## Sources
- X API pricing: https://docs.x.com/x-api/getting-started/pricing
- Bookmarks: https://docs.x.com/x-api/posts/bookmarks/introduction and https://docs.x.com/x-api/users/get-bookmarks
- OAuth 2.0 PKCE: https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
- Developer Policy: https://docs.x.com/developer-terms/policy ; Developer Agreement: https://docs.x.com/developer-terms/agreement
- Vercel Connect: https://vercel.com/connect/x and https://vercel.com/docs/connect
