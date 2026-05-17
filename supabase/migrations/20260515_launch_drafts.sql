create table if not exists launch_drafts (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null,
  user_id uuid not null,
  user_name text,
  name text not null,
  ad_account_id text,
  ad_account_name text,
  row_count integer not null default 0,
  creative_ids text[] not null default '{}',
  creative_thumbs text[] not null default '{}',
  -- lean row data: no creative objects, just creativeId + settings per row
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table launch_drafts enable row level security;

create policy "org members can manage launch drafts"
  on launch_drafts for all
  using (org_id::text = current_setting('app.active_org_id', true));

create index launch_drafts_org_id_idx on launch_drafts (org_id, created_at desc);
