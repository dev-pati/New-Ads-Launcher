-- 20260806_portal_media_items_metadata.sql
-- Add metadata columns to portal_media_items to preserve Portal lineage after import
-- (creative_storage_catalog view only exposes 'available' assets, so metadata is lost live)

ALTER TABLE ads_launcher.portal_media_items
  ADD COLUMN IF NOT EXISTS brand_id TEXT,
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS width INT,
  ADD COLUMN IF NOT EXISTS height INT,
  ADD COLUMN IF NOT EXISTS duration_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS pdp_url TEXT,
  ADD COLUMN IF NOT EXISTS sales_page_url TEXT,
  ADD COLUMN IF NOT EXISTS landing_url TEXT,
  ADD COLUMN IF NOT EXISTS checkout_funnel_url TEXT,
  ADD COLUMN IF NOT EXISTS brief_type TEXT,
  ADD COLUMN IF NOT EXISTS voice_variant TEXT;
