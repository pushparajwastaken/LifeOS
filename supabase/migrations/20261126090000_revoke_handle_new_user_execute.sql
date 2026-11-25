-- Restrict who can call the SECURITY DEFINER auth trigger function directly.
--
-- public.lifeos_handle_new_user() runs as a trigger on auth.users to create each
-- user's profile. It never needs to be called by API roles. Production already
-- has EXECUTE limited to postgres and service_role (applied outside migration
-- history); this migration records that state in the repository so every
-- environment built from migrations matches it.
--
-- Trigger execution does not check EXECUTE privileges, so sign-up profile
-- creation is unaffected. Re-running this migration is harmless.

revoke execute on function public.lifeos_handle_new_user() from public, anon, authenticated;
