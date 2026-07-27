-- ============================================================
-- Add OTP login columns
-- ============================================================

ALTER TABLE ads_launcher.accounts
  ADD COLUMN IF NOT EXISTS otp_code TEXT,
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;
