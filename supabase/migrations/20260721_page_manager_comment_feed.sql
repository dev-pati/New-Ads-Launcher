-- Realtime comment inbox: allow facebook_comment source on page_conversations/page_messages
create schema if not exists ads_launcher;
set search_path = ads_launcher, public;

-- 1. Allow comment origin on conversations.
alter table page_conversations
  drop constraint if exists page_conversations_source_check;
alter table page_conversations
  add constraint page_conversations_source_check
  check (source in ('messenger', 'facebook_comment'));

-- 2. Stable synthetic customer ref so a comment thread is unique per (page, post, commenter)
alter table page_conversations
  alter column customer_psid drop not null;

-- 3. Carry comment origin metadata on the conversation.
alter table page_conversations
  add column if not exists fb_post_id text,
  add column if not exists fb_comment_id text,
  add column if not exists source_meta jsonb not null default '{}'::jsonb,
  add column if not exists needs_human boolean not null default false;

-- Drop old unique if present so we can split messenger vs comment uniqueness.
alter table page_conversations
  drop constraint if exists page_conversations_org_id_page_id_customer_psid_key;

create unique index if not exists idx_page_conversations_messenger_unique
  on page_conversations(org_id, page_id, customer_psid)
  where source = 'messenger' and customer_psid is not null;

create unique index if not exists idx_page_conversations_comment_unique
  on page_conversations(org_id, page_id, fb_post_id, customer_psid)
  where source = 'facebook_comment' and fb_post_id is not null and customer_psid is not null;

create index if not exists idx_page_conversations_comment
  on page_conversations(org_id, source, last_message_at desc nulls last);

create index if not exists idx_page_conversations_needs_human
  on page_conversations(org_id, page_id, needs_human, last_message_at desc)
  where needs_human = true;

-- 4. Allow comment as a message type for unified page_messages.
alter table page_messages
  drop constraint if exists page_messages_message_type_check;
alter table page_messages
  add constraint page_messages_message_type_check
  check (message_type in ('text', 'postback', 'attachment', 'unknown', 'comment'));

alter table page_messages
  add column if not exists fb_comment_id text;

create unique index if not exists idx_page_messages_fb_comment_id
  on page_messages(org_id, fb_comment_id)
  where fb_comment_id is not null;
