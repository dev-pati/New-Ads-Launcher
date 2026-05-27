-- Fix missing table-level grants for ad_account_metrics_snapshots.
-- service_role bypasses RLS but still needs explicit GRANT to access the table.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ad_account_metrics_snapshots TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ad_account_metrics_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ad_account_metrics_snapshots TO authenticated;
GRANT SELECT                         ON TABLE ad_account_metrics_snapshots TO anon;

-- Also ensure ad_accounts columns added in 20260527_ad_account_metrics.sql are accessible.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ad_accounts TO service_role;
