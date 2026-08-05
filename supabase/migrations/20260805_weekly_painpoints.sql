set search_path = ads_launcher, public;

create table if not exists weekly_painpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references accounts(id) on delete cascade,
  week_start date not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, week_start)
);

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
