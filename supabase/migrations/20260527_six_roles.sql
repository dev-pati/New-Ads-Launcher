-- Expand org_role ENUM to 6 roles
ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'launcher';
ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'uploader';
ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'analyst';
ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'commenter';

-- New permission helper functions
CREATE OR REPLACE FUNCTION can_edit_ads(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = check_org_id AND user_id = auth.uid() AND role IN ('admin', 'editor', 'launcher')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_delete_ads(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = check_org_id AND user_id = auth.uid() AND role IN ('admin', 'editor')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_upload_media(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = check_org_id AND user_id = auth.uid() AND role IN ('admin', 'editor', 'launcher', 'uploader')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION can_write_comments(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = check_org_id AND user_id = auth.uid() AND role IN ('admin', 'editor', 'launcher', 'uploader', 'commenter')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- CREATIVES
DROP POLICY IF EXISTS "Org members can insert creatives" ON creatives;
DROP POLICY IF EXISTS "Org members can update creatives" ON creatives;
DROP POLICY IF EXISTS "Org admins can delete creatives"  ON creatives;
CREATE POLICY "Can edit creatives insert" ON creatives FOR INSERT WITH CHECK (can_edit_ads(org_id));
CREATE POLICY "Can edit creatives update" ON creatives FOR UPDATE USING (can_edit_ads(org_id));
CREATE POLICY "Can delete creatives"      ON creatives FOR DELETE USING (can_delete_ads(org_id));

-- ADS
DROP POLICY IF EXISTS "Org members can insert ads" ON ads;
DROP POLICY IF EXISTS "Org members can update ads" ON ads;
DROP POLICY IF EXISTS "Org admins can delete ads"  ON ads;
CREATE POLICY "Can edit ads insert" ON ads FOR INSERT WITH CHECK (can_edit_ads(org_id));
CREATE POLICY "Can edit ads update" ON ads FOR UPDATE USING (can_edit_ads(org_id));
CREATE POLICY "Can delete ads"      ON ads FOR DELETE USING (can_delete_ads(org_id));

-- AD MEDIA
DROP POLICY IF EXISTS "Org members can insert ad media" ON ad_media;
DROP POLICY IF EXISTS "Org admins can delete ad media"  ON ad_media;
CREATE POLICY "Can upload ad media" ON ad_media FOR INSERT WITH CHECK (can_upload_media(org_id));
CREATE POLICY "Can delete ad media" ON ad_media FOR DELETE USING (can_delete_ads(org_id));

-- AD SET PRESETS
DROP POLICY IF EXISTS "Org members can manage presets" ON ad_set_presets;
CREATE POLICY "Can edit ad set presets" ON ad_set_presets FOR ALL USING (can_edit_ads(org_id));

-- LAUNCH BATCHES
DROP POLICY IF EXISTS "Org members can manage launch batches" ON launch_batches;
CREATE POLICY "Can edit launch batches" ON launch_batches FOR ALL USING (can_edit_ads(org_id));

-- LAUNCH DRAFTS
DROP POLICY IF EXISTS "org members can manage launch drafts" ON launch_drafts;
CREATE POLICY "Can edit launch drafts" ON launch_drafts FOR ALL USING (can_edit_ads(org_id));

-- SCHEDULED ACTIVATIONS
DROP POLICY IF EXISTS "Org members can select scheduled activations" ON scheduled_activations;
DROP POLICY IF EXISTS "Org members can insert scheduled activations" ON scheduled_activations;
DROP POLICY IF EXISTS "Org members can update scheduled activations" ON scheduled_activations;
DROP POLICY IF EXISTS "Org members can delete scheduled activations" ON scheduled_activations;
CREATE POLICY "Can edit scheduled activations" ON scheduled_activations FOR ALL USING (can_edit_ads(org_id));

-- AD COPY TEMPLATES
DROP POLICY IF EXISTS "Org members can manage ad copy templates" ON ad_copy_templates;
CREATE POLICY "Can edit ad copy templates" ON ad_copy_templates FOR ALL USING (can_edit_ads(org_id));

-- ASSET BOARDS
DROP POLICY IF EXISTS "Org members can insert asset boards" ON asset_boards;
DROP POLICY IF EXISTS "Org members can update asset boards" ON asset_boards;
DROP POLICY IF EXISTS "Org admins can delete asset boards"  ON asset_boards;
CREATE POLICY "Can edit asset boards insert" ON asset_boards FOR INSERT WITH CHECK (can_upload_media(org_id));
CREATE POLICY "Can edit asset boards update" ON asset_boards FOR UPDATE USING (can_upload_media(org_id));
CREATE POLICY "Can delete asset boards"      ON asset_boards FOR DELETE USING (can_delete_ads(org_id));

-- BOARD ASSETS
DROP POLICY IF EXISTS "Org members can manage board assets" ON board_assets;
CREATE POLICY "Can manage board assets" ON board_assets FOR ALL
  USING (board_id IN (SELECT id FROM asset_boards WHERE can_upload_media(org_id)));

-- CREATIVE REQUESTS
DROP POLICY IF EXISTS "Org members can insert creative requests" ON creative_requests;
DROP POLICY IF EXISTS "Org members can update creative requests" ON creative_requests;
DROP POLICY IF EXISTS "Org admins can delete creative requests"  ON creative_requests;
CREATE POLICY "Can upload creative requests insert" ON creative_requests FOR INSERT WITH CHECK (can_upload_media(org_id));
CREATE POLICY "Can upload creative requests update" ON creative_requests FOR UPDATE USING (can_upload_media(org_id));
CREATE POLICY "Can delete creative requests"        ON creative_requests FOR DELETE USING (can_delete_ads(org_id));

-- COMMENTS
DROP POLICY IF EXISTS "Org members can insert comments" ON comments;
DROP POLICY IF EXISTS "Org members can update comments" ON comments;
DROP POLICY IF EXISTS "Org members can delete comments" ON comments;
CREATE POLICY "Can write comments insert" ON comments FOR INSERT WITH CHECK (can_write_comments(org_id));
CREATE POLICY "Can write comments update" ON comments FOR UPDATE USING (can_write_comments(org_id));
CREATE POLICY "Can write comments delete" ON comments FOR DELETE USING (can_write_comments(org_id));

-- COMMENT AUTOMATIONS
DROP POLICY IF EXISTS "Org members can insert comment automations" ON comment_automations;
DROP POLICY IF EXISTS "Org members can update comment automations" ON comment_automations;
DROP POLICY IF EXISTS "Org members can delete comment automations" ON comment_automations;
CREATE POLICY "Can write comment automations insert" ON comment_automations FOR INSERT WITH CHECK (can_write_comments(org_id));
CREATE POLICY "Can write comment automations update" ON comment_automations FOR UPDATE USING (can_write_comments(org_id));
CREATE POLICY "Can write comment automations delete" ON comment_automations FOR DELETE USING (can_write_comments(org_id));

-- AUTOMATION RUNS
DROP POLICY IF EXISTS "Org members can insert automation runs" ON automation_runs;
CREATE POLICY "Can write automation runs" ON automation_runs FOR INSERT WITH CHECK (can_edit_ads(org_id));

-- AUTOMATIONS
DROP POLICY IF EXISTS "Org members can manage automations"           ON automations;
DROP POLICY IF EXISTS "Org members can manage automation executions" ON automation_executions;
DROP POLICY IF EXISTS "Org members can manage automation approvals"  ON automation_approvals;
DROP POLICY IF EXISTS "Org members can manage budget schedules"      ON budget_schedules;
CREATE POLICY "Can edit automations"           ON automations           FOR ALL USING (can_edit_ads(org_id));
CREATE POLICY "Can edit automation executions" ON automation_executions FOR ALL USING (can_edit_ads(org_id));
CREATE POLICY "Can edit automation approvals"  ON automation_approvals  FOR ALL USING (can_edit_ads(org_id));
CREATE POLICY "Can edit budget schedules"      ON budget_schedules      FOR ALL USING (can_edit_ads(org_id));

-- NAMING SCHEMAS
DROP POLICY IF EXISTS "Org members can insert naming schema" ON naming_schemas;
DROP POLICY IF EXISTS "Org members can update naming schema" ON naming_schemas;
CREATE POLICY "Can edit naming schema insert" ON naming_schemas FOR INSERT WITH CHECK (can_edit_ads(org_id));
CREATE POLICY "Can edit naming schema update" ON naming_schemas FOR UPDATE USING (can_edit_ads(org_id));
