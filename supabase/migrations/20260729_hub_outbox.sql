-- set search path to app schema
set search_path = ads_launcher, public;

alter table ads_launcher.feedback_events add column if not exists hub_short_id text;

create table if not exists ads_launcher.feedback_hub_outbox (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references ads_launcher.feedback_events(id),
  idempotency_key text not null unique,
  payload jsonb not null,
  status text not null default 'queued',
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  hub_short_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_hub_outbox_due_idx
  on ads_launcher.feedback_hub_outbox (status, next_attempt_at);

create index if not exists feedback_hub_outbox_feedback_id_idx
  on ads_launcher.feedback_hub_outbox (feedback_id);

alter table ads_launcher.feedback_hub_outbox enable row level security;
