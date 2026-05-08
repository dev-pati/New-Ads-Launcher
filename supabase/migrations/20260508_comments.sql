-- Comments: store FB ad comments with AI sentiment
create table if not exists comments (
  id                uuid        default gen_random_uuid() primary key,
  org_id            uuid        not null references organizations(id) on delete cascade,
  fb_comment_id     text        not null,
  fb_post_id        text,
  fb_post_message   text,
  page_id           text        not null,
  page_name         text,
  message           text        not null,
  from_name         text,
  from_id           text,
  sentiment         text        default 'neutral' check (sentiment in ('positive','neutral','negative')),
  sentiment_score   float       default 0,
  themes            text[]      default '{}',
  like_count        int         default 0,
  comment_count     int         default 0,
  is_hidden         boolean     default false,
  is_replied        boolean     default false,
  draft_reply       text,
  fb_created_time   timestamptz,
  synced_at         timestamptz default now(),
  created_at        timestamptz default now(),
  unique (org_id, fb_comment_id)
);
create index if not exists idx_comments_org       on comments(org_id);
create index if not exists idx_comments_sentiment on comments(org_id, sentiment);
create index if not exists idx_comments_page      on comments(org_id, page_id);
create index if not exists idx_comments_created   on comments(org_id, fb_created_time desc);

-- Comment automation rules
create table if not exists comment_automations (
  id            uuid    default gen_random_uuid() primary key,
  org_id        uuid    not null references organizations(id) on delete cascade,
  name          text    not null,
  description   text,
  trigger_type  text    not null,
  trigger_value text,
  action_type   text    not null,
  action_value  text,
  is_active     boolean default true,
  template_name text,
  run_count     int     default 0,
  created_at    timestamptz default now()
);
create index if not exists idx_comment_automations_org on comment_automations(org_id);

-- Automation execution history
create table if not exists automation_runs (
  id              uuid default gen_random_uuid() primary key,
  org_id          uuid not null references organizations(id) on delete cascade,
  automation_id   uuid references comment_automations(id) on delete set null,
  comment_id      uuid references comments(id) on delete set null,
  automation_name text,
  trigger_matched text,
  action_taken    text,
  result          text,
  status          text default 'success' check (status in ('success','failed','skipped')),
  run_at          timestamptz default now()
);
create index if not exists idx_automation_runs_org        on automation_runs(org_id);
create index if not exists idx_automation_runs_automation on automation_runs(automation_id);

-- RLS
alter table comments            enable row level security;
alter table comment_automations enable row level security;
alter table automation_runs     enable row level security;

create policy "Org members can view comments"       on comments            for select using (is_org_member(org_id));
create policy "Org members can insert comments"     on comments            for insert with check (is_org_member(org_id));
create policy "Org members can update comments"     on comments            for update using (is_org_member(org_id));
create policy "Org members can delete comments"     on comments            for delete using (is_org_member(org_id));

create policy "Org members can view automations"    on comment_automations for select using (is_org_member(org_id));
create policy "Org members can insert automations"  on comment_automations for insert with check (is_org_member(org_id));
create policy "Org members can update automations"  on comment_automations for update using (is_org_member(org_id));
create policy "Org members can delete automations"  on comment_automations for delete using (is_org_member(org_id));

create policy "Org members can view runs"           on automation_runs     for select using (is_org_member(org_id));
create policy "Org members can insert runs"         on automation_runs     for insert with check (is_org_member(org_id));
