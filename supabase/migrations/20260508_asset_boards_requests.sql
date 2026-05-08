-- Asset Boards: organize creatives into named collections
create table if not exists asset_boards (
  id          uuid        default gen_random_uuid() primary key,
  org_id      uuid        not null references organizations(id) on delete cascade,
  user_id     uuid        not null references auth.users(id),
  name        text        not null,
  description text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_asset_boards_org on asset_boards(org_id);

-- Board <-> Creative join table
create table if not exists board_assets (
  board_id    uuid        not null references asset_boards(id) on delete cascade,
  creative_id uuid        not null references creatives(id)    on delete cascade,
  added_at    timestamptz default now(),
  primary key (board_id, creative_id)
);
create index if not exists idx_board_assets_board    on board_assets(board_id);
create index if not exists idx_board_assets_creative on board_assets(creative_id);

-- Creative Requests: assign video/image work to team members
create table if not exists creative_requests (
  id          uuid        default gen_random_uuid() primary key,
  org_id      uuid        not null references organizations(id) on delete cascade,
  created_by  uuid        not null references auth.users(id),
  title       text        not null,
  description text,
  status      text        default 'open'
                          check (status in ('open','in_progress','completed','cancelled')),
  due_date    date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_creative_requests_org on creative_requests(org_id);

-- Add tags column to creatives (safe if already exists)
alter table creatives add column if not exists tags text[] default '{}';
