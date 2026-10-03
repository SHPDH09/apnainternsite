#!/usr/bin/env bash
# Run in AWS CloudShell (admin) — deploy Lambda API + point at Hyderabad RDS (postgres + IAM).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

FN="${LAMBDA_FUNCTION_NAME:-ezyintern-api-staging}"
LAMBDA_REGION="${LAMBDA_AWS_REGION:-ap-south-1}"
HYDERABAD_URL="${DATABASE_URL:-postgresql://postgres:Raunak12583@ezyintern.cpy4aaca6mfv.ap-south-2.rds.amazonaws.com:5432/ezyintern?sslmode=require}"

echo "→ Bundle Lambda…"
node aws/scripts/bundle-lambda.mjs
(cd aws/lambda/dist && zip -qr /tmp/ezyintern-lambda.zip .)

echo "→ Upload code to ${FN} (${LAMBDA_REGION})…"
aws lambda update-function-code \
  --function-name "$FN" \
  --region "$LAMBDA_REGION" \
  --zip-file "fileb:///tmp/ezyintern-lambda.zip"
aws lambda wait function-updated --function-name "$FN" --region "$LAMBDA_REGION"

echo "→ Update DATABASE_URL (Hyderabad + IAM)…"
export DATABASE_URL="$HYDERABAD_URL"
export RDS_IAM_AUTH=false
export AWS_RDS_REGION=ap-south-2
export LAMBDA_FUNCTION_NAME="$FN"
export AWS_DEFAULT_REGION="$LAMBDA_REGION"
node aws/scripts/update-lambda-database-url.mjs

echo "→ Smoke test REST…"
curl -sS -m 20 "https://eikmcrd7ei.execute-api.ap-south-1.amazonaws.com/staging/rest/v1/site_popups?select=id&limit=1" | head -c 400
echo
echo "Done. If you see JSON (not 28P01), redeploy is OK."
