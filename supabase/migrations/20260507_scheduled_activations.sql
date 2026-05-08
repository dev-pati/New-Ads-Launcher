create table if not exists scheduled_activations (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null,
  ad_account_id text not null,
  ad_ids text[] not null default '{}',
  scheduled_at timestamptz not null,
  end_time timestamptz,
  status text not null default 'pending',  -- pending | activated | paused | cancelled | failed
  error text,
  created_at timestamptz default now()
);

alter table scheduled_activations enable row level security;

create policy "org members can read scheduled activations"
  on scheduled_activations for select
  using (org_id::text = current_setting('app.active_org_id', true));

create index scheduled_activations_pending_idx
  on scheduled_activations (status, scheduled_at)
  where status = 'pending';

create index scheduled_activations_activated_idx
  on scheduled_activations (status, end_time)
  where status = 'activated';
