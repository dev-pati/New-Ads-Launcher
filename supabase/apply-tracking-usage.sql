-- ============================================================================
-- Tracking System v2 — everything the feature needs, in one paste.
--
-- Paste into the Supabase SQL editor of project vrnstjkxumaaduqswkji and run once.
-- Safe to re-run: every statement is create-if-not-exists / add-if-not-exists /
-- drop-then-create for policies. It creates nothing outside schema ads_launcher and
-- alters no existing table other than adding nullable columns to weekly_painpoints.
--
-- This file is a concatenation, not a new source of truth. The canonical migrations are
--   supabase/migrations/20260803_activity_log.sql
--   supabase/migrations/20260805_weekly_painpoints.sql
--   supabase/migrations/20260805_meta_fallback_events.sql
-- Change them there and regenerate this file — do not edit only this copy.
--
-- Until this runs, the Tracking page still works: App activity reports itself as
-- unavailable and counts launches only. It never shows 0 for something it cannot see.
--
-- Rollback (loses recorded history — read before running):
--   drop table if exists ads_launcher.meta_fallback_events;
--   drop table if exists ads_launcher.weekly_painpoints;
--   drop table if exists ads_launcher.activity_log;
-- ============================================================================

set search_path = ads_launcher, public;

-- ----------------------------------------------------------------------------
-- 1. activity_log — what happened, separate from what anyone was told.
--
--   notification  = "you need to know this"  (one row per recipient, markable read)
--   activity_log  = "this is what happened"  (one row per event, never edited)
--
-- No policy grants insert/update/delete: only the service role writes, so nobody —
-- including an org admin — can rewrite history through the API.
--
-- Never written here: access tokens, appsecret_proof, cookies, service keys, or the
-- body of a Messenger conversation. lib/notifications/message.ts redacts by field name
-- before anything reaches this table.
-- ----------------------------------------------------------------------------

create table if not exists activity_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  actor_id    uuid references accounts(id) on delete set null,
  actor_name  text,
  object_type text not null,
  object_id   text not null,
  object_name text,
  action      text not null,
  changes     jsonb not null default '[]'::jsonb,
  source      text not null default 'app',
  request_id  text,
  created_at  timestamptz not null default now()
);

alter table activity_log enable row level security;

drop policy if exists "Org members can read activity log" on activity_log;
create policy "Org members can read activity log"
  on activity_log
  for select
  to authenticated
  using (is_org_member(org_id));

create index if not exists activity_log_org_time_idx
  on activity_log (org_id, created_at desc);

create index if not exists activity_log_object_idx
  on activity_log (org_id, object_type, object_id, created_at desc);

create index if not exists activity_log_actor_idx
  on activity_log (org_id, actor_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 2. weekly_painpoints — the weekly feedback loop, one row per person per ISO week.
--
-- The long note is optional. The structured answers are the ones that produce a number.
-- null means unanswered, which is never the same as 0 or 'not_yet'.
-- ----------------------------------------------------------------------------

create table if not exists weekly_painpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references accounts(id) on delete cascade,
  week_start date not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, week_start)
);

alter table weekly_painpoints add column if not exists creative_aggregate text;
alter table weekly_painpoints add column if not exists spot_check_matched int;
alter table weekly_painpoints add column if not exists spot_check_total int not null default 5;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'weekly_painpoints_creative_aggregate_check') then
    alter table weekly_painpoints
      add constraint weekly_painpoints_creative_aggregate_check
      check (creative_aggregate is null or creative_aggregate in ('works', 'not_yet'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'weekly_painpoints_spot_check_range') then
    alter table weekly_painpoints
      add constraint weekly_painpoints_spot_check_range
      check (
        spot_check_total between 1 and 20
        and (spot_check_matched is null or spot_check_matched between 0 and spot_check_total)
      );
  end if;
end $$;

alter table weekly_painpoints enable row level security;

drop policy if exists "Users can read own weekly painpoints" on weekly_painpoints;
create policy "Users can read own weekly painpoints"
  on weekly_painpoints for select
  using (user_id = current_account_id() and is_org_member(org_id));

drop policy if exists "Users can insert own weekly painpoints" on weekly_painpoints;
create policy "Users can insert own weekly painpoints"
  on weekly_painpoints for insert
  with check (user_id = current_account_id() and is_org_member(org_id));

drop policy if exists "Users can update own weekly painpoints" on weekly_painpoints;
create policy "Users can update own weekly painpoints"
  on weekly_painpoints for update
  using (user_id = current_account_id() and is_org_member(org_id))
  with check (user_id = current_account_id() and is_org_member(org_id));

create index if not exists weekly_painpoints_org_week_idx
  on weekly_painpoints (org_id, week_start desc);

-- ----------------------------------------------------------------------------
-- 3. meta_fallback_events — every time someone had to finish the job in Meta Ads
--    Manager instead of here.
--
-- The product's own admission of where it stops working. One row per occurrence, not a
-- weekly tally: a tally answers "how many", only the rows answer "which day and why",
-- and "why" is the part that becomes a backlog item.
-- ----------------------------------------------------------------------------

create table if not exists meta_fallback_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references accounts(id) on delete cascade,
  reason text not null check (reason in ('launch', 'review_status', 'performance', 'creative_aggregate', 'data_accuracy', 'other')),
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table meta_fallback_events enable row level security;

drop policy if exists "Org members can read fallback events" on meta_fallback_events;
create policy "Org members can read fallback events"
  on meta_fallback_events for select
  using (is_org_member(org_id));

drop policy if exists "Users can log own fallback events" on meta_fallback_events;
create policy "Users can log own fallback events"
  on meta_fallback_events for insert
  with check (user_id = current_account_id() and is_org_member(org_id));

drop policy if exists "Users can delete own fallback events" on meta_fallback_events;
create policy "Users can delete own fallback events"
  on meta_fallback_events for delete
  using (user_id = current_account_id() and is_org_member(org_id));

create index if not exists meta_fallback_events_org_time_idx
  on meta_fallback_events (org_id, created_at desc);

create index if not exists meta_fallback_events_user_time_idx
  on meta_fallback_events (org_id, user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Verify (should return three rows):
--   select table_name from information_schema.tables
--    where table_schema = 'ads_launcher'
--      and table_name in ('activity_log', 'weekly_painpoints', 'meta_fallback_events');
-- ----------------------------------------------------------------------------
