-- Via MECE model (decision 09/07/2026, spec: project-docs/03-plans/launch-ads/phase-a-multi-via-token.md)
-- facebook_connections: phân loại oauth vs manual_token (via) + via_role launch/non_launch
-- ad_accounts: 2 slot độc lập — tối đa 1 via launch + 1 via non-launch mỗi account

create schema if not exists ads_launcher;
set search_path = ads_launcher, public;

alter table if exists facebook_connections
  add column if not exists connection_type text not null default 'oauth',
  add column if not exists via_role        text,
  add column if not exists label           text,
  add column if not exists token_status    text not null default 'valid',
  add column if not exists last_checked_at timestamptz;

do $$
begin
  alter table facebook_connections
    add constraint facebook_connections_connection_type_check
    check (connection_type in ('oauth', 'manual_token'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table facebook_connections
    add constraint facebook_connections_token_status_check
    check (token_status in ('valid', 'expired', 'invalid'));
exception when duplicate_object then null;
end $$;

-- MECE: via (manual_token) bắt buộc có role; oauth đứng ngoài phân loại (via_role null)
do $$
begin
  alter table facebook_connections
    add constraint facebook_connections_via_role_mece_check
    check (
      (connection_type = 'manual_token' and via_role in ('launch', 'non_launch'))
      or (connection_type = 'oauth' and via_role is null)
    );
exception when duplicate_object then null;
end $$;

alter table if exists ad_accounts
  add column if not exists launch_connection_id uuid references facebook_connections(id) on delete set null,
  add column if not exists read_connection_id   uuid references facebook_connections(id) on delete set null;

-- Ad accounts nhìn thấy qua via có thể không thuộc BM nào đã sync trong DB
alter table if exists ad_accounts
  alter column business_manager_id drop not null;

create index if not exists idx_ad_accounts_launch_conn on ad_accounts(launch_connection_id);
create index if not exists idx_ad_accounts_read_conn   on ad_accounts(read_connection_id);
