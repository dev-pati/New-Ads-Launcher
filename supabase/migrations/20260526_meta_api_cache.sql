-- Persist Meta API metadata in Postgres to reduce repeat Graph API calls.
-- Server-side routes use the service-role client for writes; users can only
-- read rows that belong to organizations they are members of.

CREATE TABLE IF NOT EXISTS meta_api_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  payload jsonb,
  expires_at timestamptz NOT NULL DEFAULT now(),
  retry_after timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (org_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_meta_api_cache_org_key
  ON meta_api_cache(org_id, cache_key);

CREATE INDEX IF NOT EXISTS idx_meta_api_cache_expires_at
  ON meta_api_cache(expires_at);

ALTER TABLE meta_api_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can read meta api cache" ON meta_api_cache;
CREATE POLICY "org members can read meta api cache"
  ON meta_api_cache FOR SELECT
  USING (is_org_member(org_id));
