#!/usr/bin/env bash
# pg_dump / pg_restore using RDS IAM auth tokens (console "Authentication token" as PGPASSWORD).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SOURCE_TOKEN_FILE="${1:?source token file}"
TARGET_TOKEN_FILE="${2:?target token file}"
SOURCE_HOST="${SOURCE_HOST:-ezyintern-staging-db.c5makww6eq8y.ap-south-1.rds.amazonaws.com}"
SOURCE_USER="${SOURCE_USER:-ezyintern}"
SOURCE_DB="${SOURCE_DB:-ezyintern}"
TARGET_HOST="${TARGET_HOST:-database-1.cluster-cpy4aaca6mfv.ap-south-2.rds.amazonaws.com}"
TARGET_USER="${TARGET_USER:-postgres}"
TARGET_DB="${TARGET_DB:-ezyintern}"
STAMP="$(date +%Y%m%d_%H%M%S)"
DUMP="$ROOT/aws/backups/rds_iam_${STAMP}.dump"
mkdir -p "$ROOT/aws/backups"

export PGPASSWORD="$(tr -d '\n' < "$SOURCE_TOKEN_FILE")"
psql "host=$SOURCE_HOST port=5432 dbname=$SOURCE_DB user=$SOURCE_USER sslmode=require connect_timeout=20" \
  -c "SELECT current_database(), count(*) FROM pg_tables WHERE schemaname='public';" >/dev/null
echo "→ Source OK"

export PGPASSWORD="$(tr -d '\n' < "$TARGET_TOKEN_FILE")"
psql "host=$TARGET_HOST port=5432 dbname=postgres user=$TARGET_USER sslmode=require connect_timeout=20" \
  -c "SELECT 1 FROM pg_database WHERE datname='$TARGET_DB'" | grep -q 1 || \
  psql "host=$TARGET_HOST port=5432 dbname=postgres user=$TARGET_USER sslmode=require" \
    -c "CREATE DATABASE $TARGET_DB;"

echo "→ Dumping (IAM token valid ~15 min)..."
export PGPASSWORD="$(tr -d '\n' < "$SOURCE_TOKEN_FILE")"
pg_dump "host=$SOURCE_HOST port=5432 dbname=$SOURCE_DB user=$SOURCE_USER sslmode=require" \
  -Fc --no-owner --no-privileges -f "$DUMP"

echo "→ Restoring to $TARGET_DB..."
export PGPASSWORD="$(tr -d '\n' < "$TARGET_TOKEN_FILE")"
set +e
pg_restore --no-owner --no-privileges -d "host=$TARGET_HOST port=5432 dbname=$TARGET_DB user=$TARGET_USER sslmode=require" "$DUMP"
set -e

export PGPASSWORD="$(tr -d '\n' < "$TARGET_TOKEN_FILE")"
psql "host=$TARGET_HOST port=5432 dbname=$TARGET_DB user=$TARGET_USER sslmode=require" -c \
  "SELECT schemaname, count(*) FROM pg_tables WHERE schemaname IN ('public','auth') GROUP BY schemaname;"
echo "✅ Done. Dump: $DUMP"
