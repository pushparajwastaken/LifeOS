-- LifeOS Core Schema Migration
-- PostgreSQL 17.11 | Supabase
-- Comprehensive user-owned multi-pillar operating system
-- This migration creates only LifeOS-owned objects. It never drops or replaces
-- existing tables, functions, triggers, indexes, or policies. PostgreSQL 15+
-- supports column-targeted ON DELETE SET NULL; the connected server is 17.11.

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Updated-at trigger function: automatically updates updated_at timestamp
create function public.lifeos_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- PROFILES
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Your space',
  timezone text not null default 'UTC',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.lifeos_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Your space'))
  on conflict (id) do nothing;
  return new;
end;
$$;

do $auth_profile_trigger$
declare
  existing_function oid;
  existing_type smallint;
  existing_enabled "char";
  existing_has_condition boolean;
  existing_arg_count integer;
begin
  select tgfoid, tgtype, tgenabled, tgqual is not null, octet_length(tgargs)
  into existing_function, existing_type, existing_enabled, existing_has_condition, existing_arg_count
  from pg_trigger
  where tgrelid = 'auth.users'::regclass
    and tgname = 'lifeos_on_auth_user_created'
    and not tgisinternal;

  if found then
    if existing_function <> 'public.lifeos_handle_new_user()'::regprocedure
      or existing_type <> 5
      or existing_enabled <> 'O'
      or existing_has_condition
      or existing_arg_count <> 0 then
      raise exception 'Refusing to replace conflicting trigger auth.users.lifeos_on_auth_user_created';
    end if;
  else
    execute 'create trigger lifeos_on_auth_user_created after insert on auth.users for each row execute function public.lifeos_handle_new_user()';
  end if;
end;
$auth_profile_trigger$;

-- ============================================================================
-- HABITS
-- ============================================================================

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  pillar text not null check (pillar in ('physical','intellectual','academic','professional','communication','personal')),
  cadence_type text not null default 'daily' check (cadence_type in ('daily','weekly','custom')),
  schedule jsonb not null default '{}'::jsonb check (jsonb_typeof(schedule) = 'object'),
  tracking_type text not null default 'boolean' check (tracking_type in ('boolean','numeric','duration')),
  target_value numeric check (target_value is null or target_value > 0),
  unit text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index habits_owner_active_idx on public.habits(user_id, active, created_at desc);

-- ============================================================================
-- HABIT LOGS
-- ============================================================================

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null,
  log_date date not null,
  status text not null check (status in ('completed','partial','skipped','rest')),
  value numeric check (value is null or value >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  skipped_reason text,
  note text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (habit_id, log_date),
  constraint habit_logs_habit_owner_fk foreign key (habit_id, user_id)
    references public.habits(id, user_id) on delete cascade,
  constraint habit_logs_skip_reason_check check (status <> 'skipped' or nullif(trim(skipped_reason), '') is not null)
);

create index habit_logs_owner_date_idx on public.habit_logs(user_id, log_date desc);
create index habit_logs_habit_idx on public.habit_logs(habit_id);

-- ============================================================================
-- TASKS
-- ============================================================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','done','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  category text,
  pillar text check (pillar is null or pillar in ('physical','intellectual','academic','professional','communication','personal')),
  due_at timestamptz,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  recurrence jsonb check (recurrence is null or jsonb_typeof(recurrence) = 'object'),
  habit_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint tasks_habit_owner_fk foreign key (habit_id, user_id)
    references public.habits(id, user_id) on delete set null (habit_id)
);

create index tasks_owner_due_idx on public.tasks(user_id, due_at);
create index tasks_habit_idx on public.tasks(habit_id);

-- ============================================================================
-- DAILY & WEEKLY REVIEWS
-- ============================================================================

create table public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_date date not null,
  accomplished text,
  learned text,
  improve text,
  gratitude text,
  tomorrow text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, review_date)
);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  wins text,
  failures text,
  blockers text,
  next_priorities text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, week_start)
);

-- ============================================================================
-- GOALS & GOAL TRACKING
-- ============================================================================

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  description text,
  pillar text not null check (pillar in ('physical','intellectual','academic','professional','communication','personal')),
  period text not null default '90_day' check (period in ('30_day','90_day','annual','custom')),
  starts_on date not null,
  ends_on date not null,
  target_value numeric check (target_value is null or target_value > 0),
  unit text,
  status text not null default 'active' check (status in ('active','completed','paused','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (ends_on >= starts_on)
);

create index goals_owner_status_idx on public.goals(user_id, status, ends_on);

create table public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  title text not null check (char_length(title) between 1 and 180),
  target_value numeric check (target_value is null or target_value > 0),
  due_on date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint goal_milestones_goal_owner_fk foreign key (goal_id, user_id)
    references public.goals(id, user_id) on delete cascade
);

create index goal_milestones_goal_idx on public.goal_milestones(goal_id);

create table public.goal_progress_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  recorded_at timestamptz not null default now(),
  value numeric not null check (value >= 0),
  note text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint goal_progress_goal_owner_fk foreign key (goal_id, user_id)
    references public.goals(id, user_id) on delete cascade
);

create index goal_progress_owner_time_idx on public.goal_progress_entries(user_id, goal_id, recorded_at desc);

-- ============================================================================
-- PHYSICAL: WORKOUTS
-- ============================================================================

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  performed_at timestamptz not null default now(),
  rest_day boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (not rest_day or notes is not null or title <> '')
);

create index workouts_owner_time_idx on public.workouts(user_id, performed_at desc);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  order_index integer not null default 0 check (order_index >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint exercises_workout_owner_fk foreign key (workout_id, user_id)
    references public.workouts(id, user_id) on delete cascade
);

create index exercises_workout_idx on public.exercises(workout_id);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null,
  set_number integer not null check (set_number > 0),
  reps integer check (reps is null or reps >= 0),
  weight numeric check (weight is null or weight >= 0),
  unit text not null default 'kg' check (unit in ('kg','lb')),
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint exercise_sets_exercise_owner_fk foreign key (exercise_id, user_id)
    references public.exercises(id, user_id) on delete cascade
);

create index exercise_sets_exercise_idx on public.exercise_sets(exercise_id);

create table public.running_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  distance numeric not null check (distance > 0),
  distance_unit text not null default 'km' check (distance_unit in ('km','mi')),
  duration_seconds integer not null check (duration_seconds > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index running_owner_time_idx on public.running_sessions(user_id, started_at desc);

create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight numeric check (weight is null or weight >= 0),
  weight_unit text not null default 'kg' check (weight_unit in ('kg','lb')),
  measurements jsonb not null default '{}'::jsonb check (jsonb_typeof(measurements) = 'object'),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sleep_date date not null,
  duration_minutes integer not null check (duration_minutes between 0 and 1440),
  recovery_score integer check (recovery_score is null or recovery_score between 0 and 100),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, sleep_date)
);

create index sleep_owner_date_idx on public.sleep_logs(user_id, sleep_date desc);

-- ============================================================================
-- INTELLECTUAL: READING & KNOWLEDGE
-- ============================================================================

create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  author text,
  total_pages integer check (total_pages is null or total_pages > 0),
  status text not null default 'to_read' check (status in ('to_read','reading','completed','paused','abandoned')),
  started_on date,
  finished_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (started_on is null or finished_on is null or finished_on >= started_on)
);

create table public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null,
  session_date date not null,
  pages_read integer not null default 0 check (pages_read >= 0),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint reading_sessions_book_owner_fk foreign key (book_id, user_id)
    references public.books(id, user_id) on delete cascade
);

create index reading_owner_date_idx on public.reading_sessions(user_id, session_date desc);
create index reading_book_idx on public.reading_sessions(book_id);

create table public.knowledge_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  note_type text not null default 'idea' check (note_type in ('book','research','technical_explanation','idea','question','essay')),
  body text not null default '',
  source_url text,
  search_document tsvector generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index knowledge_notes_search_idx on public.knowledge_notes using gin(search_document);
create index knowledge_notes_owner_updated_idx on public.knowledge_notes(user_id, updated_at desc);

create table public.knowledge_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

create table public.knowledge_note_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (note_id, tag_id),
  constraint note_tags_note_owner_fk foreign key (note_id, user_id)
    references public.knowledge_notes(id, user_id) on delete cascade,
  constraint note_tags_tag_owner_fk foreign key (tag_id, user_id)
    references public.knowledge_tags(id, user_id) on delete cascade
);

create index knowledge_note_tags_tag_idx on public.knowledge_note_tags(tag_id);

create table public.knowledge_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_note_id uuid not null,
  target_note_id uuid not null,
  relation_type text not null default 'related' check (relation_type in ('related','supports','contrasts','extends','inspired_by')),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (source_note_id, target_note_id, relation_type),
  check (source_note_id <> target_note_id),
  constraint knowledge_links_source_owner_fk foreign key (source_note_id, user_id)
    references public.knowledge_notes(id, user_id) on delete cascade,
  constraint knowledge_links_target_owner_fk foreign key (target_note_id, user_id)
    references public.knowledge_notes(id, user_id) on delete cascade
);

create index knowledge_links_source_idx on public.knowledge_links(source_note_id);
create index knowledge_links_target_idx on public.knowledge_links(target_note_id);

create table public.knowledge_book_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null,
  book_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (note_id, book_id),
  constraint knowledge_book_note_owner_fk foreign key (note_id, user_id)
    references public.knowledge_notes(id, user_id) on delete cascade,
  constraint knowledge_book_book_owner_fk foreign key (book_id, user_id)
    references public.books(id, user_id) on delete cascade
);

create index knowledge_book_links_book_idx on public.knowledge_book_links(book_id);

-- ============================================================================
-- ACADEMIC: SUBJECTS & STUDY
-- ============================================================================

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  color text not null default 'sage',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

create table public.subject_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null,
  name text not null check (char_length(name) between 1 and 180),
  status text not null default 'planned' check (status in ('planned','learning','review','mastered')),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (id, subject_id, user_id),
  unique (subject_id, name),
  constraint subject_topics_subject_owner_fk foreign key (subject_id, user_id)
    references public.subjects(id, user_id) on delete cascade
);

create index subject_topics_subject_idx on public.subject_topics(subject_id);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null,
  topic_id uuid,
  started_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint study_sessions_subject_owner_fk foreign key (subject_id, user_id)
    references public.subjects(id, user_id) on delete cascade,
  constraint study_sessions_topic_owner_fk foreign key (topic_id, subject_id, user_id)
    references public.subject_topics(id, subject_id, user_id) on delete set null (topic_id)
);


create index study_owner_time_idx on public.study_sessions(user_id, started_at desc);
create index study_topic_idx on public.study_sessions(topic_id);

create table public.revision_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null,
  topic_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  next_review_at timestamptz,
  interval_days integer not null default 1 check (interval_days > 0),
  ease_factor numeric not null default 2.5 check (ease_factor >= 1.3),
  status text not null default 'active' check (status in ('active','suspended','mastered')),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint revision_items_subject_owner_fk foreign key (subject_id, user_id)
    references public.subjects(id, user_id) on delete cascade,
  constraint revision_items_topic_owner_fk foreign key (topic_id, subject_id, user_id)
    references public.subject_topics(id, subject_id, user_id) on delete set null (topic_id)
);

create index revision_subject_idx on public.revision_items(subject_id);
create index revision_topic_idx on public.revision_items(topic_id);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null,
  title text not null check (char_length(title) between 1 and 180),
  assessed_on date not null,
  score numeric not null check (score >= 0),
  max_score numeric not null check (max_score > 0),
  question_count integer check (question_count is null or question_count > 0),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (score <= max_score),
  constraint assessments_subject_owner_fk foreign key (subject_id, user_id)
    references public.subjects(id, user_id) on delete cascade
);

create index assessments_owner_date_idx on public.assessments(user_id, assessed_on desc);
create index assessments_subject_idx on public.assessments(subject_id);

create table public.error_log_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null,
  topic_id uuid,
  assessment_id uuid,
  prompt text not null,
  correction text,
  status text not null default 'open' check (status in ('open','reviewing','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint error_items_subject_owner_fk foreign key (subject_id, user_id)
    references public.subjects(id, user_id) on delete cascade,
  constraint error_items_topic_owner_fk foreign key (topic_id, subject_id, user_id)
    references public.subject_topics(id, subject_id, user_id) on delete set null (topic_id),
  constraint error_items_assessment_owner_fk foreign key (assessment_id, user_id)
    references public.assessments(id, user_id) on delete set null (assessment_id)
);

create index error_items_subject_idx on public.error_log_items(subject_id);
create index error_items_topic_idx on public.error_log_items(topic_id);

-- ============================================================================
-- PROFESSIONAL: PROJECTS & CODING
-- ============================================================================

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 180),
  description text,
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  repository_url text,
  started_on date,
  due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (started_on is null or due_on is null or due_on >= started_on)
);

create index projects_owner_status_idx on public.projects(user_id, status, updated_at desc);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  title text not null check (char_length(title) between 1 and 180),
  status text not null default 'todo' check (status in ('todo','in_progress','done')),
  due_on date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (id, project_id, user_id),
  constraint project_milestones_project_owner_fk foreign key (project_id, user_id)
    references public.projects(id, user_id) on delete cascade
);

create index project_milestones_project_idx on public.project_milestones(project_id);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  milestone_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'todo' check (status in ('todo','in_progress','done','blocked')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  due_on date,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint project_tasks_project_owner_fk foreign key (project_id, user_id)
    references public.projects(id, user_id) on delete cascade,
  constraint project_tasks_milestone_owner_fk foreign key (milestone_id, project_id, user_id)
    references public.project_milestones(id, project_id, user_id) on delete set null (milestone_id)
);


create index project_tasks_project_idx on public.project_tasks(project_id);
create index project_tasks_milestone_idx on public.project_tasks(milestone_id);

create table public.coding_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  project_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint coding_sessions_project_owner_fk foreign key (project_id, user_id)
    references public.projects(id, user_id) on delete set null (project_id)
);

create index coding_sessions_project_idx on public.coding_sessions(project_id);

create table public.shipping_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  title text not null check (char_length(title) between 1 and 180),
  description text,
  project_id uuid,
  shipped_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint shipping_logs_project_owner_fk foreign key (project_id, user_id)
    references public.projects(id, user_id) on delete set null (project_id)
);

create index shipping_owner_week_idx on public.shipping_logs(user_id, week_start desc);
create index shipping_project_idx on public.shipping_logs(project_id);

-- ============================================================================
-- INTELLECTUAL: RABBIT HOLES & DSA
-- ============================================================================

create table public.rabbit_holes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  month_index date not null,
  status text not null default 'exploring' check (status in ('planned','exploring','completed','paused')),
  completion_criteria text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.rabbit_hole_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rabbit_hole_id uuid not null,
  title text not null check (char_length(title) between 1 and 180),
  url text,
  resource_type text not null default 'article' check (resource_type in ('article','book','video','paper','repository','other')),
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint rabbit_resources_parent_owner_fk foreign key (rabbit_hole_id, user_id)
    references public.rabbit_holes(id, user_id) on delete cascade
);

create index rabbit_resources_parent_idx on public.rabbit_hole_resources(rabbit_hole_id);

create table public.rabbit_hole_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rabbit_hole_id uuid not null,
  title text not null check (char_length(title) between 1 and 180),
  notes text,
  output_url text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint rabbit_experiments_parent_owner_fk foreign key (rabbit_hole_id, user_id)
    references public.rabbit_holes(id, user_id) on delete cascade
);

create index rabbit_experiments_parent_idx on public.rabbit_hole_experiments(rabbit_hole_id);

create table public.dsa_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practiced_at timestamptz not null default now(),
  problem text not null check (char_length(problem) between 1 and 200),
  platform text,
  difficulty text check (difficulty is null or difficulty in ('easy','medium','hard')),
  outcome text not null default 'attempted' check (outcome in ('attempted','solved','reviewed')),
  notes text,
  url text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index dsa_owner_time_idx on public.dsa_logs(user_id, practiced_at desc);

-- ============================================================================
-- COMMUNICATION: SPEAKING & VIDEO
-- ============================================================================

create table public.speaking_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practiced_at timestamptz not null default now(),
  duration_minutes integer not null check (duration_minutes > 0),
  practice_type text not null check (practice_type in ('presentation','storytelling','impromptu','conversation','other')),
  recording_url text,
  self_evaluation integer check (self_evaluation is null or self_evaluation between 1 and 5),
  feedback text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index speaking_owner_time_idx on public.speaking_sessions(user_id, practiced_at desc);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  topic text,
  video_url text,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  published_at timestamptz,
  status text not null default 'idea' check (status in ('idea','scripting','recording','editing','published')),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

-- ============================================================================
-- CONSISTENT UPDATE TIMESTAMPS
-- ============================================================================

do $updated_at_columns$
declare
  table_name text;
begin
  foreach table_name in array array[
    'habits','habit_logs','tasks','daily_reviews','weekly_reviews','goals','goal_milestones','goal_progress_entries',
    'workouts','exercises','exercise_sets','running_sessions','body_metrics','sleep_logs','books','reading_sessions',
    'knowledge_notes','knowledge_tags','subjects','subject_topics','study_sessions','revision_items','assessments',
    'error_log_items','projects','project_milestones','project_tasks','coding_sessions','shipping_logs','rabbit_holes',
    'rabbit_hole_resources','rabbit_hole_experiments','dsa_logs','speaking_sessions','videos'
  ] loop
    execute format(
      'alter table public.%I add column if not exists updated_at timestamptz not null default now()',
      table_name
    );
  end loop;
end;
$updated_at_columns$;

do $updated_at_triggers$
declare
  table_name text;
  existing_function oid;
  existing_type smallint;
  existing_enabled "char";
  existing_has_condition boolean;
  existing_arg_count integer;
  target_relation regclass;
begin
  foreach table_name in array array[
    'profiles','habits','habit_logs','tasks','daily_reviews','weekly_reviews','goals','goal_milestones','goal_progress_entries',
    'workouts','exercises','exercise_sets','running_sessions','body_metrics','sleep_logs','books','reading_sessions',
    'knowledge_notes','knowledge_tags','subjects','subject_topics','study_sessions','revision_items','assessments',
    'error_log_items','projects','project_milestones','project_tasks','coding_sessions','shipping_logs','rabbit_holes',
    'rabbit_hole_resources','rabbit_hole_experiments','dsa_logs','speaking_sessions','videos'
  ] loop
    target_relation := format('public.%I', table_name)::regclass;
    select tgfoid, tgtype, tgenabled, tgqual is not null, octet_length(tgargs)
      into existing_function, existing_type, existing_enabled, existing_has_condition, existing_arg_count
      from pg_trigger
     where tgrelid = target_relation
       and tgname = 'lifeos_updated_at'
       and not tgisinternal;

    if found then
      if existing_function <> 'public.lifeos_set_updated_at()'::regprocedure
        or existing_type <> 19
        or existing_enabled <> 'O'
        or existing_has_condition
        or existing_arg_count <> 0 then
        raise exception 'Refusing to replace conflicting trigger %.lifeos_updated_at', target_relation;
      end if;
    else
      execute format(
        'create trigger lifeos_updated_at before update on public.%I for each row execute function public.lifeos_set_updated_at()',
        table_name
      );
    end if;
  end loop;
end;
$updated_at_triggers$;

-- ============================================================================
-- INDEXES FOR USER AND PARENT FOREIGN KEYS
-- ============================================================================

-- Add an owner-leading index only when no existing index already provides one.
-- The three many-to-many relationship tables intentionally remain without updated_at;
-- changing a relationship is represented by deleting and inserting its link row.
do $owner_indexes$
declare
  table_name text;
  target_relation regclass;
  owner_attnum smallint;
begin
  foreach table_name in array array[
    'habits','habit_logs','tasks','daily_reviews','weekly_reviews','goals','goal_milestones','goal_progress_entries',
    'workouts','exercises','exercise_sets','running_sessions','body_metrics','sleep_logs','books','reading_sessions',
    'knowledge_notes','knowledge_tags','knowledge_note_tags','knowledge_links','knowledge_book_links','subjects',
    'subject_topics','study_sessions','revision_items','assessments','error_log_items','projects','project_milestones',
    'project_tasks','coding_sessions','shipping_logs','rabbit_holes','rabbit_hole_resources','rabbit_hole_experiments',
    'dsa_logs','speaking_sessions','videos'
  ] loop
    target_relation := format('public.%I', table_name)::regclass;
    select attnum into owner_attnum
      from pg_attribute
     where attrelid = target_relation and attname = 'user_id' and not attisdropped;

    if not exists (
      select 1 from pg_index i
       where i.indrelid = target_relation
         and i.indisvalid
         and i.indisready
         and i.indkey[0] = owner_attnum
    ) then
      execute format('create index %I on public.%I (user_id)', 'lifeos_' || table_name || '_user_idx', table_name);
    end if;
  end loop;
end;
$owner_indexes$;

create index lifeos_habit_logs_habit_owner_idx on public.habit_logs(habit_id, user_id);
create index lifeos_tasks_habit_owner_idx on public.tasks(habit_id, user_id);
create index lifeos_goal_milestones_goal_owner_idx on public.goal_milestones(goal_id, user_id);
create index lifeos_goal_progress_goal_owner_idx on public.goal_progress_entries(goal_id, user_id);
create index lifeos_exercises_workout_owner_idx on public.exercises(workout_id, user_id);
create index lifeos_exercise_sets_exercise_owner_idx on public.exercise_sets(exercise_id, user_id);
create index lifeos_reading_sessions_book_owner_idx on public.reading_sessions(book_id, user_id);
create index lifeos_knowledge_note_tags_note_owner_idx on public.knowledge_note_tags(note_id, user_id);
create index lifeos_knowledge_note_tags_tag_owner_idx on public.knowledge_note_tags(tag_id, user_id);
create index lifeos_knowledge_links_source_owner_idx on public.knowledge_links(source_note_id, user_id);
create index lifeos_knowledge_links_target_owner_idx on public.knowledge_links(target_note_id, user_id);
create index lifeos_knowledge_book_links_note_owner_idx on public.knowledge_book_links(note_id, user_id);
create index lifeos_knowledge_book_links_book_owner_idx on public.knowledge_book_links(book_id, user_id);
create index lifeos_subject_topics_subject_owner_idx on public.subject_topics(subject_id, user_id);
create index lifeos_study_sessions_subject_owner_idx on public.study_sessions(subject_id, user_id);
create index lifeos_study_sessions_topic_subject_owner_idx on public.study_sessions(topic_id, subject_id, user_id);
create index lifeos_revision_items_subject_owner_idx on public.revision_items(subject_id, user_id);
create index lifeos_revision_items_topic_subject_owner_idx on public.revision_items(topic_id, subject_id, user_id);
create index lifeos_assessments_subject_owner_idx on public.assessments(subject_id, user_id);
create index lifeos_error_items_subject_owner_idx on public.error_log_items(subject_id, user_id);
create index lifeos_error_items_topic_subject_owner_idx on public.error_log_items(topic_id, subject_id, user_id);
create index lifeos_error_items_assessment_owner_idx on public.error_log_items(assessment_id, user_id);
create index lifeos_project_milestones_project_owner_idx on public.project_milestones(project_id, user_id);
create index lifeos_project_tasks_project_owner_idx on public.project_tasks(project_id, user_id);
create index lifeos_project_tasks_milestone_project_owner_idx on public.project_tasks(milestone_id, project_id, user_id);
create index lifeos_coding_sessions_project_owner_idx on public.coding_sessions(project_id, user_id);
create index lifeos_shipping_logs_project_owner_idx on public.shipping_logs(project_id, user_id);
create index lifeos_rabbit_hole_resources_parent_owner_idx on public.rabbit_hole_resources(rabbit_hole_id, user_id);
create index lifeos_rabbit_hole_experiments_parent_owner_idx on public.rabbit_hole_experiments(rabbit_hole_id, user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles enable row level security;
create policy lifeos_profiles_owner_access on public.profiles
  for all to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

do $policies$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'habits','habit_logs','tasks','daily_reviews','weekly_reviews','goals','goal_milestones','goal_progress_entries',
    'workouts','exercises','exercise_sets','running_sessions','body_metrics','sleep_logs','books','reading_sessions',
    'knowledge_notes','knowledge_tags','knowledge_note_tags','knowledge_links','knowledge_book_links','subjects',
    'subject_topics','study_sessions','revision_items','assessments','error_log_items','projects','project_milestones',
    'project_tasks','coding_sessions','shipping_logs','rabbit_holes','rabbit_hole_resources','rabbit_hole_experiments',
    'dsa_logs','speaking_sessions','videos'
  ] loop
    policy_name := 'lifeos_' || table_name || '_owner_access';
    execute format('alter table public.%I enable row level security', table_name);
    if exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = policy_name
    ) then
      raise exception 'Refusing to replace existing policy public.%.%', table_name, policy_name;
    end if;
    execute format(
      'create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      policy_name, table_name
    );
  end loop;
end;
$policies$;
