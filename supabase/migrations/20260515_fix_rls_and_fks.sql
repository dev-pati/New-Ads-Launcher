-- Harden early custom-auth migrations.
-- This file intentionally avoids Supabase Auth tables. The app stores users in
-- ads_launcher.accounts and resolves membership through is_org_member().

-- ============================================================
-- RLS policy cleanup
-- ============================================================

DROP POLICY IF EXISTS "org members can manage presets" ON ad_set_presets;
CREATE POLICY "org members can manage presets"
  ON ad_set_presets FOR ALL
  USING (is_org_member(org_id));

DROP POLICY IF EXISTS "org members can manage launch batches" ON launch_batches;
CREATE POLICY "org members can manage launch batches"
  ON launch_batches FOR ALL
  USING (is_org_member(org_id));

DROP POLICY IF EXISTS "org members can read scheduled activations" ON scheduled_activations;
DROP POLICY IF EXISTS "org members can select scheduled activations" ON scheduled_activations;
DROP POLICY IF EXISTS "org members can insert scheduled activations" ON scheduled_activations;
DROP POLICY IF EXISTS "org members can update scheduled activations" ON scheduled_activations;
DROP POLICY IF EXISTS "org members can delete scheduled activations" ON scheduled_activations;
DROP POLICY IF EXISTS "org members can manage scheduled activations" ON scheduled_activations;
CREATE POLICY "org members can manage scheduled activations"
  ON scheduled_activations FOR ALL
  USING (is_org_member(org_id));

DROP POLICY IF EXISTS "org members can manage ad copy templates" ON ad_copy_templates;
CREATE POLICY "org members can manage ad copy templates"
  ON ad_copy_templates FOR ALL
  USING (is_org_member(org_id));

DROP POLICY IF EXISTS "org members can manage board assets" ON board_assets;
CREATE POLICY "org members can manage board assets"
  ON board_assets FOR ALL
  USING (board_id IN (SELECT id FROM asset_boards WHERE is_org_member(org_id)));

-- ============================================================
-- Missing foreign keys from early migrations
-- ============================================================

DO $$
BEGIN
  IF to_regclass('ad_set_presets') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_ad_set_presets_org'
         AND conrelid = 'ad_set_presets'::regclass
     ) THEN
    ALTER TABLE ad_set_presets
      ADD CONSTRAINT fk_ad_set_presets_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('launch_batches') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_launch_batches_org'
         AND conrelid = 'launch_batches'::regclass
     ) THEN
    ALTER TABLE launch_batches
      ADD CONSTRAINT fk_launch_batches_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('launch_batches') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_launch_batches_user'
         AND conrelid = 'launch_batches'::regclass
     ) THEN
    ALTER TABLE launch_batches
      ADD CONSTRAINT fk_launch_batches_user
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('scheduled_activations') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_scheduled_activations_org'
         AND conrelid = 'scheduled_activations'::regclass
     ) THEN
    ALTER TABLE scheduled_activations
      ADD CONSTRAINT fk_scheduled_activations_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('ad_copy_templates') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_ad_copy_templates_org'
         AND conrelid = 'ad_copy_templates'::regclass
     ) THEN
    ALTER TABLE ad_copy_templates
      ADD CONSTRAINT fk_ad_copy_templates_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('ad_copy_templates') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_ad_copy_templates_user'
         AND conrelid = 'ad_copy_templates'::regclass
     ) THEN
    ALTER TABLE ad_copy_templates
      ADD CONSTRAINT fk_ad_copy_templates_user
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('notifications') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_notifications_org'
         AND conrelid = 'notifications'::regclass
     ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT fk_notifications_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('notifications') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_notifications_user'
         AND conrelid = 'notifications'::regclass
     ) THEN
    ALTER TABLE notifications
      ADD CONSTRAINT fk_notifications_user
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('mcp_api_keys') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_mcp_api_keys_org'
         AND conrelid = 'mcp_api_keys'::regclass
     ) THEN
    ALTER TABLE mcp_api_keys
      ADD CONSTRAINT fk_mcp_api_keys_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('mcp_api_keys') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_mcp_api_keys_user'
         AND conrelid = 'mcp_api_keys'::regclass
     ) THEN
    ALTER TABLE mcp_api_keys
      ADD CONSTRAINT fk_mcp_api_keys_user
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('mcp_oauth_codes') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_mcp_oauth_codes_org'
         AND conrelid = 'mcp_oauth_codes'::regclass
     ) THEN
    ALTER TABLE mcp_oauth_codes
      ADD CONSTRAINT fk_mcp_oauth_codes_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('mcp_oauth_codes') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_mcp_oauth_codes_user'
         AND conrelid = 'mcp_oauth_codes'::regclass
     ) THEN
    ALTER TABLE mcp_oauth_codes
      ADD CONSTRAINT fk_mcp_oauth_codes_user
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('mcp_oauth_tokens') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_mcp_oauth_tokens_org'
         AND conrelid = 'mcp_oauth_tokens'::regclass
     ) THEN
    ALTER TABLE mcp_oauth_tokens
      ADD CONSTRAINT fk_mcp_oauth_tokens_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('mcp_oauth_tokens') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_mcp_oauth_tokens_user'
         AND conrelid = 'mcp_oauth_tokens'::regclass
     ) THEN
    ALTER TABLE mcp_oauth_tokens
      ADD CONSTRAINT fk_mcp_oauth_tokens_user
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('inspo_board_saves') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_inspo_board_saves_org'
         AND conrelid = 'inspo_board_saves'::regclass
     ) THEN
    ALTER TABLE inspo_board_saves
      ADD CONSTRAINT fk_inspo_board_saves_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE board_assets ENABLE ROW LEVEL SECURITY;
