-- ============================================================
-- Auto Launch Ads - Database Schema (Multi-Org + Realtime)
-- ============================================================

-- ============================================================
-- DROP EXISTING (order matters due to foreign keys)
-- ============================================================

DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS ad_media CASCADE;
DROP TABLE IF EXISTS ads CASCADE;
DROP TABLE IF EXISTS creatives CASCADE;
DROP TABLE IF EXISTS pages CASCADE;
DROP TABLE IF EXISTS ad_accounts CASCADE;
DROP TABLE IF EXISTS selected_pages CASCADE;
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
-- 5. HELPER FUNCTIONS (for RLS)
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
-- 10. PAGE LINKS (landing page URLs for ads)
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

  headline TEXT,
  primary_text TEXT,
  description TEXT,
  cta ad_cta DEFAULT 'LEARN_MORE',
  link_url TEXT,

  fb_image_hash TEXT,
  fb_image_url TEXT,
  fb_thumbnail_url TEXT,
  fb_video_id TEXT,

  status TEXT DEFAULT 'ready',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_creatives_org ON creatives(org_id);

-- ============================================================
-- 11. ADS
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
-- 12. AD MEDIA
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
-- 13. USER SETTINGS
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
-- 14. UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_facebook_connections_updated_at BEFORE UPDATE ON facebook_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_business_managers_updated_at BEFORE UPDATE ON business_managers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_pages_updated_at BEFORE UPDATE ON pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_ad_accounts_updated_at BEFORE UPDATE ON ad_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_page_links_updated_at BEFORE UPDATE ON page_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_creatives_updated_at BEFORE UPDATE ON creatives FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_ads_updated_at BEFORE UPDATE ON ads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 15. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can view org member profiles" ON profiles FOR SELECT
  USING (id IN (SELECT user_id FROM org_members WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())));

-- ORGANIZATIONS
CREATE POLICY "Members can view orgs" ON organizations FOR SELECT USING (is_org_member(id));
CREATE POLICY "Admins can update org" ON organizations FOR UPDATE USING (is_org_admin(id));
CREATE POLICY "Users can create orgs" ON organizations FOR INSERT WITH CHECK (created_by = auth.uid());

-- ORG_MEMBERS
CREATE POLICY "Members can view members" ON org_members FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Admins can add members" ON org_members FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Creator can add self" ON org_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can update members" ON org_members FOR UPDATE USING (is_org_admin(org_id));
CREATE POLICY "Admins can remove members" ON org_members FOR DELETE USING (is_org_admin(org_id));

-- ORG_INVITATIONS
CREATE POLICY "Admins can view invitations" ON org_invitations FOR SELECT USING (is_org_admin(org_id));
CREATE POLICY "Admins can create invitations" ON org_invitations FOR INSERT WITH CHECK (is_org_admin(org_id));
CREATE POLICY "Admins can delete invitations" ON org_invitations FOR DELETE USING (is_org_admin(org_id));

-- ALL DATA TABLES: org-based access
-- Facebook Connections
CREATE POLICY "Org members can view connections" ON facebook_connections FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert connections" ON facebook_connections FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update connections" ON facebook_connections FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete connections" ON facebook_connections FOR DELETE USING (is_org_admin(org_id));

-- Business Managers
CREATE POLICY "Org members can view BMs" ON business_managers FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert BMs" ON business_managers FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update BMs" ON business_managers FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete BMs" ON business_managers FOR DELETE USING (is_org_admin(org_id));

-- Pages
CREATE POLICY "Org members can view pages" ON pages FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert pages" ON pages FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update pages" ON pages FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete pages" ON pages FOR DELETE USING (is_org_admin(org_id));

-- Ad Accounts
CREATE POLICY "Org members can view ad accounts" ON ad_accounts FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert ad accounts" ON ad_accounts FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update ad accounts" ON ad_accounts FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete ad accounts" ON ad_accounts FOR DELETE USING (is_org_admin(org_id));

-- Page Links
CREATE POLICY "Org members can view page links" ON page_links FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert page links" ON page_links FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update page links" ON page_links FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete page links" ON page_links FOR DELETE USING (is_org_admin(org_id));

-- Creatives
CREATE POLICY "Org members can view creatives" ON creatives FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert creatives" ON creatives FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update creatives" ON creatives FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete creatives" ON creatives FOR DELETE USING (is_org_admin(org_id));

-- Ads
CREATE POLICY "Org members can view ads" ON ads FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert ads" ON ads FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org members can update ads" ON ads FOR UPDATE USING (is_org_member(org_id));
CREATE POLICY "Org admins can delete ads" ON ads FOR DELETE USING (is_org_admin(org_id));

-- Ad Media
CREATE POLICY "Org members can view ad media" ON ad_media FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Org members can insert ad media" ON ad_media FOR INSERT WITH CHECK (is_org_member(org_id));
CREATE POLICY "Org admins can delete ad media" ON ad_media FOR DELETE USING (is_org_admin(org_id));

-- USER SETTINGS
CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own settings" ON user_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- 16. ENABLE REALTIME FOR CREATIVES
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE creatives;
