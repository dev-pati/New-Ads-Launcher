-- ============================================================
-- Auto Launch Ads - Complete Database Schema
-- Includes all migrations through 20260514
-- Run this for a fresh install; migrations handle incremental updates.
-- ============================================================

SET search_path TO ads_launcher, auth, extensions, public;

-- ============================================================
-- DROP EXISTING (order matters due to foreign keys)
-- ============================================================

DROP TABLE IF EXISTS inspo_board_saves CASCADE;
DROP TABLE IF EXISTS inspo_boards CASCADE;
DROP TABLE IF EXISTS naming_schemas CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS org_ai_keys CASCADE;
DROP TABLE IF EXISTS inspo_saved_ads CASCADE;
DROP TABLE IF EXISTS mcp_oauth_clients CASCADE;
DROP TABLE IF EXISTS mcp_oauth_tokens CASCADE;
DROP TABLE IF EXISTS mcp_oauth_codes CASCADE;
DROP TABLE IF EXISTS mcp_api_keys CASCADE;
DROP TABLE IF EXISTS budget_schedules CASCADE;
DROP TABLE IF EXISTS automation_approvals CASCADE;
DROP TABLE IF EXISTS automation_executions CASCADE;
DROP TABLE IF EXISTS automations CASCADE;
DROP TABLE IF EXISTS automation_runs CASCADE;
DROP TABLE IF EXISTS comment_automations CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS board_assets CASCADE;
DROP TABLE IF EXISTS asset_boards CASCADE;
DROP TABLE IF EXISTS creative_requests CASCADE;
DROP TABLE IF EXISTS ad_copy_templates CASCADE;
DROP TABLE IF EXISTS scheduled_activations CASCADE;
DROP TABLE IF EXISTS launch_batches CASCADE;
DROP TABLE IF EXISTS ad_set_presets CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS ad_media CASCADE;
DROP TABLE IF EXISTS ads CASCADE;
DROP TABLE IF EXISTS creatives CASCADE;
DROP TABLE IF EXISTS pages CASCADE;
DROP TABLE IF EXISTS ad_accounts CASCADE;
DROP TABLE IF EXISTS selected_pages CASCADE;
DROP TABLE IF EXISTS page_links CASCADE;
DROP TABLE IF EXISTS business_managers CASCADE;
DROP TABLE IF EXISTS facebook_connections CASCADE;
DROP TABLE IF EXISTS org_invitations CASCADE;
DROP TABLE IF EXISTS org_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP TYPE IF EXISTS ad_status CASCADE;
DROP TYPE IF EXISTS ad_cta CASCADE;
DROP TYPE IF EXISTS media_type CASCADE;
DROP TYPE IF EXISTS budget_type CASCADE;
DROP TYPE IF EXISTS gender_targeting CASCADE;
DROP TYPE IF EXISTS org_role CASCADE;

DROP FUNCTION IF EXISTS handle_new_user CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS update_naming_schemas_updated_at CASCADE;
DROP FUNCTION IF EXISTS is_org_member CASCADE;
DROP FUNCTION IF EXISTS is_org_admin CASCADE;

-- ============================================================
-- 0. ENUMS
-- ============================================================

CREATE TYPE org_role AS ENUM ('admin', 'editor');

CREATE TYPE ad_status AS ENUM (
  'draft', 'ready', 'launching', 'launched', 'paused', 'failed', 'archived'
);

CREATE TYPE ad_cta AS ENUM (
  'BOOK_NOW', 'CONTACT_US', 'DOWNLOAD', 'GET_OFFER', 'GET_QUOTE',
  'GET_SHOWTIMES', 'LEARN_MORE', 'LISTEN_NOW', 'MESSAGE_PAGE', 'NO_BUTTON',
  'OPEN_LINK', 'ORDER_NOW', 'PLAY_GAME', 'SEND_MESSAGE', 'SHOP_NOW',
  'SIGN_UP', 'SUBSCRIBE', 'WATCH_MORE', 'WHATSAPP_MESSAGE', 'BOOK_TRAVEL',
  'BUY_NOW', 'CALL_NOW', 'APPLY_NOW', 'BUY_TICKETS', 'GET_DIRECTIONS',
  'INSTALL_APP', 'SEND_WHATSAPP_MESSAGE', 'SEE_DETAILS', 'SEE_MENU',
  'REQUEST_TIME', 'USE_APP', 'SAVE'
);

CREATE TYPE media_type AS ENUM ('image', 'video');
CREATE TYPE budget_type AS ENUM ('daily', 'lifetime');
CREATE TYPE gender_targeting AS ENUM ('all', 'male', 'female');

-- ============================================================
-- SHARED TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. ORGANIZATIONS
-- ============================================================

CREATE TABLE organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. ORG MEMBERS
-- ============================================================

CREATE TABLE org_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'editor',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_org ON org_members(org_id);

-- ============================================================
-- 4. ORG INVITATIONS
-- ============================================================

CREATE TABLE org_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role org_role NOT NULL DEFAULT 'editor',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token UUID DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, email)
);

-- ============================================================
-- 5. RLS HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION is_org_member(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = check_org_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_org_admin(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = check_org_id AND user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- 6. FACEBOOK CONNECTIONS
-- ============================================================

CREATE TABLE facebook_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fb_user_id TEXT NOT NULL,
  fb_user_name TEXT,
  fb_email TEXT,
  fb_picture_url TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, fb_user_id)
);

CREATE INDEX idx_facebook_connections_org ON facebook_connections(org_id);

-- ============================================================
-- 7. BUSINESS MANAGERS
-- ============================================================

CREATE TABLE business_managers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facebook_connection_id UUID NOT NULL REFERENCES facebook_connections(id) ON DELETE CASCADE,
  fb_business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, fb_business_id)
);

CREATE INDEX idx_business_managers_org ON business_managers(org_id);

-- ============================================================
-- 8. PAGES
-- ============================================================

CREATE TABLE pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_manager_id UUID NOT NULL REFERENCES business_managers(id) ON DELETE CASCADE,
  fb_page_id TEXT NOT NULL,
  name TEXT,
  category TEXT,
  picture_url TEXT,
  page_access_token TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, fb_page_id)
);

CREATE INDEX idx_pages_org ON pages(org_id);

-- ============================================================
-- 9. AD ACCOUNTS
-- ============================================================

CREATE TABLE ad_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_manager_id UUID NOT NULL REFERENCES business_managers(id) ON DELETE CASCADE,
  fb_ad_account_id TEXT NOT NULL,
  fb_account_id TEXT NOT NULL,
  name TEXT,
  currency TEXT DEFAULT 'USD',
  account_status INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, fb_ad_account_id)
);

CREATE INDEX idx_ad_accounts_org ON ad_accounts(org_id);

-- ============================================================
-- 10. PAGE LINKS
-- ============================================================

CREATE TABLE page_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_page_links_org ON page_links(org_id);

-- ============================================================
-- 11. CREATIVES
-- ============================================================

CREATE TABLE creatives (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT,
  media_type media_type NOT NULL,
  file_size INT,
  ad_account_id TEXT,

  campaign_name TEXT,
  adset_name TEXT,

  headline TEXT,
  primary_text TEXT,
  description TEXT,
  cta ad_cta DEFAULT 'LEARN_MORE',
  link_url TEXT,

  fb_image_hash TEXT,
  fb_image_url TEXT,
  fb_thumbnail_url TEXT,
  fb_video_id TEXT,

  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'ready',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_creatives_org ON creatives(org_id);
CREATE INDEX creatives_ad_account_id_idx ON creatives(ad_account_id);

-- ============================================================
-- 12. ADS
-- ============================================================

CREATE TABLE ads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE RESTRICT,
  ad_account_id UUID NOT NULL REFERENCES ad_accounts(id) ON DELETE RESTRICT,

  name TEXT NOT NULL,
  caption TEXT,
  headline TEXT,
  description TEXT,
  link_url TEXT,
  cta ad_cta DEFAULT 'LEARN_MORE',

  target_age_min INT DEFAULT 18 CHECK (target_age_min >= 13 AND target_age_min <= 65),
  target_age_max INT DEFAULT 65 CHECK (target_age_max >= 13 AND target_age_max <= 65),
  target_gender gender_targeting DEFAULT 'all',
  target_locations JSONB DEFAULT '[]'::jsonb,
  target_interests JSONB DEFAULT '[]'::jsonb,

  budget_type budget_type DEFAULT 'daily',
  budget_amount DECIMAL(12,2),
  schedule_start TIMESTAMPTZ,
  schedule_end TIMESTAMPTZ,

  status ad_status DEFAULT 'draft',
  fb_campaign_id TEXT,
  fb_adset_id TEXT,
  fb_ad_id TEXT,
  launched_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_age_range CHECK (target_age_min <= target_age_max),
  CONSTRAINT valid_schedule CHECK (schedule_end IS NULL OR schedule_end > schedule_start)
);

CREATE INDEX idx_ads_org ON ads(org_id);

-- ============================================================
-- 13. AD MEDIA
-- ============================================================

CREATE TABLE ad_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type media_type NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  file_name TEXT,
  file_size INT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (ad_id, sort_order)
);

CREATE INDEX idx_ad_media_ad ON ad_media(ad_id);

-- ============================================================
-- 14. USER SETTINGS
-- ============================================================

CREATE TABLE user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'system',
  ads_filter JSONB DEFAULT '{}'::jsonb,
  ads_column_widths JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX idx_user_settings_user ON user_settings(user_id);

-- ============================================================
-- 15. AD SET PRESETS
-- ============================================================

CREATE TABLE ad_set_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  special_ad_categories JSONB DEFAULT '[]',
  targeting JSONB DEFAULT '{}',
  optimization_goal TEXT,
  billing_event TEXT,
  bid_strategy TEXT,
  bid_amount TEXT,
  adset_name TEXT,
  campaign_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ad_set_presets_org ON ad_set_presets(org_id);

-- ============================================================
-- 16. LAUNCH BATCHES
-- ============================================================

CREATE TABLE launch_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  ad_account_id TEXT NOT NULL,
  ad_account_name TEXT,
  adset_ids TEXT[] NOT NULL DEFAULT '{}',
  adset_names TEXT[] NOT NULL DEFAULT '{}',
  creative_ids TEXT[] NOT NULL DEFAULT '{}',
  creative_thumbs TEXT[] NOT NULL DEFAULT '{}',
  primary_text TEXT,
  headline TEXT,
  cta TEXT,
  web_link TEXT,
  page_id TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  total_ads INTEGER NOT NULL DEFAULT 0,
  failed_ads INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  errors JSONB DEFAULT '[]',
  created_ads JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX launch_batches_org_id_idx ON launch_batches(org_id, created_at DESC);

-- ============================================================
-- 17. SCHEDULED ACTIVATIONS
-- ============================================================

CREATE TABLE scheduled_activations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  ad_ids TEXT[] NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','activated','paused','cancelled','failed')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX scheduled_activations_pending_idx
  ON scheduled_activations(status, scheduled_at)
  WHERE status = 'pending';

CREATE INDEX scheduled_activations_activated_idx
  ON scheduled_activations(status, end_time)
  WHERE status = 'activated';

-- ============================================================
-- 18. AD COPY TEMPLATES
-- ============================================================

CREATE TABLE ad_copy_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  primary_text TEXT,
  headline TEXT,
  description TEXT,
  link TEXT,
  cta TEXT DEFAULT 'SHOP_NOW',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ad_copy_templates_org_account_idx
  ON ad_copy_templates(org_id, ad_account_id, created_at DESC);

-- ============================================================
-- 19. ASSET BOARDS & CREATIVE REQUESTS
-- ============================================================

CREATE TABLE asset_boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_asset_boards_org ON asset_boards(org_id);

CREATE TABLE board_assets (
  board_id UUID NOT NULL REFERENCES asset_boards(id) ON DELETE CASCADE,
  creative_id UUID NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (board_id, creative_id)
);

CREATE INDEX idx_board_assets_board ON board_assets(board_id);
CREATE INDEX idx_board_assets_creative ON board_assets(creative_id);

CREATE TABLE creative_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open','in_progress','completed','cancelled')),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_creative_requests_org ON creative_requests(org_id);

-- ============================================================
-- 20. COMMENTS & COMMENT AUTOMATIONS
-- ============================================================

CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fb_comment_id TEXT NOT NULL,
  fb_post_id TEXT,
  fb_post_message TEXT,
  page_id TEXT NOT NULL,
  page_name TEXT,
  message TEXT NOT NULL,
  from_name TEXT,
  from_id TEXT,
  sentiment TEXT DEFAULT 'neutral'
    CHECK (sentiment IN ('positive','neutral','negative')),
  sentiment_score FLOAT DEFAULT 0,
  themes TEXT[] DEFAULT '{}',
  like_count INT DEFAULT 0,
  comment_count INT DEFAULT 0,
  is_hidden BOOLEAN DEFAULT false,
  is_replied BOOLEAN DEFAULT false,
  draft_reply TEXT,
  fb_created_time TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, fb_comment_id)
);

CREATE INDEX idx_comments_org ON comments(org_id);
CREATE INDEX idx_comments_sentiment ON comments(org_id, sentiment);
CREATE INDEX idx_comments_page ON comments(org_id, page_id);
CREATE INDEX idx_comments_created ON comments(org_id, fb_created_time DESC);

CREATE TABLE comment_automations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_value TEXT,
  action_type TEXT NOT NULL,
  action_value TEXT,
  is_active BOOLEAN DEFAULT true,
  template_name TEXT,
  run_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comment_automations_org ON comment_automations(org_id);

CREATE TABLE automation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  automation_id UUID REFERENCES comment_automations(id) ON DELETE SET NULL,
  comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
  automation_name TEXT,
  trigger_matched TEXT,
  action_taken TEXT,
  result TEXT,
  status TEXT DEFAULT 'success'
    CHECK (status IN ('success','failed','skipped')),
  run_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_automation_runs_org ON automation_runs(org_id);
CREATE INDEX idx_automation_runs_automation ON automation_runs(automation_id);

-- ============================================================
-- 21. AUTOMATIONS (rule-based ad management engine)
-- ============================================================

CREATE TABLE automations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','draft')),
  trigger_type TEXT NOT NULL DEFAULT 'metric_threshold',
  trigger_config JSONB NOT NULL DEFAULT '{}',
  conditions JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  ad_account_ids TEXT[] NOT NULL DEFAULT '{}',
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  template_id TEXT,
  run_count INT NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE automation_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  automation_id UUID REFERENCES automations(id) ON DELETE SET NULL,
  automation_name TEXT,
  status TEXT NOT NULL DEFAULT 'success'
    CHECK (status IN ('success','failed','pending','skipped')),
  entities_affected INT NOT NULL DEFAULT 0,
  api_calls INT NOT NULL DEFAULT 0,
  action_taken TEXT,
  ad_account_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE automation_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  automation_id UUID REFERENCES automations(id) ON DELETE SET NULL,
  execution_id UUID REFERENCES automation_executions(id) ON DELETE SET NULL,
  automation_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  requested_action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE budget_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  adset_id TEXT NOT NULL,
  adset_name TEXT,
  rule_name TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'absolute'
    CHECK (change_type IN ('absolute','percentage_increase','percentage_decrease')),
  new_budget NUMERIC,
  percentage NUMERIC,
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','executed','failed','cancelled')),
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX automations_org_id_idx ON automations(org_id);
CREATE INDEX automations_status_idx ON automations(org_id, status);
CREATE INDEX automation_executions_org_idx ON automation_executions(org_id);
CREATE INDEX automation_executions_automation_idx ON automation_executions(automation_id);
CREATE INDEX automation_approvals_org_idx ON automation_approvals(org_id);
CREATE INDEX automation_approvals_status_idx ON automation_approvals(org_id, status);
CREATE INDEX budget_schedules_org_idx ON budget_schedules(org_id);
CREATE INDEX budget_schedules_scheduled_idx ON budget_schedules(scheduled_at) WHERE status = 'active';

-- ============================================================
-- 22. MCP API KEYS & OAUTH 2.1
-- ============================================================

CREATE TABLE mcp_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Default',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mcp_oauth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'ads:read ads:write',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mcp_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'ads:read ads:write',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE mcp_oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_name TEXT,
  redirect_uris TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 23. INSPO SAVED ADS
-- ============================================================

CREATE TABLE inspo_saved_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_archive_id TEXT NOT NULL,
  page_name TEXT NOT NULL,
  page_id TEXT,
  ad_body TEXT,
  ad_title TEXT,
  ad_snapshot_url TEXT,
  ad_delivery_start_time TEXT,
  publisher_platforms TEXT[] DEFAULT '{}',
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, ad_archive_id)
);

-- ============================================================
-- 24. ORG AI KEYS
-- ============================================================

CREATE TABLE org_ai_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  gemini_api_key TEXT,
  openai_api_key TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 25. NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  actor_name TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX notifications_org_idx ON notifications(org_id, created_at DESC);

-- ============================================================
-- 26. NAMING SCHEMAS
-- ============================================================

CREATE TABLE naming_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  categories JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id)
);

-- ============================================================
-- 27. INSPO BOARDS
-- ============================================================

CREATE TABLE inspo_boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inspo_boards_org ON inspo_boards(org_id);

CREATE TABLE inspo_board_saves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES inspo_boards(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ad_id TEXT NOT NULL,
  ad_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (board_id, ad_id)
);

CREATE INDEX idx_inspo_board_saves_board ON inspo_board_saves(board_id);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================

CREATE TRIGGER trg_profiles_updated_at             BEFORE UPDATE ON profiles             FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_organizations_updated_at        BEFORE UPDATE ON organizations        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_facebook_connections_updated_at BEFORE UPDATE ON facebook_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_business_managers_updated_at    BEFORE UPDATE ON business_managers    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_pages_updated_at                BEFORE UPDATE ON pages                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_ad_accounts_updated_at          BEFORE UPDATE ON ad_accounts          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_page_links_updated_at           BEFORE UPDATE ON page_links           FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_creatives_updated_at            BEFORE UPDATE ON creatives            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_ads_updated_at                  BEFORE UPDATE ON ads                  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_user_settings_updated_at        BEFORE UPDATE ON user_settings        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_ad_copy_templates_updated_at    BEFORE UPDATE ON ad_copy_templates    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_asset_boards_updated_at         BEFORE UPDATE ON asset_boards         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_creative_requests_updated_at    BEFORE UPDATE ON creative_requests    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_naming_schemas_updated_at       BEFORE UPDATE ON naming_schemas       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invitations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_connections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_managers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_links            ENABLE ROW LEVEL SECURITY;
ALTER TABLE creatives             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_media              ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_set_presets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE launch_batches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_copy_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_boards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_assets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_automations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_approvals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_schedules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_api_keys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspo_saved_ads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_ai_keys           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE naming_schemas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspo_boards          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspo_board_saves     ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Users can view own profile"         ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile"       ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can view org member profiles" ON profiles FOR SELECT
  USING (id IN (SELECT user_id FROM org_members WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())));

-- ORGANIZATIONS
CREATE POLICY "Members can view orgs"  ON organizations FOR SELECT USING (is_org_member(id));
CREATE POLICY "Admins can update org"  ON organizations FOR UPDATE USING (is_org_admin(id));
CREATE POLICY "Users can create orgs"  ON organizations FOR INSERT WITH CHECK (created_by = auth.uid());

-- ORG_MEMBERS
CREATE POLICY "Members can view members"   ON org_members FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Admins can add members"     ON org_members FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Creator can add self"       ON org_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can update members"  ON org_members FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can remove members"  ON org_members FOR DELETE USING (is_org_admin(org_id));

-- ORG_INVITATIONS
CREATE POLICY "Admins can view invitations"   ON org_invitations FOR SELECT USING (is_org_admin(org_id));
CREATE POLICY "Admins can create invitations" ON org_invitations FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can delete invitations" ON org_invitations FOR DELETE USING (is_org_admin(org_id));

-- FACEBOOK CONNECTIONS
CREATE POLICY "Org members can view connections"   ON facebook_connections FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert connections" ON facebook_connections FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update connections" ON facebook_connections FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete connections"  ON facebook_connections FOR DELETE USING (is_org_admin(org_id));

-- BUSINESS MANAGERS
CREATE POLICY "Org members can view BMs"   ON business_managers FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert BMs" ON business_managers FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update BMs" ON business_managers FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete BMs"  ON business_managers FOR DELETE USING (is_org_admin(org_id));

-- PAGES
CREATE POLICY "Org members can view pages"   ON pages FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert pages" ON pages FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update pages" ON pages FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete pages"  ON pages FOR DELETE USING (is_org_admin(org_id));

-- AD ACCOUNTS
CREATE POLICY "Org members can view ad accounts"   ON ad_accounts FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert ad accounts" ON ad_accounts FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update ad accounts" ON ad_accounts FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete ad accounts"  ON ad_accounts FOR DELETE USING (is_org_admin(org_id));

-- PAGE LINKS
CREATE POLICY "Org members can view page links"   ON page_links FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert page links" ON page_links FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update page links" ON page_links FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete page links"  ON page_links FOR DELETE USING (is_org_admin(org_id));

-- CREATIVES
CREATE POLICY "Org members can view creatives"   ON creatives FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert creatives" ON creatives FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update creatives" ON creatives FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete creatives"  ON creatives FOR DELETE USING (is_org_admin(org_id));

-- ADS
CREATE POLICY "Org members can view ads"   ON ads FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert ads" ON ads FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update ads" ON ads FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete ads"  ON ads FOR DELETE USING (is_org_admin(org_id));

-- AD MEDIA
CREATE POLICY "Org members can view ad media"   ON ad_media FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert ad media" ON ad_media FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org admins can delete ad media"  ON ad_media FOR DELETE USING (is_org_admin(org_id));

-- USER SETTINGS
CREATE POLICY "Users can view own settings"   ON user_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own settings" ON user_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE USING (user_id = auth.uid());

-- AD SET PRESETS
CREATE POLICY "Org members can manage presets" ON ad_set_presets FOR ALL USING (is_org_member(org_id));

-- LAUNCH BATCHES
CREATE POLICY "Org members can manage launch batches" ON launch_batches FOR ALL USING (is_org_member(org_id));

-- SCHEDULED ACTIVATIONS
CREATE POLICY "Org members can select scheduled activations" ON scheduled_activations FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert scheduled activations" ON scheduled_activations FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update scheduled activations" ON scheduled_activations FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org members can delete scheduled activations" ON scheduled_activations FOR DELETE USING (is_org_member(org_id));

-- AD COPY TEMPLATES
CREATE POLICY "Org members can manage ad copy templates" ON ad_copy_templates FOR ALL USING (is_org_member(org_id));

-- ASSET BOARDS
CREATE POLICY "Org members can view asset boards"   ON asset_boards FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert asset boards" ON asset_boards FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update asset boards" ON asset_boards FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete asset boards"  ON asset_boards FOR DELETE USING (is_org_admin(org_id));

-- BOARD ASSETS (inherits via asset_boards join, use simple org check via board)
CREATE POLICY "Org members can manage board assets" ON board_assets FOR ALL
  USING (board_id IN (SELECT id FROM asset_boards WHERE is_org_member(org_id)));

-- CREATIVE REQUESTS
CREATE POLICY "Org members can view creative requests"   ON creative_requests FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert creative requests" ON creative_requests FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update creative requests" ON creative_requests FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete creative requests"  ON creative_requests FOR DELETE USING (is_org_admin(org_id));

-- COMMENTS
CREATE POLICY "Org members can view comments"   ON comments FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert comments" ON comments FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update comments" ON comments FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org members can delete comments" ON comments FOR DELETE USING (is_org_member(org_id));

-- COMMENT AUTOMATIONS
CREATE POLICY "Org members can view comment automations"   ON comment_automations FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert comment automations" ON comment_automations FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update comment automations" ON comment_automations FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org members can delete comment automations" ON comment_automations FOR DELETE USING (is_org_member(org_id));

-- AUTOMATION RUNS
CREATE POLICY "Org members can view automation runs"   ON automation_runs FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert automation runs" ON automation_runs FOR INSERT WITH CHECK (is_org_member(org_id));

-- AUTOMATIONS (ad management)
CREATE POLICY "Org members can manage automations"           ON automations           FOR ALL USING (is_org_member(org_id));
CREATE POLICY "Org members can manage automation executions" ON automation_executions FOR ALL USING (is_org_member(org_id));
CREATE POLICY "Org members can manage automation approvals"  ON automation_approvals  FOR ALL USING (is_org_member(org_id));
CREATE POLICY "Org members can manage budget schedules"      ON budget_schedules      FOR ALL USING (is_org_member(org_id));

-- MCP
CREATE POLICY "Org members can manage mcp api keys" ON mcp_api_keys FOR ALL USING (is_org_member(org_id));

-- INSPO
CREATE POLICY "Org members can manage inspo saved ads"    ON inspo_saved_ads    FOR ALL USING (is_org_member(org_id));
CREATE POLICY "Org members can manage inspo boards"       ON inspo_boards       FOR ALL USING (is_org_member(org_id));
CREATE POLICY "Org members can manage inspo board saves"  ON inspo_board_saves  FOR ALL USING (is_org_member(org_id));

-- ORG AI KEYS
CREATE POLICY "Org members can manage ai keys" ON org_ai_keys FOR ALL USING (is_org_member(org_id));

-- NOTIFICATIONS
CREATE POLICY "Users can read own notifications"   ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- NAMING SCHEMAS
CREATE POLICY "Org members can read naming schema"   ON naming_schemas FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert naming schema" ON naming_schemas FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update naming schema" ON naming_schemas FOR UPDATE USING (is_org_member(org_id));

-- ============================================================
-- STORAGE: ad-media bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ad-media',
  'ad-media',
  true,
  524288000,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "ad-media public read"          ON storage.objects;
DROP POLICY IF EXISTS "ad-media authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "ad-media authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "ad-media authenticated delete" ON storage.objects;

CREATE POLICY "ad-media public read"          ON storage.objects FOR SELECT TO public       USING     (bucket_id = 'ad-media');
CREATE POLICY "ad-media authenticated upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ad-media');
CREATE POLICY "ad-media authenticated update" ON storage.objects FOR UPDATE TO authenticated USING     (bucket_id = 'ad-media') WITH CHECK (bucket_id = 'ad-media');
CREATE POLICY "ad-media authenticated delete" ON storage.objects FOR DELETE TO authenticated USING     (bucket_id = 'ad-media');

-- ============================================================
-- REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE creatives;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER TABLE notifications REPLICA IDENTITY FULL;
