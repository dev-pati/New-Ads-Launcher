SET search_path TO ads_launcher, public;

-- Add missing metric columns to snapshot tables

-- campaign_insights_snapshots
ALTER TABLE campaign_insights_snapshots
  ADD COLUMN IF NOT EXISTS frequency         NUMERIC,
  ADD COLUMN IF NOT EXISTS outbound_clicks   BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inline_link_clicks BIGINT DEFAULT 0;

-- adset_insights_snapshots
ALTER TABLE adset_insights_snapshots
  ADD COLUMN IF NOT EXISTS frequency         NUMERIC,
  ADD COLUMN IF NOT EXISTS outbound_clicks   BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inline_link_clicks BIGINT DEFAULT 0;

-- ad_insights_snapshots
ALTER TABLE ad_insights_snapshots
  ADD COLUMN IF NOT EXISTS outbound_clicks        BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inline_link_clicks     BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inline_link_click_ctr  NUMERIC,
  ADD COLUMN IF NOT EXISTS video_p25_watched      BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_p50_watched      BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_p75_watched      BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_p95_watched      BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_p100_watched     BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_30s_watched      BIGINT DEFAULT 0;
