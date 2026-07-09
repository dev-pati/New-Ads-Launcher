create table if not exists launch_presets (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  ad_account_id text not null,
  name text not null,
  launch_defaults jsonb not null default '{}',
  last_used_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists launch_presets_org_account_idx on launch_presets (org_id, ad_account_id, last_used_at desc);

alter table launch_presets enable row level security;

drop policy if exists "Org members can manage launch presets" on launch_presets;
create policy "Org members can manage launch presets"
on launch_presets for all
using (is_org_member(org_id))
with check (is_org_member(org_id));
