#!/bin/bash
# START: Script execution
# Reset Test Redis Data
# Flushes Redis and reinitializes test data

set -e

SHELL_HELPER_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SHELL_HELPER_DIR/utils/shell-ai.sh"
shell_ai_parse_args "$@"
shell_ai_init "scripts/reset-test-redis.sh"

REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6380}"

echo "🗑️  Resetting test Redis..."

# Check Redis connection
echo -n "  • Verifying Redis connection... "
if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PING > /dev/null 2>&1; then
  echo "✅"
else
  echo "❌"
  echo "    Cannot connect to Redis on $REDIS_HOST:$REDIS_PORT"
  exit 1
fi

# Flush all data (safe for test environment only)
echo "  • Flushing all data..."
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" FLUSHALL

# Initialize rate limit buckets (empty)
echo "  • Initializing rate limit buckets (empty state)..."
# No explicit initialization needed; buckets are created on-demand

echo "✅ Redis reset complete"
echo ""
echo "─────────────────────────────────────────────────────────────────────────────"
echo "RESULT"
echo "Status: Script execution successful"
echo "─────────────────────────────────────────────────────────────────────────────"
exit 0
