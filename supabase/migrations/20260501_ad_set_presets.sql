create table if not exists ad_set_presets (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  objective text not null,
  special_ad_categories jsonb default '[]',
  targeting jsonb default '{}',
  optimization_goal text,
  billing_event text,
  bid_strategy text,
  bid_amount text,
  adset_name text,
  campaign_name text,
  created_at timestamptz default now()
);

alter table ad_set_presets enable row level security;

create policy "org members can manage presets"
  on ad_set_presets for all
  using (is_org_member(org_id));
