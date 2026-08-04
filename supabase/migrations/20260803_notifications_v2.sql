-- Notification v2 — store the parts of a message, not the finished sentence.
--
-- [Actor] + [Action] + [Object] + [Important change] + [Time]
--   actor_name (already existed) + action + object_type/object_id/object_name
--   + changes[] + created_at (already existed)
--
-- Additive only. `title` and `body` keep being written, so rows created before this
-- migration still render and a client built against the old shape still works.
--
-- Rollback:
--   drop index if exists ads_launcher.notifications_dedupe_uq;
--   drop index if exists ads_launcher.notifications_object_idx;
--   alter table ads_launcher.notifications
--     drop column if exists object_type, drop column if exists object_id,
--     drop column if exists object_name, drop column if exists action,
--     drop column if exists changes,     drop column if exists dedupe_key,
--     drop column if exists read_at;
-- No row is lost by the rollback.

set search_path = ads_launcher, public;

alter table notifications
  add column if not exists object_type text,
  add column if not exists object_id   text,
  add column if not exists object_name text,
  add column if not exists action      text,
  add column if not exists changes     jsonb not null default '[]'::jsonb,
  add column if not exists dedupe_key  text,
  add column if not exists read_at     timestamptz;

-- Idempotency. One event delivered twice — a retried route, a double-clicked button,
-- a reconnecting worker — produces one notification per recipient, not two.
create unique index if not exists notifications_dedupe_uq
  on notifications (user_id, dedupe_key)
  where dedupe_key is not null;

-- "What happened to this object" — the read path for the per-object change history.
create index if not exists notifications_object_idx
  on notifications (org_id, object_type, object_id, created_at desc);

-- read_at backfill: rows already marked read have no timestamp to recover, so they
-- get their creation time rather than a null that would read as "never read".
update notifications set read_at = created_at
  where is_read = true and read_at is null;
