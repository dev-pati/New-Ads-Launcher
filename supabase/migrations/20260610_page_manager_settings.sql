create schema if not exists ads_launcher;
set search_path = ads_launcher, public;

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists page_manager_settings (
  id         uuid        default gen_random_uuid() primary key,
  org_id     uuid        not null,
  page_id    text        not null,
  settings   jsonb       not null default '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, page_id)
);

create index if not exists idx_page_manager_settings_org
  on page_manager_settings(org_id);
create index if not exists idx_page_manager_settings_page
  on page_manager_settings(org_id, page_id);

drop trigger if exists update_page_manager_settings_updated_at on page_manager_settings;
create trigger update_page_manager_settings_updated_at
  before update on page_manager_settings
  for each row execute function update_updated_at_column();

create table if not exists page_manager_settings_audit_logs (
  id           uuid        default gen_random_uuid() primary key,
  org_id       uuid        not null,
  page_id      text        not null,
  actor_id     uuid,
  action       text        not null check (action in ('update', 'copy')),
  section      text,
  before_value jsonb,
  after_value  jsonb,
  changes      jsonb       not null default '[]'::jsonb,
  created_at   timestamptz default now()
);

create index if not exists idx_page_manager_settings_audit_org
  on page_manager_settings_audit_logs(org_id, created_at desc);
create index if not exists idx_page_manager_settings_audit_page
  on page_manager_settings_audit_logs(org_id, page_id, created_at desc);

alter table page_manager_settings enable row level security;
alter table page_manager_settings_audit_logs enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'is_org_member'
      and n.nspname = current_schema()
  ) then
    execute 'drop policy if exists "Org members can view page manager settings" on page_manager_settings';
    execute 'create policy "Org members can view page manager settings" on page_manager_settings for select using (is_org_member(org_id))';
    execute 'drop policy if exists "Org members can insert page manager settings" on page_manager_settings';
    execute 'create policy "Org members can insert page manager settings" on page_manager_settings for insert with check (is_org_member(org_id))';
    execute 'drop policy if exists "Org members can update page manager settings" on page_manager_settings';
    execute 'create policy "Org members can update page manager settings" on page_manager_settings for update using (is_org_member(org_id))';
    execute 'drop policy if exists "Org members can delete page manager settings" on page_manager_settings';
    execute 'create policy "Org members can delete page manager settings" on page_manager_settings for delete using (is_org_member(org_id))';

    execute 'drop policy if exists "Org members can view page manager settings audit logs" on page_manager_settings_audit_logs';
    execute 'create policy "Org members can view page manager settings audit logs" on page_manager_settings_audit_logs for select using (is_org_member(org_id))';
    execute 'drop policy if exists "Org members can insert page manager settings audit logs" on page_manager_settings_audit_logs';
    execute 'create policy "Org members can insert page manager settings audit logs" on page_manager_settings_audit_logs for insert with check (is_org_member(org_id))';
  end if;
end $$;
