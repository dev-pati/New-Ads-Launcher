-- Minimal self-reported evidence that AdLauncher could not finish the job.
-- Successful app work stays in its authoritative tables; this table stores defects only.

set search_path = ads_launcher, public;

create table if not exists kr_fallbacks (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references accounts(id) on delete cascade,
  kind text not null check (kind in ('launch', 'control')),
  occurred_at timestamptz not null default now()
);

alter table kr_fallbacks enable row level security;

drop policy if exists "Users can read own KR fallbacks" on kr_fallbacks;
create policy "Users can read own KR fallbacks"
  on kr_fallbacks for select
  to authenticated
  using (user_id = current_account_id() and is_org_member(org_id));

drop policy if exists "Users can insert own KR fallbacks" on kr_fallbacks;
create policy "Users can insert own KR fallbacks"
  on kr_fallbacks for insert
  to authenticated
  with check (user_id = current_account_id() and is_org_member(org_id));

drop policy if exists "Users can delete own KR fallbacks" on kr_fallbacks;
create policy "Users can delete own KR fallbacks"
  on kr_fallbacks for delete
  to authenticated
  using (user_id = current_account_id() and is_org_member(org_id));

create index if not exists kr_fallbacks_org_user_time_idx
  on kr_fallbacks (org_id, user_id, occurred_at desc);
