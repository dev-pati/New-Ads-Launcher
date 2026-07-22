-- Page Manager Ops: comment classification columns + Knowledge Base + scheduled posts.
-- Purely additive. No existing columns touched.
create schema if not exists ads_launcher;
set search_path = ads_launcher, public;

-- 1. Comment classification (PRD Comment-Ops FR-CO-2): intent, risk, assignee, phone flag, needs-human.
alter table comments
  add column if not exists intent        text,
  add column if not exists risk_level    text check (risk_level in ('low', 'medium', 'high')),
  add column if not exists assigned_to   text,
  add column if not exists needs_human   boolean not null default false,
  add column if not exists has_phone     boolean not null default false;

create index if not exists idx_comments_unreplied
  on comments(org_id, page_id, is_replied, fb_created_time desc)
  where is_replied = false;

create index if not exists idx_comments_needs_human
  on comments(org_id, page_id, fb_created_time desc)
  where needs_human = true;

create index if not exists idx_comments_intent
  on comments(org_id, page_id, intent)
  where intent is not null;

-- 2. Knowledge Base / FAQ grounding (PRD Inbox-Ops FR-IO-4, shared with Comment/Posts).
create table if not exists page_knowledge (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  page_id      text,                       -- null = org-wide, else page-specific override
  question     text not null,
  answer       text not null,
  tags         text[] not null default '{}',
  category     text,                       -- faq | policy | product_note | needs_answer
  status       text not null default 'active' check (status in ('active','draft','needs_answer')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_page_knowledge_lookup
  on page_knowledge(org_id, page_id, status);

create index if not exists idx_page_knowledge_tags
  on page_knowledge using gin (tags);

alter table page_knowledge enable row level security;

-- 3. Scheduled Page posts (PRD Content-Ops FR-PO-6): status + due index mirror scheduled_activations.
create table if not exists scheduled_page_posts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  page_id       text not null,
  message       text,
  image_url     text,
  scheduled_at  timestamptz not null,
  fb_post_id    text,
  status        text not null default 'pending' check (status in ('pending','published','failed','cancelled')),
  error         text,
  created_at    timestamptz not null default now(),
  published_at  timestamptz
);

create index if not exists idx_scheduled_page_posts_due
  on scheduled_page_posts(org_id, status, scheduled_at)
  where status = 'pending';

create index if not exists idx_scheduled_page_posts_page
  on scheduled_page_posts(org_id, page_id, scheduled_at desc);

alter table scheduled_page_posts enable row level security;
