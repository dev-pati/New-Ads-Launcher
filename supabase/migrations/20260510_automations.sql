-- Automations: rule-based automation engine for Meta ad management

CREATE TABLE automations (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  description       text,
  status            text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','draft')),
  trigger_type      text        NOT NULL DEFAULT 'metric_threshold',
  trigger_config    jsonb       NOT NULL DEFAULT '{}',
  conditions        jsonb       NOT NULL DEFAULT '[]',
  actions           jsonb       NOT NULL DEFAULT '[]',
  ad_account_ids    text[]      NOT NULL DEFAULT '{}',
  requires_approval boolean     NOT NULL DEFAULT false,
  template_id       text,
  run_count         int         NOT NULL DEFAULT 0,
  last_run_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE automation_executions (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  automation_id     uuid        REFERENCES automations(id) ON DELETE SET NULL,
  automation_name   text,
  status            text        NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','pending','skipped')),
  entities_affected int         NOT NULL DEFAULT 0,
  api_calls         int         NOT NULL DEFAULT 0,
  action_taken      text,
  ad_account_id     text,
  details           jsonb       NOT NULL DEFAULT '{}',
  executed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE automation_approvals (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  automation_id    uuid        REFERENCES automations(id) ON DELETE SET NULL,
  execution_id     uuid        REFERENCES automation_executions(id) ON DELETE SET NULL,
  automation_name  text,
  status           text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_action text        NOT NULL,
  details          jsonb       NOT NULL DEFAULT '{}',
  reviewed_by      uuid        REFERENCES auth.users(id),
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE budget_schedules (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ad_account_id  text        NOT NULL,
  adset_id       text        NOT NULL,
  adset_name     text,
  rule_name      text        NOT NULL,
  change_type    text        NOT NULL DEFAULT 'absolute' CHECK (change_type IN ('absolute','percentage_increase','percentage_decrease')),
  new_budget     numeric,
  percentage     numeric,
  scheduled_at   timestamptz NOT NULL,
  timezone       text        NOT NULL DEFAULT 'UTC',
  status         text        NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','executed','failed','cancelled')),
  executed_at    timestamptz,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX automations_org_id_idx ON automations(org_id);
CREATE INDEX automations_status_idx ON automations(org_id, status);
CREATE INDEX automation_executions_org_idx ON automation_executions(org_id);
CREATE INDEX automation_executions_automation_idx ON automation_executions(automation_id);
CREATE INDEX automation_approvals_org_idx ON automation_approvals(org_id);
CREATE INDEX automation_approvals_status_idx ON automation_approvals(org_id, status);
CREATE INDEX budget_schedules_org_idx ON budget_schedules(org_id);
CREATE INDEX budget_schedules_scheduled_idx ON budget_schedules(scheduled_at) WHERE status = 'active';

-- RLS
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members" ON automations USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
CREATE POLICY "org members" ON automation_executions USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
CREATE POLICY "org members" ON automation_approvals USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
CREATE POLICY "org members" ON budget_schedules USING (
  org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
);
