-- =============================================================================
-- LifeOS M1: Side Quests core
-- Creates side_quests, quest_objectives, quest_milestones, quest_notes and the
-- reusable TRUNCATE guard public.lifeos_reject_truncate().
-- Never alters, drops, truncates or deletes an existing object or row.
-- Legacy tables are not referenced, except that public.knowledge_notes is the
-- target of one new foreign key; its definition, policies and data are unchanged.
-- Rollback (manual, only if never used): drop the four tables and the function.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Preconditions (read-only): fail loudly instead of partially applying.
-- -----------------------------------------------------------------------------
do $preconditions$
declare
  kn_id   smallint;
  kn_user smallint;
begin
  if to_regprocedure('public.lifeos_set_updated_at()') is null then
    raise exception 'M1 precondition failed: public.lifeos_set_updated_at() is missing (core migration not applied)';
  end if;

  if to_regclass('public.knowledge_notes') is null then
    raise exception 'M1 precondition failed: public.knowledge_notes is missing';
  end if;

  select attnum into kn_id
    from pg_attribute
   where attrelid = 'public.knowledge_notes'::regclass and attname = 'id' and not attisdropped;
  select attnum into kn_user
    from pg_attribute
   where attrelid = 'public.knowledge_notes'::regclass and attname = 'user_id' and not attisdropped;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.knowledge_notes'::regclass
       and contype = 'u'
       and conkey = array[kn_id, kn_user]
  ) then
    raise exception 'M1 precondition failed: public.knowledge_notes has no unique (id, user_id) constraint';
  end if;

  if to_regclass('public.side_quests') is not null
     or to_regclass('public.quest_objectives') is not null
     or to_regclass('public.quest_milestones') is not null
     or to_regclass('public.quest_notes') is not null then
    raise exception 'M1 precondition failed: one or more Side Quest tables already exist';
  end if;

  if to_regprocedure('public.lifeos_reject_truncate()') is not null then
    raise exception 'M1 precondition failed: public.lifeos_reject_truncate() already exists';
  end if;
end;
$preconditions$;

-- -----------------------------------------------------------------------------
-- side_quests
-- -----------------------------------------------------------------------------
create table public.side_quests (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references auth.users (id) on delete cascade,
  title                  text        not null,
  description            text,
  category               text,
  difficulty             text,
  structure              text        not null default 'exploratory',
  status                 text        not null default 'backlog',
  pillar                 text        not null default 'intellectual',
  weekly_target_minutes  integer,
  target_date            date,
  started_at             timestamptz,
  completed_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint side_quests_id_user_key            unique (id, user_id),
  constraint side_quests_title_check            check (btrim(title) <> '' and char_length(title) <= 160),
  constraint side_quests_description_check      check (description is null or char_length(description) <= 4000),
  constraint side_quests_category_check         check (category is null or (btrim(category) <> '' and char_length(category) <= 60)),
  constraint side_quests_difficulty_check       check (difficulty is null or difficulty in ('intro', 'intermediate', 'advanced', 'expert')),
  constraint side_quests_structure_check        check (structure in ('structured', 'exploratory')),
  constraint side_quests_status_check           check (status in ('backlog', 'active', 'paused', 'completed')),
  constraint side_quests_pillar_check           check (pillar in ('physical', 'intellectual', 'academic', 'professional', 'communication', 'personal')),
  constraint side_quests_weekly_target_check    check (weekly_target_minutes is null or weekly_target_minutes between 1 and 10080),
  constraint side_quests_completion_check       check ((status = 'completed') = (completed_at is not null)),
  constraint side_quests_started_check          check (status = 'backlog' or started_at is not null),
  constraint side_quests_completion_order_check check (completed_at is null or started_at is null or completed_at >= started_at)
);

create index side_quests_owner_status_idx on public.side_quests (user_id, status, updated_at desc);

comment on table public.side_quests is
  'LifeOS Side Quests: skills a user wants to develop. structure changes app defaults only.';

-- -----------------------------------------------------------------------------
-- quest_objectives
-- -----------------------------------------------------------------------------
create table public.quest_objectives (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  quest_id     uuid        not null,
  title        text        not null,
  position     integer     not null default 0,
  achieved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint quest_objectives_id_user_key    unique (id, user_id),
  constraint quest_objectives_quest_owner_fk foreign key (quest_id, user_id)
    references public.side_quests (id, user_id) on delete cascade,
  constraint quest_objectives_title_check    check (btrim(title) <> '' and char_length(title) <= 240),
  constraint quest_objectives_position_check check (position >= 0)
);

create index quest_objectives_quest_owner_idx on public.quest_objectives (quest_id, user_id, position);
create index quest_objectives_user_idx        on public.quest_objectives (user_id);

-- -----------------------------------------------------------------------------
-- quest_milestones
-- -----------------------------------------------------------------------------
create table public.quest_milestones (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  quest_id      uuid        not null,
  title         text        not null,
  description   text,
  due_on        date,
  position      integer     not null default 0,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint quest_milestones_id_user_key       unique (id, user_id),
  constraint quest_milestones_quest_owner_fk    foreign key (quest_id, user_id)
    references public.side_quests (id, user_id) on delete cascade,
  constraint quest_milestones_title_check       check (btrim(title) <> '' and char_length(title) <= 180),
  constraint quest_milestones_description_check check (description is null or char_length(description) <= 2000),
  constraint quest_milestones_position_check    check (position >= 0)
);

create index quest_milestones_quest_owner_idx on public.quest_milestones (quest_id, user_id, position);
create index quest_milestones_user_idx        on public.quest_milestones (user_id);

-- -----------------------------------------------------------------------------
-- quest_notes: link table. Deleting a quest removes only the link; the
-- knowledge_notes row is preserved. Links change by delete + insert, so there
-- is no updated_at (same convention as knowledge_note_tags).
-- -----------------------------------------------------------------------------
create table public.quest_notes (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  quest_id    uuid        not null,
  note_id     uuid        not null,
  created_at  timestamptz not null default now(),

  constraint quest_notes_pkey           primary key (quest_id, note_id),
  constraint quest_notes_quest_owner_fk foreign key (quest_id, user_id)
    references public.side_quests (id, user_id) on delete cascade,
  constraint quest_notes_note_owner_fk  foreign key (note_id, user_id)
    references public.knowledge_notes (id, user_id) on delete cascade
);

create index quest_notes_quest_owner_idx on public.quest_notes (quest_id, user_id);
create index quest_notes_note_owner_idx  on public.quest_notes (note_id, user_id);
create index quest_notes_user_idx        on public.quest_notes (user_id);

-- -----------------------------------------------------------------------------
-- updated_at maintenance (reuses the core trigger function)
-- -----------------------------------------------------------------------------
create trigger lifeos_updated_at before update on public.side_quests
  for each row execute function public.lifeos_set_updated_at();
create trigger lifeos_updated_at before update on public.quest_objectives
  for each row execute function public.lifeos_set_updated_at();
create trigger lifeos_updated_at before update on public.quest_milestones
  for each row execute function public.lifeos_set_updated_at();

-- -----------------------------------------------------------------------------
-- TRUNCATE protection. BEFORE TRUNCATE triggers fire for every table in a
-- TRUNCATE, including tables reached through CASCADE, so
-- TRUNCATE side_quests CASCADE fails and rolls back as a whole.
-- learning_sessions receives the same trigger in M2.
-- -----------------------------------------------------------------------------
create function public.lifeos_reject_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'TRUNCATE is not permitted on %.%; use DELETE so row-level protections run',
    tg_table_schema, tg_table_name;
end;
$$;

revoke all on function public.lifeos_reject_truncate() from public, anon, authenticated;

create trigger lifeos_no_truncate before truncate on public.side_quests
  for each statement execute function public.lifeos_reject_truncate();

-- -----------------------------------------------------------------------------
-- Row Level Security: owner-only, same form as the core migration.
-- -----------------------------------------------------------------------------
alter table public.side_quests      enable row level security;
alter table public.quest_objectives enable row level security;
alter table public.quest_milestones enable row level security;
alter table public.quest_notes      enable row level security;

create policy lifeos_side_quests_owner_access on public.side_quests
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy lifeos_quest_objectives_owner_access on public.quest_objectives
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy lifeos_quest_milestones_owner_access on public.quest_milestones
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy lifeos_quest_notes_owner_access on public.quest_notes
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Grants: no anonymous access; link rows are never updated in place.
-- Supabase default privileges give authenticated ALL (including TRUNCATE and
-- UPDATE) on new tables, so revoke first and grant exactly what the app needs.
-- -----------------------------------------------------------------------------
revoke all on table public.side_quests, public.quest_objectives, public.quest_milestones, public.quest_notes from anon, authenticated;

grant select, insert, update, delete on table public.side_quests      to authenticated;
grant select, insert, update, delete on table public.quest_objectives to authenticated;
grant select, insert, update, delete on table public.quest_milestones to authenticated;
grant select, insert, delete         on table public.quest_notes      to authenticated;
