#!/usr/bin/env bash
# Set production Supabase + Vercel portal env (requires VERCEL_TOKEN).
# Full list: npm run vercel:env:production
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$ROOT/scripts/vercel-set-all-production-env.mjs"
