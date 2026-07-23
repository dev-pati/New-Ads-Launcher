#!/bin/bash
# Cron scheduler for AdLauncher — gọi các /api/cron/* endpoints.
# Chạy qua crontab trên Mac mini (không qua Docker, vì Next.js không tự cron).
#
# Cài:
#   chmod +x scripts/cron-adlauncher.sh
#   crontab -e
#   */5 * * * * /Users/<user>/Developer/AdLauncher/New-Ads-Launcher/scripts/cron-adlauncher.sh >> /tmp/adlauncher-cron.log 2>&1
#
# Env: set APP_URL + CRON_SECRET trong ~/.adlauncher.env (không commit)

set -uo pipefail

ENV_FILE="${ENV_FILE:-$HOME/.adlauncher.env}"
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

: "${APP_URL:?set APP_URL trong $ENV_FILE (vd http://localhost:3000)}"
: "${CRON_SECRET:?set CRON_SECRET trong $ENV_FILE}"

ts() { date '+%Y-%m-%d %H:%M:%S'; }

call() {
  local path="$1"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 300 \
    -H "Authorization: Bearer $CRON_SECRET" \
    "$APP_URL$path")
  echo "[$(ts)] $path -> HTTP $code"
}

# Frequencies khớp intent mỗi endpoint. Chỉnh theo nhu cầu.
call "/api/cron/activate-scheduled-ads"        # 5min — scheduled ads fire
call "/api/cron/check-scheduled-triggers"      # 5min — automation time rules
call "/api/cron/resume-pending-executions"     # 5min — retry failed automations
call "/api/cron/upload-to-facebook"            # 5min — queued video uploads
call "/api/cron/check-meta-triggers"           # 15min — meta webhook fallback
call "/api/cron/check-sheets-triggers"         # 15min
call "/api/cron/check-drive-triggers"          # 15min
call "/api/cron/snapshot-metrics"              # hourly — insights cache
call "/api/cron/sync-ad-accounts"              # hourly — ad account refresh

echo "[$(ts)] cron run done."
