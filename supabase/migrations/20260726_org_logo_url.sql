-- ============================================================
-- Add logo_url to organizations + seed Launch Ads
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Rename "Launch App" -> "Launch Ads" and attach pug logo
UPDATE organizations
SET name = 'Launch Ads',
    slug = 'launch-ads',
    logo_url = '/launchads.png',
    updated_at = now()
WHERE name ILIKE 'Launch App';
