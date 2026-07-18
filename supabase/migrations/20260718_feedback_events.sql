-- feedback_events lives in the app schema (ads_launcher). SQL Editor defaults to
-- public, so set search_path so unqualified accounts / orgs / helper functions resolve.
set search_path = ads_launcher, public;

create table if not exists feedback_events (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  user_id            uuid not null references accounts(id) on delete cascade,
  user_email         text,
  feature_area       text not null,
  feature_function   text not null,
  feedback_type      text not null,
  severity           text not null,
  observed_evidence  text not null,
  expected_result    text not null,
  reference_url      text,
  extra_note         text,
  expected_done_at   date,
  artifact_url       text,
  screenshot_path    text,
  screenshot_url     text,
  status             text not null default 'open',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table feedback_events enable row level security;

create policy "org members can read feedback"
  on feedback_events for select
  using (is_org_member(org_id));

create policy "org members can insert feedback"
  on feedback_events for insert
  with check (is_org_member(org_id) and user_id = current_account_id());

create index feedback_events_org_created_idx on feedback_events (org_id, created_at desc);
create index feedback_events_org_status_idx on feedback_events (org_id, status, severity, created_at desc);
