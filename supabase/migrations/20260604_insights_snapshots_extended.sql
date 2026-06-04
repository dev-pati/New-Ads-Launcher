-- Extended snapshot tables for full Meta Ads Manager coverage
-- ad_insights_snapshots: per-ad daily metrics
-- insights_breakdown_snapshots: demographic/country/device breakdowns
-- page_insights_snapshots: Facebook Page metrics

-- ============================================================
-- 1. AD-LEVEL SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS ad_insights_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fb_ad_account_id TEXT NOT NULL,
  fb_campaign_id TEXT NOT NULL,
  fb_adset_id TEXT NOT NULL,
  fb_ad_id TEXT NOT NULL,
  campaign_name TEXT,
  adset_name TEXT,
  ad_name TEXT,
  date DATE NOT NULL,
  -- Core metrics
  spend NUMERIC DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  frequency NUMERIC,
  -- Conversions
  purchases INT DEFAULT 0,
  purchase_value NUMERIC DEFAULT 0,
  leads INT DEFAULT 0,
  add_to_carts INT DEFAULT 0,
  -- Calculated
  roas NUMERIC,
  cpa NUMERIC,
  ctr NUMERIC,
  cpm NUMERIC,
  cpc NUMERIC,
  -- Video
  video_views_3s BIGINT DEFAULT 0,
  video_views_thruplay BIGINT DEFAULT 0,
  video_avg_watch_pct NUMERIC,
  -- Status
  ad_status TEXT,
  effective_status TEXT,
  -- Raw
  raw_insights JSONB,
  snapped_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_insights_unique
  ON ad_insights_snapshots(org_id, fb_ad_id, date);
CREATE INDEX IF NOT EXISTS idx_ad_insights_org_date
  ON ad_insights_snapshots(org_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_insights_campaign
  ON ad_insights_snapshots(org_id, fb_campaign_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_insights_account
  ON ad_insights_snapshots(org_id, fb_ad_account_id, date DESC);

ALTER TABLE ad_insights_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view ad snapshots"   ON ad_insights_snapshots FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert ad snapshots" ON ad_insights_snapshots FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update ad snapshots" ON ad_insights_snapshots FOR UPDATE USING (is_org_member(org_id));

-- ============================================================
-- 2. BREAKDOWN SNAPSHOTS (demographic / country / device)
-- ============================================================
CREATE TABLE IF NOT EXISTS insights_breakdown_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fb_ad_account_id TEXT NOT NULL,
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  breakdown_type TEXT NOT NULL, -- 'age', 'gender', 'country', 'device', 'publisher_platform'
  breakdown_value TEXT NOT NULL, -- e.g. '18-24', 'male', 'VN', 'mobile_app'
  -- Metrics
  spend NUMERIC DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  reach BIGINT DEFAULT 0,
  purchases INT DEFAULT 0,
  purchase_value NUMERIC DEFAULT 0,
  leads INT DEFAULT 0,
  roas NUMERIC,
  ctr NUMERIC,
  cpm NUMERIC,
  cpc NUMERIC,
  cpa NUMERIC,
  raw_data JSONB,
  snapped_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_breakdown_unique
  ON insights_breakdown_snapshots(org_id, fb_ad_account_id, date_start, date_end, breakdown_type, breakdown_value);
CREATE INDEX IF NOT EXISTS idx_breakdown_org_type
  ON insights_breakdown_snapshots(org_id, fb_ad_account_id, breakdown_type, date_start DESC);

ALTER TABLE insights_breakdown_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view breakdown snapshots"   ON insights_breakdown_snapshots FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert breakdown snapshots" ON insights_breakdown_snapshots FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update breakdown snapshots" ON insights_breakdown_snapshots FOR UPDATE USING (is_org_member(org_id));

-- ============================================================
-- 3. PAGE INSIGHTS SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS page_insights_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fb_page_id TEXT NOT NULL,
  page_name TEXT,
  date DATE NOT NULL,
  -- Audience
  fans BIGINT DEFAULT 0,
  new_fans INT DEFAULT 0,
  -- Reach & Impressions
  reach BIGINT DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  organic_reach BIGINT DEFAULT 0,
  paid_reach BIGINT DEFAULT 0,
  -- Engagement
  engaged_users BIGINT DEFAULT 0,
  post_engagements BIGINT DEFAULT 0,
  reactions INT DEFAULT 0,
  comments INT DEFAULT 0,
  shares INT DEFAULT 0,
  -- Views
  page_views INT DEFAULT 0,
  -- Raw
  raw_insights JSONB,
  snapped_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_page_insights_unique
  ON page_insights_snapshots(org_id, fb_page_id, date);
CREATE INDEX IF NOT EXISTS idx_page_insights_org_date
  ON page_insights_snapshots(org_id, date DESC);

ALTER TABLE page_insights_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view page snapshots"   ON page_insights_snapshots FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert page snapshots" ON page_insights_snapshots FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update page snapshots" ON page_insights_snapshots FOR UPDATE USING (is_org_member(org_id));

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ad_insights_snapshots TO service_role, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE insights_breakdown_snapshots TO service_role, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE page_insights_snapshots TO service_role, authenticated;
GRANT SELECT ON TABLE ad_insights_snapshots TO anon;
GRANT SELECT ON TABLE insights_breakdown_snapshots TO anon;
GRANT SELECT ON TABLE page_insights_snapshots TO anon;
