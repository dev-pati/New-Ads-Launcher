SET search_path TO ads_launcher, public;

-- Add notif_config column to automations table
-- Stores bell notification settings: email recipients, when to notify
ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS notif_config JSONB DEFAULT '{}'::jsonb;

-- COMMENT: notif_config structure:
-- {
--   "emails": ["user@co.com"],
--   "on_success": true,
--   "on_fail": true
-- }
