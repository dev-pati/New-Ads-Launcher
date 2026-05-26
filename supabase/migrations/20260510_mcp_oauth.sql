-- MCP OAuth 2.1 tables

-- Authorization codes (short-lived, 10 min)
CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256',
  org_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'ads:read ads:write',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Access tokens (30 days)
CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text NOT NULL UNIQUE,
  client_id text NOT NULL,
  org_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'ads:read ads:write',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- OAuth clients (dynamic registration, RFC 7591)
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  client_id text PRIMARY KEY,
  client_name text,
  redirect_uris text[] NOT NULL,
  created_at timestamptz DEFAULT now()
);
