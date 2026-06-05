SET search_path TO ads_launcher, public;

-- Add steps column to automations for full workflow persistence
-- steps stores the complete step array: trigger + actions + delays + approvals
ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT NULL;

-- COMMENT: steps structure (array of WorkflowStep):
-- [
--   { "id": "step-1", "kind": "trigger", "status": "configured", "triggerConfig": {...} },
--   { "id": "step-2", "kind": "delay", "status": "configured", "delayConfig": {"unit":"hours","value":2} },
--   { "id": "step-3", "kind": "approval", "status": "configured", "approvalConfig": {...} },
--   { "id": "step-4", "kind": "action", "status": "configured", "actionConfig": {...} }
-- ]
