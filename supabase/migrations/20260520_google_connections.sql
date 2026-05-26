create table if not exists google_connections (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references accounts(id) on delete cascade,
  email text,
  access_token text,
  refresh_token text not null,
  expiry_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id)
);

alter table google_connections enable row level security;

create policy "org members can manage google connections"
  on google_connections for all
  using (is_org_member(org_id));

create trigger trg_google_connections_updated_at
  before update on google_connections
  for each row execute function update_updated_at_column();
