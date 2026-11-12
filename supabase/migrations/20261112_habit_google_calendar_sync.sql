create table if not exists public.habit_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calendar_id text not null,
  calendar_name text not null default 'LifeOS',
  time_zone text not null,
  last_synced_at timestamptz,
  last_sync_status text not null default 'pending' check (last_sync_status in ('pending', 'synced', 'error')),
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_calendar_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  google_calendar_id text not null,
  google_event_id text not null,
  sync_status text not null default 'pending' check (sync_status in ('pending', 'synced', 'error')),
  sync_operation text not null default 'upsert' check (sync_operation in ('upsert', 'truncate_future')),
  sync_attempts integer not null default 0 check (sync_attempts >= 0),
  last_attempt_at timestamptz,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, habit_id)
);

create index if not exists habit_calendar_events_pending_idx
  on public.habit_calendar_events (user_id, sync_status, updated_at)
  where sync_status <> 'synced';

alter table public.habit_calendar_connections enable row level security;
alter table public.habit_calendar_events enable row level security;

revoke all on public.habit_calendar_connections from anon;
revoke all on public.habit_calendar_events from anon;
grant select, insert, update, delete on public.habit_calendar_connections to authenticated;
grant select, insert, update, delete on public.habit_calendar_events to authenticated;

drop policy if exists habit_calendar_connections_owner_access on public.habit_calendar_connections;
create policy habit_calendar_connections_owner_access
  on public.habit_calendar_connections
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists habit_calendar_events_owner_access on public.habit_calendar_events;
create policy habit_calendar_events_owner_access
  on public.habit_calendar_events
  for all to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.habits h
      where h.id = habit_calendar_events.habit_id
        and h.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.habits h
      where h.id = habit_calendar_events.habit_id
        and h.user_id = auth.uid()
    )
  );
