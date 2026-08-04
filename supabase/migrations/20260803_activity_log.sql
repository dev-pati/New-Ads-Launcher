-- Audit log — the exact record of what happened, separate from what anyone was told.
--
--   notification  = "you need to know this"   (N rows per event, one per recipient,
--                                              markable read, eventually irrelevant)
--   activity_log  = "this is what happened"   (1 row per event, never edited, never
--                                              deleted, readable by org members)
--   change history = activity_log filtered to one object, rendered in that object's UI
--
-- No policy grants insert/update/delete: only the service role writes, and nobody —
-- including an org admin — can rewrite history through the API.
--
-- Never written here: access tokens, appsecret_proof, cookies, service keys, or the
-- body of a Messenger conversation. lib/notifications/message.ts redacts by field
-- name before anything reaches this table.
--
-- Rollback: drop table if exists ads_launcher.activity_log;

set search_path = ads_launcher, public;

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

-- Org-wide feed, newest first.
create index if not exists activity_log_org_time_idx
  on activity_log (org_id, created_at desc);

-- Per-object change history.
create index if not exists activity_log_object_idx
  on activity_log (org_id, object_type, object_id, created_at desc);

-- "What has Seth been doing" — used by the audit view, not by the product UI.
create index if not exists activity_log_actor_idx
  on activity_log (org_id, actor_id, created_at desc);
