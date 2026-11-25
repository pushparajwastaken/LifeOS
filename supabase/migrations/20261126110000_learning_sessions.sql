-- =============================================================================
-- LifeOS M2: Learning sessions
-- Creates learning_sessions (actual learning effort, with or without a quest),
-- the active_learning_sessions view, soft-delete integrity rules, and the
-- quest-delete trigger that keeps session history readable.
-- resource_id is added in M3 together with learning_resources.
-- Never alters, drops, truncates or deletes an existing object or row,
-- except adding one BEFORE DELETE trigger to side_quests.
-- Rollback (manual, only if never used): drop the view, triggers, functions and table.
-- =============================================================================

do $preconditions$
begin
  if to_regclass('public.side_quests') is null then
    raise exception 'M2 precondition failed: public.side_quests is missing (M1 not applied)';
  end if;
  if to_regprocedure('public.lifeos_reject_truncate()') is null then
    raise exception 'M2 precondition failed: public.lifeos_reject_truncate() is missing (M1 not applied)';
  end if;
  if to_regclass('public.learning_sessions') is not null or to_regclass('public.active_learning_sessions') is not null then
    raise exception 'M2 precondition failed: learning session objects already exist';
  end if;
  if to_regprocedure('public.lifeos_learning_session_guard()') is not null
     or to_regprocedure('public.lifeos_preserve_session_topics()') is not null then
    raise exception 'M2 precondition failed: learning session functions already exist';
  end if;
end;
$preconditions$;

-- -----------------------------------------------------------------------------
-- learning_sessions
-- -----------------------------------------------------------------------------
create table public.learning_sessions (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  quest_id          uuid,
  topic             text,
  pillar            text,
  session_type      text        not null default 'study',
  started_at        timestamptz not null,
  duration_minutes  integer     not null,
  notes             text,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint learning_sessions_id_user_key       unique (id, user_id),
  constraint learning_sessions_quest_owner_fk    foreign key (quest_id, user_id)
    references public.side_quests (id, user_id) on delete set null (quest_id),
  constraint learning_sessions_topic_check       check (topic is null or char_length(topic) <= 160),
  constraint learning_sessions_quest_or_topic_check check (quest_id is not null or btrim(coalesce(topic, '')) <> ''),
  constraint learning_sessions_pillar_check      check (pillar is null or pillar in ('physical', 'intellectual', 'academic', 'professional', 'communication', 'personal')),
  constraint learning_sessions_type_check        check (session_type in ('study', 'practice', 'build', 'watch', 'read', 'other')),
  constraint learning_sessions_duration_check    check (duration_minutes between 1 and 1440),
  constraint learning_sessions_notes_check       check (notes is null or char_length(notes) <= 4000)
);

create index learning_sessions_active_owner_time_idx on public.learning_sessions (user_id, started_at desc) where deleted_at is null;
create index learning_sessions_deleted_owner_idx     on public.learning_sessions (user_id, deleted_at) where deleted_at is not null;
create index learning_sessions_quest_owner_idx       on public.learning_sessions (quest_id, user_id);
create index learning_sessions_user_idx              on public.learning_sessions (user_id);

comment on table public.learning_sessions is
  'LifeOS learning effort. Only rows here count as learning. Soft-deleted rows (deleted_at) are restorable for exactly 30 days.';

create trigger lifeos_updated_at before update on public.learning_sessions
  for each row execute function public.lifeos_set_updated_at();

create trigger lifeos_no_truncate before truncate on public.learning_sessions
  for each statement execute function public.lifeos_reject_truncate();

-- -----------------------------------------------------------------------------
-- Soft-delete integrity.
--   Insert: deleted_at always starts null.
--   Active -> deleted: deleted_at is forced to now() (client values ignored).
--   Deleted -> active (restore): allowed only within 30 days of deletion, using
--     the database clock, and only if nothing else changes.
--   While deleted: no edits, except the system changes needed by foreign keys
--     and quest deletion (quest_id set to null, an empty topic filled in).
-- -----------------------------------------------------------------------------
create function public.lifeos_learning_session_guard()
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

  -- old row is soft-deleted
  if new.deleted_at is null then
    if old.deleted_at <= now() - interval '30 days' then
      raise exception 'This learning session was deleted more than 30 days ago and can no longer be restored'
        using errcode = 'P0001';
    end if;
    if (new.user_id, new.quest_id, new.topic, new.pillar, new.session_type, new.started_at, new.duration_minutes, new.notes)
       is distinct from
       (old.user_id, old.quest_id, old.topic, old.pillar, old.session_type, old.started_at, old.duration_minutes, old.notes) then
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
     or (new.topic is distinct from old.topic and btrim(coalesce(old.topic, '')) <> '') then
    raise exception 'A deleted learning session cannot be edited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.lifeos_learning_session_guard() from public, anon, authenticated;

create trigger lifeos_session_guard before insert or update on public.learning_sessions
  for each row execute function public.lifeos_learning_session_guard();

-- -----------------------------------------------------------------------------
-- Quest deletion keeps learning history: before a quest is deleted, its title is
-- copied into the topic of its sessions that have none, so the foreign key's
-- SET NULL leaves every session valid. Runs with the caller's privileges (RLS applies).
-- -----------------------------------------------------------------------------
create function public.lifeos_preserve_session_topics()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.learning_sessions
     set topic = left(old.title, 160)
   where quest_id = old.id
     and user_id = old.user_id
     and btrim(coalesce(topic, '')) = '';
  return old;
end;
$$;

revoke all on function public.lifeos_preserve_session_topics() from public, anon, authenticated;

create trigger lifeos_preserve_session_topics before delete on public.side_quests
  for each row execute function public.lifeos_preserve_session_topics();

-- -----------------------------------------------------------------------------
-- Active sessions view: every normal read and all analytics use this view.
-- security_invoker keeps RLS of the underlying table in force.
-- -----------------------------------------------------------------------------
create view public.active_learning_sessions
  with (security_invoker = true)
  as select id, user_id, quest_id, topic, pillar, session_type, started_at, duration_minutes, notes, created_at, updated_at
       from public.learning_sessions
      where deleted_at is null;

-- -----------------------------------------------------------------------------
-- RLS and grants
-- -----------------------------------------------------------------------------
alter table public.learning_sessions enable row level security;

create policy lifeos_learning_sessions_owner_access on public.learning_sessions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on table public.learning_sessions, public.active_learning_sessions from anon, authenticated;
grant select, insert, update, delete on table public.learning_sessions to authenticated;
grant select on table public.active_learning_sessions to authenticated;
