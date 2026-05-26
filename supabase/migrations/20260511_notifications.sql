create table if not exists notifications (
  id          uuid default gen_random_uuid() primary key,
  org_id      uuid not null,
  user_id     uuid not null references accounts(id) on delete cascade,
  actor_id    uuid references accounts(id) on delete set null,
  actor_name  text,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "users can read own notifications"
  on notifications for select
  using (current_account_id() = user_id);

create policy "users can update own notifications"
  on notifications for update
  using (current_account_id() = user_id);

create index notifications_user_unread_idx on notifications (user_id, is_read, created_at desc);
create index notifications_org_idx on notifications (org_id, created_at desc);
