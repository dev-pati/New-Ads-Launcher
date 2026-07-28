-- 20260728_portal_media_items.sql
-- Store per-media sync state from Creative Portal to allow individual mapping
-- Applied manually via Supabase dashboard

CREATE TABLE IF NOT EXISTS ads_launcher.portal_media_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  portal_asset_id TEXT NOT NULL,
  brand_slug TEXT,
  file_name TEXT,
  media_type TEXT,
  mime_type TEXT,
  file_size INT,
  org_id UUID REFERENCES ads_launcher.organizations(id) ON DELETE CASCADE,
  ad_account_id TEXT,
  mapped_by UUID,
  creative_id UUID REFERENCES ads_launcher.creatives(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'mapped', 'imported')),
  portal_created_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Existing installs may have created mapped_by -> auth.users. AdLauncher production uses custom accounts, so drop it.
ALTER TABLE ads_launcher.portal_media_items DROP CONSTRAINT IF EXISTS portal_media_items_mapped_by_fkey;

CREATE INDEX IF NOT EXISTS idx_portal_media_items_org_status ON ads_launcher.portal_media_items(org_id, status);
CREATE INDEX IF NOT EXISTS idx_portal_media_items_status_first_seen ON ads_launcher.portal_media_items(status, first_seen_at DESC);

-- Enable RLS
ALTER TABLE ads_launcher.portal_media_items ENABLE ROW LEVEL SECURITY;

-- Select policy: users can read pending rows (org_id is null) or rows belonging to their org
DROP POLICY IF EXISTS "View portal media items" ON ads_launcher.portal_media_items;
CREATE POLICY "View portal media items" ON ads_launcher.portal_media_items
  FOR SELECT
  USING (
    org_id IS NULL OR ads_launcher.is_org_member(org_id)
  );

-- No INSERT/UPDATE/DELETE policies — mutations handled via admin API (createAdminClient)
