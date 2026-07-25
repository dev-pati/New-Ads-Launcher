alter table launch_batches add column if not exists deleted_at timestamptz;
alter table launch_batches add column if not exists expires_at timestamptz;
create index if not exists launch_batches_deleted_at_idx on launch_batches (deleted_at) where deleted_at is not null;
