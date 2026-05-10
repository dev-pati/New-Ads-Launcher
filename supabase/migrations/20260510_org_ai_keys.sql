CREATE TABLE IF NOT EXISTS org_ai_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  gemini_api_key text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE org_ai_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage ai keys"
  ON org_ai_keys FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
