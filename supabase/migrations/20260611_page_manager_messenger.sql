create schema if not exists ads_launcher;
set search_path = ads_launcher, public;

create table if not exists page_conversations (
  id                   uuid        default gen_random_uuid() primary key,
  org_id               uuid        not null,
  page_id              text        not null,
  page_name            text,
  customer_psid        text        not null,
  customer_name        text,
  customer_profile_pic text,
  source               text        not null default 'messenger' check (source in ('messenger')),
  status               text        not null default 'open' check (status in ('open', 'pending', 'replied', 'closed', 'archived')),
  assigned_to          text,
  unread_count         integer     not null default 0,
  last_message         text,
  last_message_at      timestamptz,
  last_inbound_at      timestamptz,
  last_outbound_at     timestamptz,
  metadata             jsonb       not null default '{}'::jsonb,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  unique (org_id, page_id, customer_psid)
);

create index if not exists idx_page_conversations_org_page
  on page_conversations(org_id, page_id, last_message_at desc nulls last);
create index if not exists idx_page_conversations_customer
  on page_conversations(org_id, customer_psid);

create table if not exists page_messages (
  id              uuid        default gen_random_uuid() primary key,
  org_id          uuid        not null,
  conversation_id uuid        not null references page_conversations(id) on delete cascade,
  page_id         text        not null,
  customer_psid   text        not null,
  fb_message_id   text,
  direction       text        not null check (direction in ('inbound', 'outbound')),
  message_type    text        not null default 'text' check (message_type in ('text', 'postback', 'attachment', 'unknown')),
  message         text,
  attachments     jsonb       not null default '[]'::jsonb,
  raw_event       jsonb       not null default '{}'::jsonb,
  fb_created_time timestamptz,
  created_at      timestamptz default now()
);

create unique index if not exists idx_page_messages_fb_mid
  on page_messages(org_id, fb_message_id)
  where fb_message_id is not null;
create index if not exists idx_page_messages_conversation
  on page_messages(conversation_id, fb_created_time asc nulls last, created_at asc);
create index if not exists idx_page_messages_page
  on page_messages(org_id, page_id, fb_created_time desc nulls last);

drop trigger if exists update_page_conversations_updated_at on page_conversations;
create trigger update_page_conversations_updated_at
  before update on page_conversations
  for each row execute function update_updated_at_column();

alter table page_conversations enable row level security;
alter table page_messages enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'is_org_member'
      and n.nspname = current_schema()
  ) then
    execute 'drop policy if exists "Org members can view page conversations" on page_conversations';
    execute 'create policy "Org members can view page conversations" on page_conversations for select using (is_org_member(org_id))';
    execute 'drop policy if exists "Org members can insert page conversations" on page_conversations';
    execute 'create policy "Org members can insert page conversations" on page_conversations for insert with check (is_org_member(org_id))';
    execute 'drop policy if exists "Org members can update page conversations" on page_conversations';
    execute 'create policy "Org members can update page conversations" on page_conversations for update using (is_org_member(org_id))';

    execute 'drop policy if exists "Org members can view page messages" on page_messages';
    execute 'create policy "Org members can view page messages" on page_messages for select using (is_org_member(org_id))';
    execute 'drop policy if exists "Org members can insert page messages" on page_messages';
    execute 'create policy "Org members can insert page messages" on page_messages for insert with check (is_org_member(org_id))';
  end if;
end $$;
