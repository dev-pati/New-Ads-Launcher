#!/usr/bin/env bash
set -euo pipefail

# Find path of .env relative to script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

if [ ! -f .env ]; then
  echo "Error: .env file not found at $ROOT_DIR/.env" >&2
  exit 1
fi

mkdir -p backups

STAMP=$(date +%Y%m%d-%H%M%S)
OUT_FILENAME="adlauncher-${STAMP}.dump"

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Run pg_dump using official postgres Docker image
# This avoids needing pg_dump installed locally on the host
echo "Running pg_dump in Docker container..."
docker run --rm \
  -v "$ROOT_DIR/backups:/backups" \
  --env-file .env \
  postgres:16 \
  sh -c "pg_dump \"\$DATABASE_URL\" --format=custom --no-owner --schema=ads_launcher --file=/backups/$OUT_FILENAME"

echo "Backup successful! Written to: backups/$OUT_FILENAME"
