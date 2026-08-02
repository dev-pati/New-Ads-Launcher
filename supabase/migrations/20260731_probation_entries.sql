-- 20260731_probation_entries.sql
-- Probation dashboard — private, single-user instrument for probation month 2.
-- DESIGN ONLY - Supabase shared project locked, requires DB owner sign-off to execute.
--
-- Deliberately ONE generic table rather than four purpose-built ones:
--   * smallest possible ask on a locked production schema, for a feature that is
--     not part of the product;
--   * removal at the end of probation is a single DROP;
--   * KR thresholds are still being negotiated, so they live in `payload` JSONB
--     and can change without a second migration.
--
-- Not org-scoped: this is per-person, cross-org by nature. RLS is enabled with
-- NO policies (deny-all). Every read and write goes through createAdminClient()
-- behind the single-email allowlist in lib/probation/auth.ts, so a mis-wired
-- route cannot leak rows even to an authenticated user.

CREATE TABLE IF NOT EXISTS ads_launcher.probation_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Email, not a FK to accounts(id): the owner is identified by the same
    -- allowlist value used for authorization, and must survive account churn.
    user_email  TEXT NOT NULL,
    -- config  : the KR definition — weights, metrics, thresholds, pass mark
    -- metric  : one manual metric reading for one ISO week
    -- exception: an event excluded from KR failure (plan lines 75-83)
    -- issue   : an open blocker with owner + deadline (plan "ISSUES OPEN")
    -- week    : the weekly snapshot, incl. the reviewers' confirmed score
    kind        TEXT NOT NULL CHECK (kind IN ('config', 'metric', 'exception', 'issue', 'week')),
    -- ISO week key 'YYYY-Www' for kind in (metric, week); NULL for config,
    -- and for exception/issue which are dated events, not weekly readings.
    week_key    TEXT,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The dashboard's only query shape: everything for one person, newest first.
CREATE INDEX IF NOT EXISTS idx_probation_entries_owner
    ON ads_launcher.probation_entries(user_email, kind, created_at DESC);

-- One config row and one snapshot per week per person - enforced, not assumed,
-- because a duplicate week row would silently double-count in the score.
CREATE UNIQUE INDEX IF NOT EXISTS uq_probation_entries_config
    ON ads_launcher.probation_entries(user_email)
    WHERE kind = 'config';

CREATE UNIQUE INDEX IF NOT EXISTS uq_probation_entries_week
    ON ads_launcher.probation_entries(user_email, week_key)
    WHERE kind = 'week';

CREATE UNIQUE INDEX IF NOT EXISTS uq_probation_entries_metric
    ON ads_launcher.probation_entries(user_email, week_key, (payload->>'metric_id'))
    WHERE kind = 'metric';

-- Deny-all: RLS on, zero policies. Service role bypasses; nothing else reads.
ALTER TABLE ads_launcher.probation_entries ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_probation_entries_updated_at ON ads_launcher.probation_entries;
CREATE TRIGGER trg_probation_entries_updated_at
    BEFORE UPDATE ON ads_launcher.probation_entries
    FOR EACH ROW EXECUTE FUNCTION ads_launcher.update_updated_at_column();

-- ── Removal (end of probation month 2) ───────────────────────────────────────
-- DROP TABLE IF EXISTS ads_launcher.probation_entries CASCADE;
