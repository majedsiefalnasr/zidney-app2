#!/bin/bash
# START: Script execution
# Run All Tests for STAGE_TEST_01_PLATFORM_FOUNDATION
# Executes all test suites in dependency order

set -e

SHELL_HELPER_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
. "$SHELL_HELPER_DIR/utils/shell-ai.sh"
shell_ai_parse_args "$@"
shell_ai_init "scripts/run-all-tests.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🧪 STAGE_TEST_01_PLATFORM_FOUNDATION - Test Runner"
echo "=================================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Phase 1: Static Analysis (Area 4) - 5 min
echo "📋 Phase 1: Static Analysis (Area 4)..."
if npm run test:static -- --run > /tmp/test-static.log 2>&1; then
  echo -e "${GREEN}✅ Static tests passed${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ Static tests failed${NC}"
  ((TESTS_FAILED++))
  cat /tmp/test-static.log
fi

# Phase 2: Unit Tests (Areas 1, 3, 5) - 15 min
echo "🧪 Phase 2: Unit Tests (Areas 1, 3, 5)..."
if npm run test:unit -- --run > /tmp/test-unit.log 2>&1; then
  echo -e "${GREEN}✅ Unit tests passed${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ Unit tests failed${NC}"
  ((TESTS_FAILED++))
  cat /tmp/test-unit.log
fi

# Phase 3: Integration Tests (Areas 1, 2, 6, 7) - 30 min
echo "🔌 Phase 3: Integration Tests (Areas 1, 2, 6, 7)..."
if npm run test:integration -- --run > /tmp/test-integration.log 2>&1; then
  echo -e "${GREEN}✅ Integration tests passed${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ Integration tests failed${NC}"
  ((TESTS_FAILED++))
  cat /tmp/test-integration.log
fi

# Phase 4: Performance Tests (Area 8) - 15 min
echo "⚡ Phase 4: Performance Tests (Area 8)..."
if npm run test:performance -- --run > /tmp/test-performance.log 2>&1; then
  echo -e "${GREEN}✅ Performance tests passed${NC}"
  ((TESTS_PASSED++))
else
  echo -e "${RED}❌ Performance tests failed${NC}"
  ((TESTS_FAILED++))
  cat /tmp/test-performance.log
fi

# Summary
echo ""
echo "=================================================="
echo "📊 Test Summary"
echo "=================================================="
echo "Phase Groups Passed: $TESTS_PASSED/4"
echo "Phase Groups Failed: $TESTS_FAILED/4"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo ""
  echo "RESULT: All tests passed"
  exit 0
else
  echo -e "${RED}❌ Some tests failed!${NC}"
  echo ""
  echo "RESULT: Some tests failed"
  exit 1
fi
