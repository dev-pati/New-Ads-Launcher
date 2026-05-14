-- Fix RLS policies: replace current_setting('app.active_org_id') with is_org_member()
-- Fix missing FK constraints added by earlier migrations
-- These tables were created without proper org FK or with non-standard RLS patterns.

-- ============================================================
-- 1. AD SET PRESETS — fix RLS + add FK
-- ============================================================

DROP POLICY IF EXISTS "org members can manage presets" ON ad_set_presets;

ALTER TABLE ad_set_presets
  ADD CONSTRAINT IF NOT EXISTS fk_ad_set_presets_org
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

CREATE POLICY "org members can manage presets"
  ON ad_set_presets FOR ALL
  USING (is_org_member(org_id));

-- ============================================================
-- 2. LAUNCH BATCHES — fix RLS + add FK
-- ============================================================

DROP POLICY IF EXISTS "org members can manage launch batches" ON launch_batches;

ALTER TABLE launch_batches
  ADD CONSTRAINT IF NOT EXISTS fk_launch_batches_org
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE launch_batches
  ADD CONSTRAINT IF NOT EXISTS fk_launch_batches_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "org members can manage launch batches"
  ON launch_batches FOR ALL
  USING (is_org_member(org_id));

-- ============================================================
-- 3. SCHEDULED ACTIVATIONS — fix RLS + add FK
-- ============================================================

DROP POLICY IF EXISTS "org members can read scheduled activations" ON scheduled_activations;

ALTER TABLE scheduled_activations
  ADD CONSTRAINT IF NOT EXISTS fk_scheduled_activations_org
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

CREATE POLICY "org members can select scheduled activations"
  ON scheduled_activations FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "org members can insert scheduled activations"
  ON scheduled_activations FOR INSERT WITH CHECK (is_org_member(org_id));

CREATE POLICY "org members can update scheduled activations"
  ON scheduled_activations FOR UPDATE USING (is_org_member(org_id));

CREATE POLICY "org members can delete scheduled activations"
  ON scheduled_activations FOR DELETE USING (is_org_member(org_id));

-- ============================================================
-- 4. AD COPY TEMPLATES — fix RLS + add FK
-- ============================================================

DROP POLICY IF EXISTS "org members can manage ad copy templates" ON ad_copy_templates;

ALTER TABLE ad_copy_templates
  ADD CONSTRAINT IF NOT EXISTS fk_ad_copy_templates_org
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

CREATE POLICY "org members can manage ad copy templates"
  ON ad_copy_templates FOR ALL
  USING (is_org_member(org_id));

-- ============================================================
-- 5. NOTIFICATIONS — add FK (was missing)
-- ============================================================

ALTER TABLE notifications
  ADD CONSTRAINT IF NOT EXISTS fk_notifications_org
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE notifications
  ADD CONSTRAINT IF NOT EXISTS fk_notifications_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- 6. MCP API KEYS — add FK (was missing)
-- ============================================================

ALTER TABLE mcp_api_keys
  ADD CONSTRAINT IF NOT EXISTS fk_mcp_api_keys_org
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================================
-- 7. MCP OAUTH — add FK (was missing)
-- ============================================================

ALTER TABLE mcp_oauth_codes
  ADD CONSTRAINT IF NOT EXISTS fk_mcp_oauth_codes_org
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE mcp_oauth_tokens
  ADD CONSTRAINT IF NOT EXISTS fk_mcp_oauth_tokens_org
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================================
-- 8. INSPO BOARD SAVES — add FK on org_id (was missing)
-- ============================================================

ALTER TABLE inspo_board_saves
  ADD CONSTRAINT IF NOT EXISTS fk_inspo_board_saves_org
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- ============================================================
-- 9. BOARD ASSETS — add RLS (was missing)
-- ============================================================

ALTER TABLE board_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "org members can manage board assets"
  ON board_assets FOR ALL
  USING (board_id IN (SELECT id FROM asset_boards WHERE is_org_member(org_id)));
