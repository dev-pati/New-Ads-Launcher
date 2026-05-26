#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if [ $# -ne 1 ]; then
  echo "Usage: DATABASE_URL=... ./scripts/restore-db.sh <backup.dump>" >&2
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --dbname "$DATABASE_URL" \
  "$BACKUP_FILE"

echo "Restore completed from $BACKUP_FILE"
