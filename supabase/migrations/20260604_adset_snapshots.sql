  SET search_path TO ads_launcher, public;

  -- Adset-level snapshots (for Spend breakdown page)
  CREATE TABLE IF NOT EXISTS adset_insights_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES ads_launcher.organizations(id) ON DELETE CASCADE,
    fb_ad_account_id TEXT NOT NULL,
    fb_campaign_id TEXT NOT NULL,
    fb_adset_id TEXT NOT NULL,
    campaign_name TEXT,
    adset_name TEXT,
    date DATE NOT NULL,
    spend NUMERIC DEFAULT 0,
    impressions BIGINT DEFAULT 0,
    clicks BIGINT DEFAULT 0,
    reach BIGINT DEFAULT 0,
    purchases INT DEFAULT 0,
    purchase_value NUMERIC DEFAULT 0,
    leads INT DEFAULT 0,
    roas NUMERIC,
    cpa NUMERIC,
    ctr NUMERIC,
    cpm NUMERIC,
    cpc NUMERIC,
    raw_insights JSONB,
    snapped_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_adset_insights_unique
    ON adset_insights_snapshots(org_id, fb_adset_id, date);
  CREATE INDEX IF NOT EXISTS idx_adset_insights_campaign
    ON adset_insights_snapshots(org_id, fb_campaign_id, date DESC);
  CREATE INDEX IF NOT EXISTS idx_adset_insights_account
    ON adset_insights_snapshots(org_id, fb_ad_account_id, date DESC);

  ALTER TABLE adset_insights_snapshots ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Org members can view adset snapshots"   ON adset_insights_snapshots FOR SELECT USING (is_org_member(org_id));
  CREATE POLICY "Org members can insert adset snapshots" ON adset_insights_snapshots FOR INSERT WITH CHECK (is_org_member(org_id));
  CREATE POLICY "Org members can update adset snapshots" ON adset_insights_snapshots FOR UPDATE USING (is_org_member(org_id));

  -- Add thumbnail_url to ad_insights_snapshots if not exists
  ALTER TABLE ad_insights_snapshots ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE adset_insights_snapshots TO service_role, authenticated;
  GRANT SELECT ON TABLE adset_insights_snapshots TO anon;
