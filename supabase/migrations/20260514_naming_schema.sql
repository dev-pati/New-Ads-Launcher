-- Stores the AI naming schema (categories + options) per org.
-- One row per org; upsert on PUT.
CREATE TABLE IF NOT EXISTS naming_schemas (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  categories jsonb       NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (org_id)
);

ALTER TABLE naming_schemas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read naming schema"
  ON naming_schemas FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "org members can insert naming schema"
  ON naming_schemas FOR INSERT
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "org members can update naming schema"
  ON naming_schemas FOR UPDATE
  USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

CREATE OR REPLACE FUNCTION update_naming_schemas_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER naming_schemas_updated_at
  BEFORE UPDATE ON naming_schemas
  FOR EACH ROW EXECUTE FUNCTION update_naming_schemas_updated_at();
