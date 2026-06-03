-- Daily campaign performance snapshots
-- Stored in DB so data is accessible even when Meta account is locked/banned

CREATE TABLE IF NOT EXISTS campaign_insights_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fb_ad_account_id TEXT NOT NULL,
  fb_campaign_id TEXT NOT NULL,
  campaign_name TEXT,
  date DATE NOT NULL,
  -- Core metrics
  spend NUMERIC DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  -- Conversion metrics
  purchases INT DEFAULT 0,
  purchase_value NUMERIC DEFAULT 0,
  leads INT DEFAULT 0,
  add_to_carts INT DEFAULT 0,
  -- Calculated metrics (stored for offline access)
  roas NUMERIC,
  cpa NUMERIC,
  ctr NUMERIC,
  cpm NUMERIC,
  cpc NUMERIC,
  -- Status at time of snapshot
  campaign_status TEXT,
  effective_status TEXT,
  -- Raw data for extensibility
  raw_insights JSONB,
  snapped_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_insights_unique
  ON campaign_insights_snapshots(org_id, fb_campaign_id, date);

CREATE INDEX IF NOT EXISTS idx_campaign_insights_org_date
  ON campaign_insights_snapshots(org_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_insights_account
  ON campaign_insights_snapshots(org_id, fb_ad_account_id, date DESC);

ALTER TABLE campaign_insights_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view campaign snapshots"
  ON campaign_insights_snapshots FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "Org members can insert campaign snapshots"
  ON campaign_insights_snapshots FOR INSERT WITH CHECK (is_org_member(org_id));

CREATE POLICY "Org members can update campaign snapshots"
  ON campaign_insights_snapshots FOR UPDATE USING (is_org_member(org_id));
