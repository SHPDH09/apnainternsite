#!/usr/bin/env bash
# Clone all data from SOURCE RDS (e.g. Mumbai ap-south-1) to TARGET RDS (e.g. Hyderabad ap-south-2).
#
# Does NOT run automatically when you change region — you must run this once (or use AWS DMS).
#
# Usage:
#   export SOURCE_DATABASE_URL='postgresql://ezyintern:***@ezyintern-staging-db....ap-south-1.rds.amazonaws.com:5432/ezyintern?sslmode=require'
#   export TARGET_DATABASE_URL='postgresql://postgres:***@database-1.cluster-....ap-south-2.rds.amazonaws.com:5432/ezyintern?sslmode=require'
#   ./aws/scripts/migrate-rds-region.sh
#
# Or: npm run aws:rds:migrate-region
#
# Options:
#   --dump-only     Write dump to aws/backups/ and skip restore
#   --restore FILE  Restore existing custom-format dump to TARGET only
#   --yes           Skip confirmation prompt

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKUP_DIR="$ROOT/aws/backups"
STAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_ONLY=false
RESTORE_FILE=""
SKIP_CONFIRM=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dump-only) DUMP_ONLY=true; shift ;;
    --restore)
      RESTORE_FILE="${2:-}"
      shift 2
      ;;
    --yes) SKIP_CONFIRM=true; shift ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "${SOURCE_DATABASE_URL:-}" && -z "$RESTORE_FILE" ]]; then
  echo "Set SOURCE_DATABASE_URL (Mumbai / current RDS) or pass --restore FILE."
  exit 1
fi
if [[ -z "${TARGET_DATABASE_URL:-}" ]]; then
  echo "Set TARGET_DATABASE_URL (Hyderabad / new RDS cluster)."
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1 || ! command -v pg_restore >/dev/null 2>&1; then
  echo "Install PostgreSQL client: sudo apt install postgresql-client"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

mask_url() {
  echo "$1" | sed -E 's#(postgresql://[^:/]+):[^@]+@#\1:***@#'
}

if [[ -z "$RESTORE_FILE" ]]; then
  echo "→ Source: $(mask_url "$SOURCE_DATABASE_URL")"
  echo "→ Target: $(mask_url "$TARGET_DATABASE_URL")"
  if [[ "$SKIP_CONFIRM" != true ]]; then
    echo ""
    echo "This copies ALL schemas/data from source into target (pg_dump custom format + pg_restore)."
    echo "Target objects in the same schemas may be replaced. Staging/clones only unless you intend production cutover."
    read -r -p "Continue? [y/N] " ans
    if [[ "${ans,,}" != "y" && "${ans,,}" != "yes" ]]; then
      echo "Aborted."
      exit 0
    fi
  fi

  echo "→ Testing source connection..."
  psql "$SOURCE_DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user;" >/dev/null

  DUMP_FILE="$BACKUP_DIR/rds_region_${STAMP}.dump"
  echo "→ Dumping source (this may take several minutes)..."
  pg_dump "$SOURCE_DATABASE_URL" \
    -Fc \
    --no-owner \
    --no-privileges \
    --verbose \
    -f "$DUMP_FILE"
  echo "✅ Dump written: $DUMP_FILE"
  ls -lh "$DUMP_FILE"

  if [[ "$DUMP_ONLY" == true ]]; then
    echo "(--dump-only) Skipping restore."
    exit 0
  fi
  RESTORE_FILE="$DUMP_FILE"
fi

if [[ ! -f "$RESTORE_FILE" ]]; then
  echo "❌ Restore file not found: $RESTORE_FILE"
  exit 1
fi

echo "→ Testing target connection..."
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT current_database(), current_user;" >/dev/null

echo "→ Restoring into target from $RESTORE_FILE ..."
set +e
pg_restore \
  --no-owner \
  --no-privileges \
  --verbose \
  -d "$TARGET_DATABASE_URL" \
  "$RESTORE_FILE"
restore_code=$?
set -e

if [[ $restore_code -ne 0 ]]; then
  echo "⚠️  pg_restore exited $restore_code (often harmless: existing objects skipped). Check counts below."
fi

echo "→ Target table counts:"
psql "$TARGET_DATABASE_URL" -c "
  SELECT schemaname, count(*) AS tables
  FROM pg_tables
  WHERE schemaname IN ('public','auth','storage')
  GROUP BY schemaname
  ORDER BY schemaname;
" || true

echo ""
echo "✅ Region migration restore finished."
echo "Next: point app DATABASE_URL to Hyderabad (Vercel env, Lambda, .env.awsrds.local), then npm run aws:rds:apply-all if needed."
