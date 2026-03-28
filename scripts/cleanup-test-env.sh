#!/bin/bash
# START: Script execution
# Post-Test Cleanup Script
# Cleans up test databases, Redis data, and temporary files

set -e

SHELL_HELPER_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SHELL_HELPER_DIR/utils/shell-ai.sh"
shell_ai_parse_args "$@"
shell_ai_init "scripts/cleanup-test-env.sh"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-zidney_test}"
DB_PASSWORD="${DB_PASSWORD:-test_password_secure_123}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6380}"

echo "🗑️  Cleaning up test environment..."

# Delete test databases
echo "  • Deleting test databases..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -tc "SELECT datname FROM pg_database WHERE datname LIKE 'tenant_%'" | while read dbname; do
  if [ ! -z "$dbname" ]; then
    echo "    - Dropping $dbname"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "DROP DATABASE IF EXISTS \"$dbname\"" 2>/dev/null || true
  fi
done

# Clear Redis
echo "  • Clearing Redis data..."
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" FLUSHALL 2>/dev/null || true

# Clean log files
echo "  • Cleaning log files..."
rm -f /tmp/test-*.log

# Clean coverage
echo "  • Cleaning coverage reports..."
rm -rf coverage/

echo "✅ Cleanup complete"
echo ""
echo "─────────────────────────────────────────────────────────────────────────────"
echo "RESULT"
echo "Status: Script execution successful"
echo "─────────────────────────────────────────────────────────────────────────────"
exit 0
