ALTER TABLE ad_accounts
  ADD COLUMN IF NOT EXISTS amount_spent_minor NUMERIC,
  ADD COLUMN IF NOT EXISTS balance_minor NUMERIC,
  ADD COLUMN IF NOT EXISTS spend_cap_minor NUMERIC,
  ADD COLUMN IF NOT EXISTS remaining_minor NUMERIC,
  ADD COLUMN IF NOT EXISTS timezone_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_business_id TEXT,
  ADD COLUMN IF NOT EXISTS owner_business_name TEXT,
  ADD COLUMN IF NOT EXISTS ownership TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS raw_meta JSONB;

CREATE TABLE IF NOT EXISTS ad_account_metrics_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fb_ad_account_id TEXT NOT NULL,
  fb_account_id TEXT NOT NULL,
  name TEXT,
  account_status INT,
  currency TEXT DEFAULT 'USD',
  timezone_name TEXT,
  amount_spent_minor NUMERIC,
  balance_minor NUMERIC,
  spend_cap_minor NUMERIC,
  remaining_minor NUMERIC,
  owner_business_id TEXT,
  owner_business_name TEXT,
  ownership TEXT DEFAULT 'unknown',
  raw_meta JSONB,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_account_metrics_snapshots_org
  ON ad_account_metrics_snapshots(org_id, synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_account_metrics_snapshots_account
  ON ad_account_metrics_snapshots(org_id, fb_ad_account_id, synced_at DESC);

ALTER TABLE ad_account_metrics_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view ad account metric snapshots" ON ad_account_metrics_snapshots;
DROP POLICY IF EXISTS "Org members can insert ad account metric snapshots" ON ad_account_metrics_snapshots;
DROP POLICY IF EXISTS "Org admins can delete ad account metric snapshots" ON ad_account_metrics_snapshots;

CREATE POLICY "Org members can view ad account metric snapshots"
  ON ad_account_metrics_snapshots FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "Org members can insert ad account metric snapshots"
  ON ad_account_metrics_snapshots FOR INSERT WITH CHECK (is_org_member(org_id));

CREATE POLICY "Org admins can delete ad account metric snapshots"
  ON ad_account_metrics_snapshots FOR DELETE USING (is_org_admin(org_id));
