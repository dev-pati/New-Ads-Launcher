-- SECURITY: pin search_path on AdLauncher's SECURITY DEFINER helper functions.
--
-- WHY
-- All six helpers below are SECURITY DEFINER (they run as `postgres`) and each
-- one references `org_members` UNQUALIFIED:
--
--     SELECT EXISTS (SELECT 1 FROM org_members WHERE org_id = ... AND user_id = auth.uid() ...)
--
-- None of them pins `search_path`, so the table reference is resolved using
-- whatever search_path the CALLER happens to have. That is a privilege-escalation
-- vector: anything able to prepend a schema to the resolution order can substitute
-- its own `org_members` and have it read by a definer-rights function.
--
-- It is also a live correctness hazard. The cluster default search_path is
-- `"$user", public, extensions` — it does NOT contain `ads_launcher`. These
-- functions only behave correctly today because PostgREST sets the search_path
-- per request. Called from any other context (psql, a trigger, a cron job) the
-- unqualified `org_members` resolves to the EMPTY `public.org_members`, so the
-- function silently returns false and RLS denies access with no error.
--
-- Pinning `ads_launcher, public` makes the resolution deterministic and equal to
-- the path that already serves production traffic.
--
-- WHY ALTER AND NOT CREATE OR REPLACE
-- ALTER FUNCTION ... SET search_path changes only the function's config, never its
-- body or signature. Nothing that calls these functions can observe a difference
-- except the resolution rule itself.
--
-- CREATIVE PORTAL IMPACT: NONE.
-- Scope is strictly `ads_launcher.*`. Deliberately EXCLUDED:
--   * public.handle_new_user()  -- trigger `on_auth_user_created` on the SHARED
--                                  auth.users table; fires on Creative Portal
--                                  signups and writes public.profiles (464 rows).
--                                  Portal-owned surface, not AdLauncher's.
--   * public.{is_org_member,is_org_admin,can_*}  -- attached to the abandoned
--                                  duplicate tables in `public`; left untouched
--                                  so this migration cannot affect any other
--                                  product sharing the `public` schema.
--
-- Creative Portal already pins search_path on all 46 of its own SECURITY DEFINER
-- functions. This migration brings AdLauncher up to the convention Portal set.

ALTER FUNCTION ads_launcher.is_org_member(check_org_id uuid)      SET search_path = ads_launcher, public;
ALTER FUNCTION ads_launcher.is_org_admin(check_org_id uuid)       SET search_path = ads_launcher, public;
ALTER FUNCTION ads_launcher.can_edit_ads(check_org_id uuid)       SET search_path = ads_launcher, public;
ALTER FUNCTION ads_launcher.can_delete_ads(check_org_id uuid)     SET search_path = ads_launcher, public;
ALTER FUNCTION ads_launcher.can_upload_media(check_org_id uuid)   SET search_path = ads_launcher, public;
ALTER FUNCTION ads_launcher.can_write_comments(check_org_id uuid) SET search_path = ads_launcher, public;

-- VERIFY (expect 6 rows, each cfg = 'search_path=ads_launcher, public')
--   select p.proname, array_to_string(p.proconfig,',') cfg
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'ads_launcher' and p.prosecdef order by 1;
--
-- SMOKE TEST after apply: load the dashboard as a normal org member and confirm
-- creatives / launch batches / notifications still list. RLS denial would show as
-- empty lists, not errors, so check data is present rather than absence of errors.
--
-- ROLLBACK (restores the previous unpinned behaviour exactly):
--   ALTER FUNCTION ads_launcher.is_org_member(check_org_id uuid)      RESET search_path;
--   ALTER FUNCTION ads_launcher.is_org_admin(check_org_id uuid)       RESET search_path;
--   ALTER FUNCTION ads_launcher.can_edit_ads(check_org_id uuid)       RESET search_path;
--   ALTER FUNCTION ads_launcher.can_delete_ads(check_org_id uuid)     RESET search_path;
--   ALTER FUNCTION ads_launcher.can_upload_media(check_org_id uuid)   RESET search_path;
--   ALTER FUNCTION ads_launcher.can_write_comments(check_org_id uuid) RESET search_path;
