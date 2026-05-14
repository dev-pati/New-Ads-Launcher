import { readFileSync, writeFileSync } from "node:fs";

const input = readFileSync("supabase/schema.sql", "utf8");

const start = input.indexOf("-- ============================================================\n-- 0. ENUMS");
if (start < 0) throw new Error("Could not find schema start");

let body = input.slice(start);

// Remove Supabase Auth trigger bootstrap. Accounts are backfilled from auth.users
// once, then managed by the custom auth implementation.
body = body.replace(
  /CREATE OR REPLACE FUNCTION handle_new_user\(\)[\s\S]*?CREATE TRIGGER on_auth_user_created[\s\S]*?FOR EACH ROW EXECUTE FUNCTION handle_new_user\(\);\n\n/,
  ""
);

// Remove Storage and Realtime blocks; Storage is provisioned at stack level and
// Realtime is not part of the custom-auth migration.
body = body.replace(/\n-- ============================================================\n-- STORAGE: ad-media bucket[\s\S]*$/m, "\n");

body = body
  .replaceAll("REFERENCES auth.users(id)", "REFERENCES accounts(id)")
  .replaceAll("REFERENCES auth.users(id) ON DELETE CASCADE", "REFERENCES accounts(id) ON DELETE CASCADE")
  .replaceAll("auth.uid()", "current_account_id()")
  .replaceAll("DROP FUNCTION IF EXISTS handle_new_user CASCADE;\n", "")
  .replaceAll("DROP FUNCTION IF EXISTS update_naming_schemas_updated_at CASCADE;\n", "");

const accounts = `-- ============================================================
-- ADLAUNCHER SELF-HOSTED SCHEMA
-- Generated from supabase/schema.sql.
-- Target schema: ads_launcher.
-- Supabase Auth dependency is replaced by ads_launcher.accounts.
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS ads_launcher;
GRANT USAGE ON SCHEMA ads_launcher TO anon, authenticated, service_role;

SET search_path TO ads_launcher, public, auth, storage, extensions;

-- ============================================================
-- DROP EXISTING (ads_launcher only)
-- ============================================================

DROP TABLE IF EXISTS ads_launcher.inspo_board_saves CASCADE;
DROP TABLE IF EXISTS ads_launcher.inspo_boards CASCADE;
DROP TABLE IF EXISTS ads_launcher.naming_schemas CASCADE;
DROP TABLE IF EXISTS ads_launcher.notifications CASCADE;
DROP TABLE IF EXISTS ads_launcher.org_ai_keys CASCADE;
DROP TABLE IF EXISTS ads_launcher.inspo_saved_ads CASCADE;
DROP TABLE IF EXISTS ads_launcher.mcp_oauth_clients CASCADE;
DROP TABLE IF EXISTS ads_launcher.mcp_oauth_tokens CASCADE;
DROP TABLE IF EXISTS ads_launcher.mcp_oauth_codes CASCADE;
DROP TABLE IF EXISTS ads_launcher.mcp_api_keys CASCADE;
DROP TABLE IF EXISTS ads_launcher.budget_schedules CASCADE;
DROP TABLE IF EXISTS ads_launcher.automation_approvals CASCADE;
DROP TABLE IF EXISTS ads_launcher.automation_executions CASCADE;
DROP TABLE IF EXISTS ads_launcher.automations CASCADE;
DROP TABLE IF EXISTS ads_launcher.automation_runs CASCADE;
DROP TABLE IF EXISTS ads_launcher.comment_automations CASCADE;
DROP TABLE IF EXISTS ads_launcher.comments CASCADE;
DROP TABLE IF EXISTS ads_launcher.board_assets CASCADE;
DROP TABLE IF EXISTS ads_launcher.asset_boards CASCADE;
DROP TABLE IF EXISTS ads_launcher.creative_requests CASCADE;
DROP TABLE IF EXISTS ads_launcher.ad_copy_templates CASCADE;
DROP TABLE IF EXISTS ads_launcher.scheduled_activations CASCADE;
DROP TABLE IF EXISTS ads_launcher.launch_batches CASCADE;
DROP TABLE IF EXISTS ads_launcher.ad_set_presets CASCADE;
DROP TABLE IF EXISTS ads_launcher.user_settings CASCADE;
DROP TABLE IF EXISTS ads_launcher.ad_media CASCADE;
DROP TABLE IF EXISTS ads_launcher.ads CASCADE;
DROP TABLE IF EXISTS ads_launcher.creatives CASCADE;
DROP TABLE IF EXISTS ads_launcher.pages CASCADE;
DROP TABLE IF EXISTS ads_launcher.ad_accounts CASCADE;
DROP TABLE IF EXISTS ads_launcher.selected_pages CASCADE;
DROP TABLE IF EXISTS ads_launcher.page_links CASCADE;
DROP TABLE IF EXISTS ads_launcher.business_managers CASCADE;
DROP TABLE IF EXISTS ads_launcher.facebook_connections CASCADE;
DROP TABLE IF EXISTS ads_launcher.org_invitations CASCADE;
DROP TABLE IF EXISTS ads_launcher.org_members CASCADE;
DROP TABLE IF EXISTS ads_launcher.organizations CASCADE;
DROP TABLE IF EXISTS ads_launcher.profiles CASCADE;
DROP TABLE IF EXISTS ads_launcher.accounts CASCADE;

DROP TYPE IF EXISTS ads_launcher.ad_status CASCADE;
DROP TYPE IF EXISTS ads_launcher.ad_cta CASCADE;
DROP TYPE IF EXISTS ads_launcher.media_type CASCADE;
DROP TYPE IF EXISTS ads_launcher.budget_type CASCADE;
DROP TYPE IF EXISTS ads_launcher.gender_targeting CASCADE;
DROP TYPE IF EXISTS ads_launcher.org_role CASCADE;

DROP FUNCTION IF EXISTS ads_launcher.update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS ads_launcher.current_account_id CASCADE;
DROP FUNCTION IF EXISTS ads_launcher.is_org_member CASCADE;
DROP FUNCTION IF EXISTS ads_launcher.is_org_admin CASCADE;

-- ============================================================
-- CUSTOM AUTH ACCOUNTS
-- ============================================================

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  encrypted_password TEXT,
  full_name TEXT,
  avatar_url TEXT,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_confirmed_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX accounts_email_idx ON accounts (lower(email));

CREATE OR REPLACE FUNCTION current_account_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claim.sub', true),
      current_setting('request.jwt.claims', true)::jsonb->>'sub'
    ),
    ''
  )::uuid;
$$;

`;

let output = accounts + body;
output += `
GRANT USAGE ON SCHEMA ads_launcher TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ads_launcher TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ads_launcher TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ads_launcher TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ads_launcher TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
`;

writeFileSync("supabase/schema.ads_launcher.sql", output);
console.log("wrote supabase/schema.ads_launcher.sql");
