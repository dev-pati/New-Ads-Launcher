-- Optimistic concurrency control for the objects several people edit at once.
--
-- The write becomes  UPDATE … WHERE id = $1 AND org_id = $2 AND row_version = $3
-- and bumps row_version in the same statement. Zero rows affected means somebody
-- else saved first: the route re-reads, answers 409 STALE_WRITE with who changed
-- what, and the client shows a conflict instead of silently overwriting.
--
-- Deliberately NOT a trigger. A trigger would bump the version on every internal
-- UPDATE too — the upload cron stamping fb_video_id, the sync job touching status —
-- and every one of those would make an open editor stale for a change it does not
-- care about. Bumping explicitly in the user-facing route keeps the version tied to
-- user-visible edits.
--
-- Default 1 on existing rows, so a client that has not been reloaded yet and sends
-- no version still works (the route falls back to last-write-wins and records that
-- it did — see lib/optimistic-update.ts).
--
-- Rollback: alter table <t> drop column if exists row_version;  (per table)

set search_path = ads_launcher, public;

alter table creatives          add column if not exists row_version integer not null default 1;
alter table automations        add column if not exists row_version integer not null default 1;
alter table ad_copy_templates  add column if not exists row_version integer not null default 1;
alter table creative_requests  add column if not exists row_version integer not null default 1;
alter table org_members        add column if not exists row_version integer not null default 1;

-- creatives has no updated_at; the conflict message needs a "when" to show.
alter table creatives          add column if not exists updated_at timestamptz not null default now();
alter table ad_copy_templates  add column if not exists updated_at timestamptz not null default now();

-- Who touched it last, so the 409 can say "updated by Seth" without joining the
-- audit log on the hot path.
alter table creatives          add column if not exists updated_by uuid references accounts(id) on delete set null;
alter table automations        add column if not exists updated_by uuid references accounts(id) on delete set null;
alter table ad_copy_templates  add column if not exists updated_by uuid references accounts(id) on delete set null;
alter table creative_requests  add column if not exists updated_by uuid references accounts(id) on delete set null;
