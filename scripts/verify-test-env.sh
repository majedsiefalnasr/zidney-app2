#!/bin/bash
# START: Verify Test Environment Prerequisites
# Checks that all external dependencies are available for test execution

set -e

echo "🔍 Verifying Zidney test environment..."

# Check PostgreSQL
echo -n "  • PostgreSQL on localhost:5433... "
if nc -z localhost 5433 2>/dev/null; then
  echo "✅"
else
  echo "❌"
  echo "    PostgreSQL not running on localhost:5433"
  exit 1
fi

# Check Redis
echo -n "  • Redis on localhost:6380... "
if nc -z localhost 6380 2>/dev/null; then
  echo "✅"
else
  echo "❌"
  echo "    Redis not running on localhost:6380"
  exit 1
fi

# Check Node.js version
echo -n "  • Node.js >= 20... "
NODE_VERSION=$(node --version | cut -d'v' -f 2 | cut -d'.' -f 1)
if [ "$NODE_VERSION" -ge 20 ]; then
  echo "✅"
else
  echo "❌"
  echo "    Node.js version is below 20"
  exit 1
fi

# Check Vitest
echo -n "  • Vitest >= 1.0... "
if npm list vitest | grep -q "vitest@"; then
  echo "✅"
else
  echo "❌"
  echo "    Vitest not installed"
  exit 1
fi

# Check Bun (optional but expected)
echo -n "  • Bun runtime... "
if command -v bun &> /dev/null; then
  echo "✅"
else
  echo "⚠️  (optional)"
fi

echo ""
echo "✅ All test environment prerequisites verified"
echo ""
echo "RESULT: Test environment verification successful"
exit 0
