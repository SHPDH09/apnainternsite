#!/usr/bin/env bash
# Set PGPASSWORD to an RDS IAM auth token (valid ~15 minutes).
# Requires AWS CLI + credentials with rds-db:connect.
# Usage: eval "$(./aws/scripts/rds-iam-pgpass.sh HOST USER REGION)"

set -euo pipefail
HOST="${1:?host}"
USER="${2:?user}"
REGION="${3:?region}"
export PATH="${HOME}/.local/bin:${PATH}"
if ! command -v aws >/dev/null 2>&1; then
  echo "echo 'aws CLI missing'" >&2
  exit 1
fi
TOKEN="$(aws rds generate-db-auth-token --hostname "$HOST" --port 5432 --username "$USER" --region "$REGION" 2>/dev/null || true)"
if [[ -z "$TOKEN" ]]; then
  echo "echo 'generate-db-auth-token failed'" >&2
  exit 1
fi
printf 'export PGPASSWORD=%q\n' "$TOKEN"
