-- One weekly report configuration per org. Due runs stop at pending review;
-- only an admin's explicit preview-and-send action delivers mail.

set search_path = ads_launcher, public;

create table if not exists weekly_report_schedules (
  org_id uuid primary key references organizations(id) on delete cascade,
  created_by uuid not null references accounts(id) on delete cascade,
  enabled boolean not null default false,
  weekday smallint not null default 5 check (weekday between 0 and 6),
  send_time text not null default '16:00' check (send_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  timezone text not null default 'Asia/Ho_Chi_Minh' check (char_length(timezone) between 1 and 64),
  pending_review boolean not null default false,
  last_due_local_date date,
  last_due_at timestamptz,
  last_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table weekly_report_schedules enable row level security;

drop policy if exists "Org admins can read weekly report schedule" on weekly_report_schedules;
create policy "Org admins can read weekly report schedule"
  on weekly_report_schedules for select
  to authenticated
  using ((select is_org_admin(org_id)));

drop policy if exists "Org admins can create weekly report schedule" on weekly_report_schedules;
create policy "Org admins can create weekly report schedule"
  on weekly_report_schedules for insert
  to authenticated
  with check ((select is_org_admin(org_id)) and created_by = (select current_account_id()));

drop policy if exists "Org admins can update weekly report schedule" on weekly_report_schedules;
create policy "Org admins can update weekly report schedule"
  on weekly_report_schedules for update
  to authenticated
  using ((select is_org_admin(org_id)))
  with check ((select is_org_admin(org_id)));

grant select, insert, update on weekly_report_schedules to authenticated;
