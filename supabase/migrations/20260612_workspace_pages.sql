create schema if not exists ads_launcher;
set search_path = ads_launcher, public;

alter table if exists pages
  alter column business_manager_id drop not null;

create table if not exists meta_accounts (
  id                     uuid        default gen_random_uuid() primary key,
  org_id                 uuid        not null references organizations(id) on delete cascade,
  user_id                uuid        not null references accounts(id) on delete cascade,
  provider               text        not null default 'facebook',
  meta_user_id           text        not null,
  access_token_encrypted text,
  connection_status      text        not null default 'connected',
  raw_data               jsonb       not null default '{}'::jsonb,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),
  unique (org_id, provider, meta_user_id)
);

create index if not exists idx_meta_accounts_org
  on meta_accounts(org_id, provider, connection_status);

create table if not exists meta_pages (
  id                     uuid        default gen_random_uuid() primary key,
  org_id                 uuid        not null references organizations(id) on delete cascade,
  meta_account_id        uuid        not null references meta_accounts(id) on delete cascade,
  page_id                text        not null,
  page_name              text        not null,
  page_picture_url       text,
  category               text,
  access_token_encrypted text,
  connection_status      text        not null default 'connected',
  raw_data               jsonb       not null default '{}'::jsonb,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now(),
  unique (org_id, page_id)
);

create index if not exists idx_meta_pages_org
  on meta_pages(org_id, page_name);
create index if not exists idx_meta_pages_account
  on meta_pages(meta_account_id);

create table if not exists workspace_pages (
  id           uuid        default gen_random_uuid() primary key,
  workspace_id uuid        not null references organizations(id) on delete cascade,
  meta_page_id uuid        not null references meta_pages(id) on delete cascade,
  page_id      text        not null,
  is_active    boolean     not null default true,
  added_by     uuid        references accounts(id) on delete set null,
  added_at     timestamptz default now(),
  removed_at   timestamptz,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (workspace_id, meta_page_id)
);

create index if not exists idx_workspace_pages_workspace
  on workspace_pages(workspace_id, is_active, removed_at);
create index if not exists idx_workspace_pages_page
  on workspace_pages(workspace_id, page_id);

drop trigger if exists update_meta_accounts_updated_at on meta_accounts;
create trigger update_meta_accounts_updated_at
  before update on meta_accounts
  for each row execute function update_updated_at_column();

drop trigger if exists update_meta_pages_updated_at on meta_pages;
create trigger update_meta_pages_updated_at
  before update on meta_pages
  for each row execute function update_updated_at_column();

drop trigger if exists update_workspace_pages_updated_at on workspace_pages;
create trigger update_workspace_pages_updated_at
  before update on workspace_pages
  for each row execute function update_updated_at_column();

alter table meta_accounts enable row level security;
alter table meta_pages enable row level security;
alter table workspace_pages enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'is_org_member'
      and n.nspname = current_schema()
  ) then
    execute 'drop policy if exists "Org members can view meta accounts" on meta_accounts';
    execute 'create policy "Org members can view meta accounts" on meta_accounts for select using (is_org_member(org_id))';
    execute 'drop policy if exists "Org members can manage meta accounts" on meta_accounts';
    execute 'create policy "Org members can manage meta accounts" on meta_accounts for all using (is_org_member(org_id)) with check (is_org_member(org_id))';

    execute 'drop policy if exists "Org members can view meta pages" on meta_pages';
    execute 'create policy "Org members can view meta pages" on meta_pages for select using (is_org_member(org_id))';
    execute 'drop policy if exists "Org members can manage meta pages" on meta_pages';
    execute 'create policy "Org members can manage meta pages" on meta_pages for all using (is_org_member(org_id)) with check (is_org_member(org_id))';

    execute 'drop policy if exists "Org members can view workspace pages" on workspace_pages';
    execute 'create policy "Org members can view workspace pages" on workspace_pages for select using (is_org_member(workspace_id))';
    execute 'drop policy if exists "Org members can insert workspace pages" on workspace_pages';
    execute 'create policy "Org members can insert workspace pages" on workspace_pages for insert with check (is_org_member(workspace_id))';
    execute 'drop policy if exists "Org members can update workspace pages" on workspace_pages';
    execute 'create policy "Org members can update workspace pages" on workspace_pages for update using (is_org_member(workspace_id)) with check (is_org_member(workspace_id))';
  end if;
end $$;
