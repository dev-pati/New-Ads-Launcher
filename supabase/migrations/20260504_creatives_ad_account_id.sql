ALTER TABLE creatives
  ADD COLUMN IF NOT EXISTS ad_account_id TEXT;

CREATE INDEX IF NOT EXISTS creatives_ad_account_id_idx ON creatives (ad_account_id);
