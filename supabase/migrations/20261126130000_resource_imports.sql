-- =============================================================================
-- LifeOS M4: Resource imports (staging, preview, selection, history)
-- Creates import_runs (one per import attempt; counts and an error code only,
-- never raw provider data) and import_candidates (staged items awaiting the
-- user's selection, deleted when the run completes, is cancelled or expires),
-- and adds resource_source_records.import_run_id.
-- Changes to existing objects (created in M3 by this project):
--   resource_source_records: new nullable import_run_id column + FK + index.
-- Legacy tables are not referenced.
-- =============================================================================

do $preconditions$
begin
  if to_regclass('public.learning_resources') is null or to_regclass('public.resource_source_records') is null then
    raise exception 'M4 precondition failed: M3 resource tables are missing';
  end if;
  if to_regclass('public.import_runs') is not null or to_regclass('public.import_candidates') is not null then
    raise exception 'M4 precondition failed: import tables already exist';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'resource_source_records' and column_name = 'import_run_id') then
    raise exception 'M4 precondition failed: resource_source_records.import_run_id already exists';
  end if;
end;
$preconditions$;

create table public.import_runs (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users (id) on delete cascade,
  provider         text        not null,
  status           text        not null default 'staged',
  file_name        text,
  items_seen       integer     not null default 0,
  items_staged     integer     not null default 0,
  items_skipped    integer     not null default 0,
  items_imported   integer     not null default 0,
  items_duplicate  integer     not null default 0,
  error_code       text,
  expires_at       timestamptz not null default (now() + interval '24 hours'),
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint import_runs_id_user_key       unique (id, user_id),
  constraint import_runs_provider_check    check (provider in ('chrome_html', 'chrome_extension', 'youtube', 'x')),
  constraint import_runs_status_check      check (status in ('staged', 'completed', 'failed', 'cancelled', 'expired')),
  constraint import_runs_file_name_check   check (file_name is null or char_length(file_name) <= 255),
  constraint import_runs_counts_check      check (items_seen >= 0 and items_staged >= 0 and items_skipped >= 0 and items_imported >= 0 and items_duplicate >= 0),
  constraint import_runs_error_code_check  check (error_code is null or error_code ~ '^[a-z_]{1,64}$'),
  constraint import_runs_completion_check  check ((status = 'completed') = (completed_at is not null))
);

create index import_runs_owner_created_idx on public.import_runs (user_id, created_at desc);
create index import_runs_user_idx          on public.import_runs (user_id);

comment on table public.import_runs is
  'LifeOS import history. Stores counts and an error code only; never raw provider responses or titles.';

create trigger lifeos_updated_at before update on public.import_runs
  for each row execute function public.lifeos_set_updated_at();

create table public.import_candidates (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users (id) on delete cascade,
  import_run_id   uuid        not null,
  position        integer     not null default 0,
  url             text        not null,
  canonical_url   text        not null,
  title           text,
  folder_path     text,
  resource_type   text        not null default 'article',
  source_added_at timestamptz,
  already_in_library boolean  not null default false,
  created_at      timestamptz not null default now(),

  constraint import_candidates_run_canonical_key unique (import_run_id, canonical_url),
  constraint import_candidates_run_owner_fk      foreign key (import_run_id, user_id)
    references public.import_runs (id, user_id) on delete cascade,
  constraint import_candidates_url_check         check (url ~* '^https?://' and char_length(url) <= 2048),
  constraint import_candidates_canonical_check   check (canonical_url ~ '^https://' and char_length(canonical_url) <= 2048),
  constraint import_candidates_title_check       check (title is null or char_length(title) <= 500),
  constraint import_candidates_folder_check      check (folder_path is null or char_length(folder_path) <= 1000),
  constraint import_candidates_type_check        check (resource_type in ('article', 'documentation', 'video', 'playlist', 'book', 'paper', 'course', 'post', 'repository', 'other')),
  constraint import_candidates_position_check    check (position >= 0)
);

create index import_candidates_run_owner_idx on public.import_candidates (import_run_id, user_id, position);
create index import_candidates_user_idx      on public.import_candidates (user_id);

alter table public.resource_source_records add column import_run_id uuid;

alter table public.resource_source_records add constraint resource_source_records_run_owner_fk
  foreign key (import_run_id, user_id) references public.import_runs (id, user_id) on delete set null (import_run_id);

create index resource_source_records_run_owner_idx on public.resource_source_records (import_run_id, user_id);

alter table public.import_runs       enable row level security;
alter table public.import_candidates enable row level security;

create policy lifeos_import_runs_owner_access on public.import_runs
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy lifeos_import_candidates_owner_access on public.import_candidates
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on table public.import_runs, public.import_candidates from anon, authenticated;
grant select, insert, update, delete on table public.import_runs       to authenticated;
grant select, insert, delete         on table public.import_candidates to authenticated;
