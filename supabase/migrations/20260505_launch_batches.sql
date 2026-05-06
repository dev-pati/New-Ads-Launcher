create table if not exists launch_batches (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null,
  user_id uuid not null,
  user_name text,
  ad_account_id text not null,
  ad_account_name text,
  adset_ids text[] not null default '{}',
  adset_names text[] not null default '{}',
  creative_ids text[] not null default '{}',
  creative_thumbs text[] not null default '{}',
  primary_text text,
  headline text,
  cta text,
  web_link text,
  page_id text,
  status text not null default 'success',
  total_ads integer not null default 0,
  failed_ads integer not null default 0,
  duration_ms integer,
  errors jsonb default '[]',
  created_at timestamptz default now()
);

alter table launch_batches enable row level security;

create policy "org members can manage launch batches"
  on launch_batches for all
  using (org_id::text = current_setting('app.active_org_id', true));

create index launch_batches_org_id_idx on launch_batches (org_id, created_at desc);
