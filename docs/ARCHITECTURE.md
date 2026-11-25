# Architecture

## Stack
Next.js (App Router, Turbopack) · TypeScript (strict) · Supabase Postgres + Auth · Vercel · Vercel Connect (OAuth tokens for Google) · shadcn-style components in `components/ui` · Recharts via `components/ui/chart.tsx`.

## Code layout
```
app/                    routes (server components); route handlers only for auth and OAuth callbacks
components/layout/      AppShell (sidebar, breadcrumbs, mobile bar)
components/ui/          shared UI primitives
features/<module>/      one folder per module:
  <module>-domain.ts      pure rules + zod validation (no app imports, so node:test can load it)
  <module>-service.ts     reads through the signed-in user's Supabase client (RLS applies)
  <module>-actions.ts     'use server' writes: FormData → zod → ownership check → write → redirect ?notice=
  components/             UI for the module
lib/page-session.ts     signed-in page context (user, display name, profile timezone)
lib/supabase/           browser, server and proxy Supabase clients
supabase/migrations/    the schema's source of truth
tests/                  node:test unit and static tests; tests/integration/ for staging-only tests
```

## Conventions
- **Reads** happen in server components via service functions. **Writes** happen in server actions. There is no REST API.
- **Validation**: every action parses input with zod and re-checks ownership on the server (`getOwned…`) before writing; every query also filters by `user_id`.
- **Feedback**: actions redirect with a `?notice=` code; each page maps codes to messages (`features/quests/quest-notices.ts`).
- **Domain modules stay import-free** (except `zod`) so tests run with plain `node --test`. Constants that mirror database check constraints have contract tests that read the migration file.
- **No service-role key** in the application. All database access runs as the signed-in user under RLS.

## Environments and migrations
- **Staging** `vexgemyvefxhizavhpqc` is rebuilt from `supabase/migrations/` with the pinned CLI: `npx supabase@3.1.0 db push --remote=vexgemyvefxhizavhpqc`.
- **Production** `qebolligppjfthobviqr` recorded its original migrations under different version numbers (`20261111175517`, `20261112093505`, plus seven read-only verification records). **Do not run `db push` against production** until its history is realigned in a separately approved step; it would try to re-apply the core migrations.
- CLI 3.1.0 orders migrations by comparing versions as text. Keep the CLI pinned and re-verify ordering before upgrading.
- Never edit an applied migration; add a new one.

## Module boundaries (M1)
- Side Quests own `side_quests`, `quest_objectives`, `quest_milestones`, `quest_notes`.
- Notes are owned by the knowledge vault (`knowledge_notes`); quests only link to them. Deleting a quest removes links, never notes.
- The notes UI reuses the quest styles (`features/quests/quests.module.css`) and submit button.
