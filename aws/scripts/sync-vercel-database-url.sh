#!/usr/bin/env bash
# Push DATABASE_URL to Vercel production env (same pattern as vercel-mail-deploy workflow).
set -euo pipefail

URL="${DATABASE_URL:-${TARGET_DATABASE_URL:-}}"
if [[ -z "$URL" ]]; then
  echo "DATABASE_URL or TARGET_DATABASE_URL required"
  exit 1
fi
if [[ -z "${VERCEL_TOKEN:-}" ]] || [[ -z "${VERCEL_PROJECT_ID:-}" ]]; then
  echo "VERCEL_TOKEN / VERCEL_PROJECT_ID not set — skip Vercel DATABASE_URL sync"
  exit 0
fi

KEY=DATABASE_URL
printf '%s' "$URL" | npx vercel env add "$KEY" production --token "$VERCEL_TOKEN" --yes 2>/dev/null || {
  npx vercel env rm "$KEY" production --token "$VERCEL_TOKEN" --yes 2>/dev/null || true
  printf '%s' "$URL" | npx vercel env add "$KEY" production --token "$VERCEL_TOKEN" --yes
}
echo "Vercel production DATABASE_URL updated."
