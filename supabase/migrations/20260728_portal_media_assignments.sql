-- 20260728_portal_media_assignments.sql
-- Portal Media v2: many-to-many assignment of a Portal-approved asset to ad accounts.
-- Replaces the one-asset-one-account model of portal_media_items (which is NOT dropped
-- here — see TD-33, a second deploy after backfill verification).
-- Applied manually via Supabase dashboard.

CREATE TABLE IF NOT EXISTS ads_launcher.portal_media_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  object_key TEXT NOT NULL,
  portal_asset_id TEXT NOT NULL,
  org_id UUID NOT NULL REFERENCES ads_launcher.organizations(id) ON DELETE CASCADE,
  -- Facebook ad account id string, matching creatives.ad_account_id and
  -- ad_accounts.fb_ad_account_id. Not a uuid FK.
  ad_account_id TEXT NOT NULL,
  creative_id UUID REFERENCES ads_launcher.creatives(id) ON DELETE SET NULL,
  assigned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (object_key, org_id, ad_account_id)
);

-- AdLauncher production uses custom accounts, not auth.users. Never add an FK on assigned_by.
ALTER TABLE ads_launcher.portal_media_assignments
  DROP CONSTRAINT IF EXISTS portal_media_assignments_assigned_by_fkey;

CREATE INDEX IF NOT EXISTS idx_portal_media_assignments_org
  ON ads_launcher.portal_media_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_portal_media_assignments_key
  ON ads_launcher.portal_media_assignments(object_key);
CREATE INDEX IF NOT EXISTS idx_portal_media_assignments_creative
  ON ads_launcher.portal_media_assignments(creative_id);

ALTER TABLE ads_launcher.portal_media_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View portal media assignments" ON ads_launcher.portal_media_assignments;
CREATE POLICY "View portal media assignments" ON ads_launcher.portal_media_assignments
  FOR SELECT
  USING (ads_launcher.is_org_member(org_id));

-- No INSERT/UPDATE/DELETE policies — mutations handled via admin API (createAdminClient).

-- Backfill: carry v1's imported rows across so nothing already claimed is lost.
INSERT INTO ads_launcher.portal_media_assignments
  (object_key, portal_asset_id, org_id, ad_account_id, creative_id, assigned_by, created_at)
SELECT i.object_key, i.portal_asset_id, i.org_id, i.ad_account_id, i.creative_id, i.mapped_by, i.created_at
FROM ads_launcher.portal_media_items i
WHERE i.status = 'imported'
  AND i.org_id IS NOT NULL
  AND i.ad_account_id IS NOT NULL
ON CONFLICT (object_key, org_id, ad_account_id) DO NOTHING;
