-- Harden table privileges on the tables created before M1 (core migration and the Google Calendar sync
-- migration). Supabase's default privileges had given both API roles every table privilege, including
-- TRUNCATE (not limited by RLS), REFERENCES and TRIGGER, and gave the anonymous role full write access
-- (RLS was the only thing stopping it). This brings them in line with every table added since M1:
-- no anonymous access, and select/insert/update/delete for signed-in users, with RLS still enforcing
-- ownership row by row.
--
-- Not touched on purpose: the legacy tables rabbit_holes, rabbit_hole_resources, rabbit_hole_experiments
-- and study_sessions, which are preserved exactly as they are by owner decision.
-- No data, columns, constraints, policies or functions change. Re-running is harmless (revoke/grant are
-- idempotent) but the preconditions require the tables to exist with RLS enabled.

-- Preconditions (read-only): fail loudly instead of partially applying.
do $preconditions$
declare
  expected text[] := array[
    'profiles', 'tasks', 'habits', 'habit_logs', 'daily_reviews', 'weekly_reviews',
    'goals', 'goal_milestones', 'goal_progress_entries',
    'workouts', 'exercises', 'exercise_sets', 'running_sessions', 'body_metrics', 'sleep_logs',
    'books', 'reading_sessions', 'videos', 'knowledge_notes', 'knowledge_tags', 'knowledge_note_tags', 'knowledge_links', 'knowledge_book_links',
    'subjects', 'subject_topics', 'assessments', 'revision_items', 'error_log_items',
    'projects', 'project_milestones', 'project_tasks', 'coding_sessions', 'shipping_logs', 'dsa_logs', 'speaking_sessions',
    'habit_calendar_connections', 'habit_calendar_events'
  ];
  missing text;
  without_rls text;
begin
  select string_agg(name, ', ') into missing
  from unnest(expected) as name
  where to_regclass('public.' || name) is null;
  if missing is not null then
    raise exception 'harden_core_table_grants: missing tables: %', missing;
  end if;

  select string_agg(c.relname, ', ') into without_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = any (expected) and not c.relrowsecurity;
  if without_rls is not null then
    raise exception 'harden_core_table_grants: RLS is not enabled on: %', without_rls;
  end if;
end
$preconditions$;

revoke all on table
  public.profiles, public.tasks, public.habits, public.habit_logs, public.daily_reviews, public.weekly_reviews,
  public.goals, public.goal_milestones, public.goal_progress_entries,
  public.workouts, public.exercises, public.exercise_sets, public.running_sessions, public.body_metrics, public.sleep_logs,
  public.books, public.reading_sessions, public.videos, public.knowledge_notes, public.knowledge_tags, public.knowledge_note_tags, public.knowledge_links, public.knowledge_book_links,
  public.subjects, public.subject_topics, public.assessments, public.revision_items, public.error_log_items,
  public.projects, public.project_milestones, public.project_tasks, public.coding_sessions, public.shipping_logs, public.dsa_logs, public.speaking_sessions,
  public.habit_calendar_connections, public.habit_calendar_events
from anon, authenticated;

grant select, insert, update, delete on table
  public.profiles, public.tasks, public.habits, public.habit_logs, public.daily_reviews, public.weekly_reviews,
  public.goals, public.goal_milestones, public.goal_progress_entries,
  public.workouts, public.exercises, public.exercise_sets, public.running_sessions, public.body_metrics, public.sleep_logs,
  public.books, public.reading_sessions, public.videos, public.knowledge_notes, public.knowledge_tags, public.knowledge_note_tags, public.knowledge_links, public.knowledge_book_links,
  public.subjects, public.subject_topics, public.assessments, public.revision_items, public.error_log_items,
  public.projects, public.project_milestones, public.project_tasks, public.coding_sessions, public.shipping_logs, public.dsa_logs, public.speaking_sessions,
  public.habit_calendar_connections, public.habit_calendar_events
to authenticated;
