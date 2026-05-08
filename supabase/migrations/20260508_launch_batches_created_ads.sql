alter table launch_batches
  add column if not exists created_ads jsonb not null default '[]';
