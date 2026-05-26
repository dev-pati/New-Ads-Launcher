create table if not exists ad_copy_templates (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references accounts(id) on delete cascade,
  ad_account_id text not null,
  name text not null,
  primary_text text,
  headline text,
  description text,
  link text,
  cta text default 'SHOP_NOW',
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table ad_copy_templates enable row level security;

create policy "org members can manage ad copy templates"
  on ad_copy_templates for all
  using (is_org_member(org_id));

create index ad_copy_templates_org_account_idx
  on ad_copy_templates (org_id, ad_account_id, created_at desc);

create trigger trg_ad_copy_templates_updated_at
  before update on ad_copy_templates
  for each row execute function update_updated_at_column();
