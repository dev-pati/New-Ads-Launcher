create table if not exists google_connections (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null,
  user_id uuid not null,
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
  using (org_id::text = current_setting('app.active_org_id', true));

create trigger trg_google_connections_updated_at
  before update on google_connections
  for each row execute function update_updated_at_column();
