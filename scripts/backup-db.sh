#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-backups}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/adlauncher-$STAMP.dump"

pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --schema=ads_launcher \
  --file="$OUT"

echo "Backup written to $OUT"
