#!/usr/bin/env bash
set -euo pipefail

# Load .env if present
if [ -f .env ]; then
  # Export non-comment lines
  export $(grep -v '^#' .env | xargs -d '\n')
fi

# MIGRATOR_DATABASE_URL connects as postgres superuser (e.g. layerto/layerto)
ADMIN_URL="${MIGRATOR_DATABASE_URL:-postgres://layerto:layerto@localhost:5434/layerto?sslmode=disable}"

APP_USER="${APP_USER:-layerto_app}"
APP_PASSWORD="${APP_PASSWORD:-layerto_app_pass}"

MIGRATOR_USER="${MIGRATOR_USER:-layerto_migrator}"
MIGRATOR_PASSWORD="${MIGRATOR_PASSWORD:-layerto_migrator_pass}"

echo "Configuring database roles with LOGIN and passwords..."

psql "$ADMIN_URL" <<EOF
ALTER ROLE ${APP_USER} WITH LOGIN PASSWORD '${APP_PASSWORD}';
ALTER ROLE ${MIGRATOR_USER} WITH LOGIN PASSWORD '${MIGRATOR_PASSWORD}';
EOF

echo "Roles configured successfully:"
echo "- ${APP_USER} (LOGIN enabled)"
echo "- ${MIGRATOR_USER} (LOGIN enabled)"
