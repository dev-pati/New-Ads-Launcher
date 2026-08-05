-- Notification inbox lifecycle and per-user, per-org in-app delivery preferences.
set search_path = ads_launcher, public;

alter table notifications
  add column if not exists archived_at timestamptz;

create index if not exists notifications_inbox_idx
  on notifications (org_id, user_id, created_at desc)
  where archived_at is null;

create index if not exists notifications_archived_idx
  on notifications (org_id, user_id, archived_at desc)
  where archived_at is not null;

create table if not exists notification_preferences (
  org_id uuid not null,
  user_id uuid not null references accounts(id) on delete cascade,
  category text not null check (category in ('business', 'ads', 'profiles', 'apps')),
  in_app_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id, category)
);

alter table notification_preferences enable row level security;

drop policy if exists "users can read own notification preferences" on notification_preferences;
create policy "users can read own notification preferences"
  on notification_preferences for select
  using (current_account_id() = user_id);

drop policy if exists "users can update own notification preferences" on notification_preferences;
create policy "users can update own notification preferences"
  on notification_preferences for update
  using (current_account_id() = user_id)
  with check (current_account_id() = user_id);

drop policy if exists "users can insert own notification preferences" on notification_preferences;
create policy "users can insert own notification preferences"
  on notification_preferences for insert
  with check (current_account_id() = user_id);
