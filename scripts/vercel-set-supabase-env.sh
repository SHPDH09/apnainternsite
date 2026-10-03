#!/usr/bin/env bash
# Set production Supabase + Vercel portal env (requires VERCEL_TOKEN).
set -euo pipefail
TOKEN="${VERCEL_TOKEN:?Set VERCEL_TOKEN}"
PROJECT_ID="${VITE_SUPABASE_PROJECT_ID:-hflapipozwwwinbbfpuh}"
SITE_URL="${VITE_SUPABASE_URL:-https://apnaintern.in}"

if [[ -z "${DATABASE_URL:-}" ]] && [[ -n "${SUPABASE_DB_PW_B64:-}" ]]; then
  DB_PASS="$(printf '%s' "$SUPABASE_DB_PW_B64" | base64 -d)"
  export DB_PASS
  ENC_PASS="$(python3 -c 'import os, urllib.parse; print(urllib.parse.quote(os.environ["DB_PASS"], safe=""))')"
  # Vercel is IPv4-only; direct db.*.supabase.co is IPv6-only — use Supavisor transaction pooler.
  DATABASE_URL="postgresql://postgres.${PROJECT_ID}:${ENC_PASS}@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require"
fi

DB_URL="${DATABASE_URL:?Set DATABASE_URL or SUPABASE_DB_PW_B64}"

upsert_env() {
  local key="$1"
  local val="$2"
  npx vercel env rm "$key" production --yes --token "$TOKEN" 2>/dev/null || true
  printf '%s' "$val" | npx vercel env add "$key" production --token "$TOKEN" --yes
}

upsert_env DATABASE_URL "$DB_URL"
upsert_env VITE_SUPABASE_PROJECT_ID "$PROJECT_ID"
upsert_env VITE_SUPABASE_URL "$SITE_URL"
upsert_env SUPABASE_URL "https://${PROJECT_ID}.supabase.co"
upsert_env LOCAL_SUPABASE "true"
upsert_env RDS_IAM_AUTH "false"
upsert_env RDS_RPC_OPEN "true"
upsert_env VITE_SUPABASE_PUBLISHABLE_KEY "${VITE_SUPABASE_PUBLISHABLE_KEY:-local-anon-key}"

if [[ -n "${LOCAL_JWT_SECRET:-}" ]]; then
  upsert_env LOCAL_JWT_SECRET "$LOCAL_JWT_SECRET"
else
  upsert_env LOCAL_JWT_SECRET "change-me-staging-jwt-secret"
fi

if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  upsert_env SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"
fi

echo "✅ Vercel production env updated (Supabase DATABASE_URL + portal flags)."
