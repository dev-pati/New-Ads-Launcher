#!/bin/bash
# Auto-deploy: git pull + rebuild container. Chạy trên Mac mini.
# Cách dùng:
#   ./scripts/auto-deploy.sh
#   Hoặc chạy tự động qua LaunchAgent (xem scripts/com.adlauncher.autostart.plist)

set -euo pipefail

# Sửa path này cho đúng nơi clone repo trên Mac mini
APP_DIR="${APP_DIR:-$HOME/Developer/AdLauncher/New-Ads-Launcher}"
BRANCH="${BRANCH:-main}"
LOG_FILE="${LOG_FILE:-/tmp/adlauncher-deploy.log}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

if [ ! -d "$APP_DIR/.git" ]; then
  log "ERROR: $APP_DIR không phải git repo. Sửa APP_DIR trong script."
  exit 1
fi

cd "$APP_DIR"

log "==> Git fetch $BRANCH"
git fetch origin "$BRANCH"

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
  log "Không có code mới (đã ở $REMOTE). Thoát."
  exit 0
fi

log "==> Có code mới: $LOCAL -> $REMOTE"
log "==> Git pull"
git pull --ff-only origin "$BRANCH"

log "==> Docker rebuild + restart"
docker compose up -d --build

log "==> Done. Đợi container healthy..."
sleep 5
docker compose ps
log "Deploy xong."
