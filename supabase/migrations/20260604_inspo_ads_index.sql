SET search_path TO ads_launcher, public;

-- Indexed ads from Meta Ad Library for Inspo browse feature
CREATE TABLE IF NOT EXISTS inspo_ads_index (
  id TEXT PRIMARY KEY,                          -- ad_archive_id from Meta
  org_context TEXT DEFAULT 'global',            -- 'global' for crawled, org_id for saved
  page_id TEXT,
  page_name TEXT NOT NULL DEFAULT '',
  brand_avatar TEXT,
  primary_text TEXT,
  headline TEXT,
  description TEXT,
  cta TEXT,
  ad_snapshot_url TEXT,
  media_url TEXT,
  media_type TEXT DEFAULT 'image',             -- 'image' | 'video'
  display_format TEXT,                         -- 'single_image' | 'video' | 'carousel'
  publisher_platforms TEXT[] DEFAULT '{}',     -- ['facebook','instagram',...]
  languages TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active',                -- 'active' | 'inactive'
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  running_days INT,
  views_upper INT,                             -- impressions upper bound
  spend_upper INT,                             -- spend upper bound (USD cents)
  country TEXT DEFAULT 'US',
  -- AI tags (Phase 2 - nullable for now)
  emotion TEXT,
  theme TEXT,
  usp TEXT,
  ad_angle TEXT,
  desire TEXT,
  categories TEXT[] DEFAULT '{}',
  -- Meta
  indexed_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspo_status     ON inspo_ads_index(status, indexed_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspo_media_type ON inspo_ads_index(media_type, status);
CREATE INDEX IF NOT EXISTS idx_inspo_country    ON inspo_ads_index(country, status);
CREATE INDEX IF NOT EXISTS idx_inspo_platforms  ON inspo_ads_index USING gin(publisher_platforms);
CREATE INDEX IF NOT EXISTS idx_inspo_page       ON inspo_ads_index(page_name, status);
CREATE INDEX IF NOT EXISTS idx_inspo_views      ON inspo_ads_index(views_upper DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_inspo_indexed_at ON inspo_ads_index(indexed_at DESC);

-- Full text search on ad content
CREATE INDEX IF NOT EXISTS idx_inspo_fts ON inspo_ads_index
  USING gin(to_tsvector('english', coalesce(primary_text,'') || ' ' || coalesce(headline,'') || ' ' || coalesce(page_name,'')));

-- No RLS needed — global public data, read by service_role
ALTER TABLE inspo_ads_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read inspo index" ON inspo_ads_index FOR SELECT USING (true);
CREATE POLICY "Service role can write inspo index" ON inspo_ads_index FOR ALL USING (true);

GRANT SELECT ON TABLE inspo_ads_index TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE inspo_ads_index TO service_role;
