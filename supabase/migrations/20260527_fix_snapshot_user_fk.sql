-- Fix user_id FK: app uses custom auth (accounts table), not Supabase auth.users.
-- The original migration incorrectly referenced auth.users(id), causing every
-- INSERT to fail silently with a FK violation.

ALTER TABLE ad_account_metrics_snapshots
  DROP CONSTRAINT IF EXISTS ad_account_metrics_snapshots_user_id_fkey;

ALTER TABLE ad_account_metrics_snapshots
  ADD CONSTRAINT ad_account_metrics_snapshots_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE;
