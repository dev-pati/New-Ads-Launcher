CREATE TABLE IF NOT EXISTS inspo_saved_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ad_archive_id text NOT NULL,
  page_name text NOT NULL,
  page_id text,
  ad_body text,
  ad_title text,
  ad_snapshot_url text,
  ad_delivery_start_time text,
  publisher_platforms text[] DEFAULT '{}',
  notes text,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, ad_archive_id)
);

ALTER TABLE inspo_saved_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage inspo saved ads"
  ON inspo_saved_ads FOR ALL
  USING (is_org_member(org_id));
