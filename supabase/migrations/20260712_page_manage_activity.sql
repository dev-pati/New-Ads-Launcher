-- Page Manage activity log: append-only proof of real module usage (Content/Comment/Inbox Ops)
-- Mirrors RLS/policy pattern of 20260610_page_manager_settings.sql
set search_path = ads_launcher, public;

create table if not exists page_manage_activity (
  id         uuid        default gen_random_uuid() primary key,
  org_id     uuid        not null,
  actor_id   uuid,
  page_id    text        not null,
  module     text        not null check (module in ('content','comment','inbox')),
  action     text        not null,
  target_ref text,
  created_at timestamptz default now()
);

create index if not exists idx_page_manage_activity_org
  on page_manage_activity(org_id, created_at desc);
create index if not exists idx_page_manage_activity_actor
  on page_manage_activity(org_id, actor_id, created_at desc);

alter table page_manage_activity enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'is_org_member'
      and n.nspname = current_schema()
  ) then
    -- append-only: select + insert only, no update/delete policy
    execute 'drop policy if exists "Org members can view page manage activity" on page_manage_activity';
    execute 'create policy "Org members can view page manage activity" on page_manage_activity for select using (is_org_member(org_id))';
    execute 'drop policy if exists "Org members can insert page manage activity" on page_manage_activity';
    execute 'create policy "Org members can insert page manage activity" on page_manage_activity for insert with check (is_org_member(org_id))';
  end if;
end $$;
