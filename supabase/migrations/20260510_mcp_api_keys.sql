-- MCP API Keys table
CREATE TABLE IF NOT EXISTS mcp_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  api_key text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'Default',
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE mcp_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage their keys"
  ON mcp_api_keys
  FOR ALL
  USING (is_org_member(org_id));
