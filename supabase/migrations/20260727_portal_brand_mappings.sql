-- 20260727_portal_brand_mappings.sql
-- Store mapping from Creative Portal brand folder -> AdLauncher org/ad_account
-- Applied manually via Supabase dashboard (migrations disabled in config)
-- IMPORTANT: qualify ads_launcher schema — AdLauncher owns only this schema.

CREATE TABLE IF NOT EXISTS ads_launcher.portal_brand_mappings (
  brand_slug TEXT PRIMARY KEY,
  org_id UUID REFERENCES ads_launcher.organizations(id) ON DELETE CASCADE,
  ad_account_id TEXT,
  mapped_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'mapped')),
  sample_asset_id TEXT,
  sample_object_key TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status = 'pending' OR (org_id IS NOT NULL AND ad_account_id IS NOT NULL AND mapped_by IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_portal_brand_mappings_org_status ON ads_launcher.portal_brand_mappings(org_id, status);
CREATE INDEX IF NOT EXISTS idx_portal_brand_mappings_status_last_seen ON ads_launcher.portal_brand_mappings(status, last_seen_at DESC);

-- Enable RLS
ALTER TABLE ads_launcher.portal_brand_mappings ENABLE ROW LEVEL SECURITY;

-- is_org_member lives in ads_launcher schema — qualify to avoid lookup ambiguity
DROP POLICY IF EXISTS "View portal brand mappings" ON ads_launcher.portal_brand_mappings;
CREATE POLICY "View portal brand mappings" ON ads_launcher.portal_brand_mappings
  FOR SELECT
  USING (
    org_id IS NULL OR ads_launcher.is_org_member(org_id)
  );

-- No INSERT/UPDATE/DELETE policies — mutations are strictly handled via admin API (createAdminClient)
