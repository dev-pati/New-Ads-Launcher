-- 20260730_media_upload_jobs.sql
-- Media Upload Queue (B8 tracer bullet, BL-24 slice 1 / BL-38).
-- DESIGN ONLY - Supabase shared project locked, requires Seth approval to execute.

-- 1. Job Table
CREATE TABLE IF NOT EXISTS ads_launcher.media_upload_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES ads_launcher.organizations(id) ON DELETE CASCADE,
    ad_account_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'done', 'error')),
    total_items INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_upload_jobs_org ON ads_launcher.media_upload_jobs(org_id);

-- 2. Job Items Table (Per-creative execution state)
CREATE TABLE IF NOT EXISTS ads_launcher.media_upload_job_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES ads_launcher.media_upload_jobs(id) ON DELETE CASCADE,
    creative_id UUID NOT NULL REFERENCES ads_launcher.creatives(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'done', 'failed')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_msg TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(job_id, creative_id)
);

CREATE INDEX IF NOT EXISTS idx_media_job_items_job ON ads_launcher.media_upload_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_media_job_items_run_at ON ads_launcher.media_upload_job_items(status, run_at);

-- 3. Link back from assignments (optional, ties assignment exact pass to job)
ALTER TABLE ads_launcher.portal_media_assignments
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES ads_launcher.media_upload_jobs(id) ON DELETE SET NULL;

-- 4. Minimal RLS (Org scoped, worker uses service role)
ALTER TABLE ads_launcher.media_upload_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads_launcher.media_upload_job_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read jobs" ON ads_launcher.media_upload_jobs;
CREATE POLICY "Org members can read jobs" ON ads_launcher.media_upload_jobs
    FOR SELECT USING (ads_launcher.is_org_member(org_id));

DROP POLICY IF EXISTS "Org members can read job items" ON ads_launcher.media_upload_job_items;
CREATE POLICY "Org members can read job items" ON ads_launcher.media_upload_job_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ads_launcher.media_upload_jobs j
            WHERE j.id = media_upload_job_items.job_id
            AND ads_launcher.is_org_member(j.org_id)
        )
    );
