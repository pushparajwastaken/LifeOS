-- =============================================================================
-- LifeOS M3: Resource Library
-- Creates learning_resources (provider-agnostic core record with immutable
-- origin and per-field provenance), resource_source_records (provider data and
-- sync state, used by imports from M4), quest_resources (many-to-many), and adds
-- learning_sessions.resource_id. Saving or attaching resources is collection,
-- never learning effort.
-- Changes to existing objects (all created in M2 by this project):
--   learning_sessions: new nullable resource_id column + FK + index;
--   lifeos_learning_session_guard(): also protects resource_id on deleted rows;
--   active_learning_sessions: resource_id appended as the last column.
-- Legacy tables are not referenced.
-- =============================================================================

do $preconditions$
begin
  if to_regclass('public.learning_sessions') is null or to_regclass('public.active_learning_sessions') is null then
    raise exception 'M3 precondition failed: M2 learning sessions are missing';
  end if;
  if to_regclass('public.learning_resources') is not null
     or to_regclass('public.resource_source_records') is not null
     or to_regclass('public.quest_resources') is not null then
    raise exception 'M3 precondition failed: resource tables already exist';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'learning_sessions' and column_name = 'resource_id') then
    raise exception 'M3 precondition failed: learning_sessions.resource_id already exists';
  end if;
end;
$preconditions$;

-- -----------------------------------------------------------------------------
-- learning_resources
-- -----------------------------------------------------------------------------
create table public.learning_resources (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users (id) on delete cascade,
  url            text        not null,
  canonical_url  text        not null,
  url_source     text        not null default 'user',
  title          text        not null,
  title_source   text        not null default 'user',
  resource_type  text        not null default 'article',
  origin         text        not null default 'manual',
  category       text,
  status         text        not null default 'saved',
  completed_at   timestamptz,
  notes          text,
  search_document tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(category, '') || ' ' || coalesce(notes, ''))
  ) stored,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint learning_resources_id_user_key        unique (id, user_id),
  constraint learning_resources_canonical_key      unique (user_id, canonical_url),
  constraint learning_resources_url_check          check (url ~* '^https?://' and char_length(url) <= 2048),
  constraint learning_resources_canonical_check    check (canonical_url ~ '^https://' and char_length(canonical_url) <= 2048),
  constraint learning_resources_title_check        check (btrim(title) <> '' and char_length(title) <= 500),
  constraint learning_resources_url_source_check   check (url_source in ('user', 'youtube', 'chrome', 'x')),
  constraint learning_resources_title_source_check check (title_source in ('user', 'youtube', 'chrome', 'x')),
  constraint learning_resources_type_check         check (resource_type in ('article', 'documentation', 'video', 'playlist', 'book', 'paper', 'course', 'post', 'repository', 'other')),
  constraint learning_resources_origin_check       check (origin in ('manual', 'chrome_html', 'chrome_extension', 'youtube', 'x')),
  constraint learning_resources_category_check     check (category is null or (btrim(category) <> '' and char_length(category) <= 60)),
  constraint learning_resources_status_check       check (status in ('saved', 'in_progress', 'completed', 'archived')),
  constraint learning_resources_completion_check   check ((status = 'completed') = (completed_at is not null)),
  constraint learning_resources_notes_check        check (notes is null or char_length(notes) <= 4000)
);

create index learning_resources_owner_status_idx on public.learning_resources (user_id, status, created_at desc);
create index learning_resources_search_idx       on public.learning_resources using gin (search_document);
create index learning_resources_user_idx         on public.learning_resources (user_id);

comment on table public.learning_resources is
  'LifeOS Resource Library: one row per canonical URL per user. origin never changes; url_source/title_source record where those values came from.';

create trigger lifeos_updated_at before update on public.learning_resources
  for each row execute function public.lifeos_set_updated_at();

create function public.lifeos_resource_origin_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.origin is distinct from old.origin then
    raise exception 'The origin of a resource cannot be changed' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.lifeos_resource_origin_guard() from public, anon, authenticated;

create trigger lifeos_origin_guard before update on public.learning_resources
  for each row execute function public.lifeos_resource_origin_guard();

-- -----------------------------------------------------------------------------
-- resource_source_records: provider data and sync state, separate from the core record
-- -----------------------------------------------------------------------------
create table public.resource_source_records (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references auth.users (id) on delete cascade,
  resource_id            uuid        not null,
  provider               text        not null,
  external_id            text        not null,
  source_url             text        not null,
  source_title           text,
  provider_metadata      jsonb       not null default '{}'::jsonb,
  metadata_refreshed_at  timestamptz,
  sync_state             text        not null default 'active',
  first_seen_at          timestamptz not null default now(),
  last_seen_at           timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint resource_source_records_id_user_key      unique (id, user_id),
  constraint resource_source_records_external_key     unique (user_id, provider, external_id),
  constraint resource_source_records_resource_owner_fk foreign key (resource_id, user_id)
    references public.learning_resources (id, user_id) on delete cascade,
  constraint resource_source_records_provider_check   check (provider in ('chrome_html', 'chrome_extension', 'youtube', 'x')),
  constraint resource_source_records_external_check   check (btrim(external_id) <> '' and char_length(external_id) <= 2048),
  constraint resource_source_records_url_check        check (source_url ~* '^https?://' and char_length(source_url) <= 2048),
  constraint resource_source_records_title_check      check (source_title is null or char_length(source_title) <= 500),
  constraint resource_source_records_metadata_check   check (jsonb_typeof(provider_metadata) = 'object'),
  constraint resource_source_records_sync_check       check (sync_state in ('active', 'removed_at_source', 'unavailable'))
);

create index resource_source_records_resource_owner_idx on public.resource_source_records (resource_id, user_id);
create index resource_source_records_user_idx           on public.resource_source_records (user_id);

create trigger lifeos_updated_at before update on public.resource_source_records
  for each row execute function public.lifeos_set_updated_at();

-- -----------------------------------------------------------------------------
-- quest_resources: many-to-many link (delete + insert; no updated_at)
-- -----------------------------------------------------------------------------
create table public.quest_resources (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  quest_id     uuid        not null,
  resource_id  uuid        not null,
  position     integer     not null default 0,
  added_at     timestamptz not null default now(),

  constraint quest_resources_pkey              primary key (quest_id, resource_id),
  constraint quest_resources_quest_owner_fk    foreign key (quest_id, user_id)
    references public.side_quests (id, user_id) on delete cascade,
  constraint quest_resources_resource_owner_fk foreign key (resource_id, user_id)
    references public.learning_resources (id, user_id) on delete cascade,
  constraint quest_resources_position_check    check (position >= 0)
);

create index quest_resources_quest_owner_idx    on public.quest_resources (quest_id, user_id);
create index quest_resources_resource_owner_idx on public.quest_resources (resource_id, user_id);
create index quest_resources_user_idx           on public.quest_resources (user_id);

-- -----------------------------------------------------------------------------
-- learning_sessions.resource_id: optional link; deleting a resource keeps the session
-- -----------------------------------------------------------------------------
alter table public.learning_sessions add column resource_id uuid;

alter table public.learning_sessions add constraint learning_sessions_resource_owner_fk
  foreign key (resource_id, user_id) references public.learning_resources (id, user_id) on delete set null (resource_id);

create index learning_sessions_resource_owner_idx on public.learning_sessions (resource_id, user_id);

-- Same rules as M2, now also covering resource_id (deleted rows may only have it cleared by the foreign key).
create or replace function public.lifeos_learning_session_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.deleted_at := null;
    return new;
  end if;

  if old.deleted_at is null then
    if new.deleted_at is not null then
      new.deleted_at := now();
    end if;
    return new;
  end if;

  if new.deleted_at is null then
    if old.deleted_at <= now() - interval '30 days' then
      raise exception 'This learning session was deleted more than 30 days ago and can no longer be restored'
        using errcode = 'P0001';
    end if;
    if (new.user_id, new.quest_id, new.resource_id, new.topic, new.pillar, new.session_type, new.started_at, new.duration_minutes, new.notes)
       is distinct from
       (old.user_id, old.quest_id, old.resource_id, old.topic, old.pillar, old.session_type, old.started_at, old.duration_minutes, old.notes) then
      raise exception 'A deleted learning session can only be restored, not edited' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'The deletion time of a learning session cannot be changed' using errcode = 'P0001';
  end if;
  if (new.user_id, new.pillar, new.session_type, new.started_at, new.duration_minutes, new.notes)
     is distinct from
     (old.user_id, old.pillar, old.session_type, old.started_at, old.duration_minutes, old.notes)
     or (new.quest_id is distinct from old.quest_id and new.quest_id is not null)
     or (new.resource_id is distinct from old.resource_id and new.resource_id is not null)
     or (new.topic is distinct from old.topic and btrim(coalesce(old.topic, '')) <> '') then
    raise exception 'A deleted learning session cannot be edited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.lifeos_learning_session_guard() from public, anon, authenticated;

create or replace view public.active_learning_sessions
  with (security_invoker = true)
  as select id, user_id, quest_id, topic, pillar, session_type, started_at, duration_minutes, notes, created_at, updated_at, resource_id
       from public.learning_sessions
      where deleted_at is null;

-- -----------------------------------------------------------------------------
-- TRUNCATE protection, RLS and grants
-- -----------------------------------------------------------------------------
create trigger lifeos_no_truncate before truncate on public.learning_resources
  for each statement execute function public.lifeos_reject_truncate();

alter table public.learning_resources      enable row level security;
alter table public.resource_source_records enable row level security;
alter table public.quest_resources         enable row level security;

create policy lifeos_learning_resources_owner_access on public.learning_resources
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy lifeos_resource_source_records_owner_access on public.resource_source_records
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy lifeos_quest_resources_owner_access on public.quest_resources
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on table public.learning_resources, public.resource_source_records, public.quest_resources from anon, authenticated;
grant select, insert, update, delete on table public.learning_resources      to authenticated;
grant select, insert, update, delete on table public.resource_source_records to authenticated;
grant select, insert, delete         on table public.quest_resources         to authenticated;
-- create or replace view keeps existing grants; restated for clarity.
revoke all on table public.active_learning_sessions from anon;
grant select on table public.active_learning_sessions to authenticated;
