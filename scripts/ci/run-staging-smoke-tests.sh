#!/bin/bash
# START: Script execution

# T042 (moved from scripts/): Run Staging Smoke Tests for MMC Dashboard
#
# Executes comprehensive validation suite against deployed staging environment
# Tests:
#   - API connectivity (health checks)
#   - Authentication (JWT validation)
#   - Database connectivity (queries executed)
#   - Cache functionality (Redis verified)
#   - Performance SLAs (<300ms)
#   - Rate limiting enforcement
#   - Error handling
#   - Monitoring/logging
#
# Prerequisites:
#   - MMC Dashboard deployed to staging (via scripts/ci/deploy-staging.sh)
#   - API accessible at: https://staging-mmc-api.example.com
#   - JWT_TOKEN environment variable set
#   - bun installed (or npm/pnpm)
#
# Run from: project root ($(pwd) == zidney-app2/)
#
# Usage:
#   chmod +x scripts/ci/run-staging-smoke-tests.sh
#   ./scripts/ci/run-staging-smoke-tests.sh

set -euo pipefail

# ────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ────────────────────────────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_FILE="${PROJECT_ROOT}/tests/smoke/dashboard-staging-smoke.test.ts"

# API Configuration (read from environment or use defaults)
API_URL="${API_URL:-https://staging-mmc-api.example.com}"
JWT_TOKEN="${JWT_TOKEN:-}"

# Test Configuration
TEST_TIMEOUT="30000"  # 30 seconds per test
TEST_RETRIES="2"      # Retry failed tests up to 2 times
CONCURRENT_TESTS="4"  # Run 4 tests in parallel

# ────────────────────────────────────────────────────────────────────────
# COLOR OUTPUT
# ────────────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_section() { echo -e "\n${MAGENTA}▸ $1${NC}"; }

# ────────────────────────────────────────────────────────────────────────
# VALIDATION CHECKS
# ────────────────────────────────────────────────────────────────────────

log_section "Pre-test Validation"

# Check test file exists
if [ ! -f "${TEST_FILE}" ]; then
  log_error "Test file not found: ${TEST_FILE}"
  exit 1
fi
log_success "Test file found: $(basename ${TEST_FILE})"

# Check API_URL is accessible
log_info "Checking API endpoint: ${API_URL}"
if ! curl -sf "${API_URL}/health" > /dev/null 2>&1; then
  log_error "API not accessible at ${API_URL}/health"
  log_info "Wait a few minutes for endpoint propagation or check:"
  log_info "  kubectl get ingress -n mmc"
  log_info "  kubectl get svc -n mmc"
  exit 1
fi
log_success "API is accessible"

# Check JWT_TOKEN is set
if [ -z "${JWT_TOKEN}" ]; then
  log_error "JWT_TOKEN environment variable not set"
  log_info "Set it with: export JWT_TOKEN='your-token-here'"
  exit 1
fi
log_success "JWT token configured"

# Check package manager
if command -v bun &> /dev/null; then
  PKG_MANAGER="bun"
elif command -v npm &> /dev/null; then
  PKG_MANAGER="npm"
elif command -v pnpm &> /dev/null; then
  PKG_MANAGER="pnpm"
else
  log_error "No package manager found (bun, npm, or pnpm required)"
  exit 1
fi
log_success "Package manager: ${PKG_MANAGER}"

# ────────────────────────────────────────────────────────────────────────
# TEST DETECTION
# ────────────────────────────────────────────────────────────────────────

log_section "Test Discovery"

# Count test cases
TEST_COUNT=$(grep -c "it('T0" "${TEST_FILE}" || true)
describe_count=$(grep -c "describe(" "${TEST_FILE}" || true)

log_info "Test suite: $(basename ${TEST_FILE})"
log_info "Test cases found: ${TEST_COUNT}"
log_info "Describe blocks: ${describe_count}"

# ────────────────────────────────────────────────────────────────────────
# RUN TESTS
# ────────────────────────────────────────────────────────────────────────

log_section "Running Smoke Tests"

echo ""
log_info "Configuration:"
log_info "  API URL: ${API_URL}"
log_info "  Timeout: ${TEST_TIMEOUT}ms per test"
log_info "  Retries: ${TEST_RETRIES}"
log_info "  Concurrency: ${CONCURRENT_TESTS} parallel"
echo ""

# Export environment for test runner
export API_URL
export JWT_TOKEN
export VITEST_TIMEOUT="${TEST_TIMEOUT}"

# Run tests with vitest
${PKG_MANAGER} test "${TEST_FILE}" \
  --reporter=verbose \
  --reporter=default \
  --run \
  --no-coverage \
  --isolation=true \
  --threads \
  --threads-pool-size="${CONCURRENT_TESTS}" \
  2>&1 | tee staging-test-results.log

TEST_EXIT_CODE=$?

# ────────────────────────────────────────────────────────────────────────
# TEST SUMMARY PARSING
# ────────────────────────────────────────────────────────────────────────

log_section "Test Results Summary"

# Parse results from log file
if [ -f staging-test-results.log ]; then
  # Extract test results
  PASSED=$(grep -c "✓" staging-test-results.log || echo "0")
  FAILED=$(grep -c "✗" staging-test-results.log || echo "0")
  SKIPPED=$(grep -c "⊜" staging-test-results.log || echo "0")
  
  # Try to extract from vitest summary
  if grep -q "Test Files" staging-test-results.log; then
    log_info "Test summary from vitest:"
    grep "Test Files\|Tests\|Duration" staging-test-results.log || true
  fi
fi

# ────────────────────────────────────────────────────────────────────────
# DEPLOYMENT HEALTH REPORT
# ────────────────────────────────────────────────────────────────────────

log_section "Deployment Health Report"

if [ "${TEST_EXIT_CODE}" = "0" ]; then
  # Get current deployment status
  if command -v kubectl &> /dev/null; then
    log_info "Pod status:"
    kubectl get pods -l app=mmc-dashboard -n mmc 2>/dev/null || log_warn "kubectl not available"
    
    log_info "Deployment status:"
    kubectl get deployment mmc-dashboard-api -n mmc 2>/dev/null || log_warn "kubectl not available"
    
    log_info "Service endpoints:"
    kubectl get svc mmc-dashboard-api -n mmc 2>/dev/null || log_warn "kubectl not available"
  fi
fi

# ────────────────────────────────────────────────────────────────────────
# PERFORMANCE METRICS
# ────────────────────────────────────────────────────────────────────────

log_section "Performance Metrics"

log_info "Response time distribution:"
grep "ms)" staging-test-results.log 2>/dev/null | grep -o '[0-9]\+ms' | sort -n | uniq -c || log_warn "No timing data found"

# ────────────────────────────────────────────────────────────────────────
# FINAL VERDICT
# ────────────────────────────────────────────────────────────────────────

echo ""
if [ "${TEST_EXIT_CODE}" = "0" ]; then
  cat << EOF
${GREEN}✅ Staging Smoke Tests PASSED${NC}

All critical systems operational:
  ✓ API connectivity verified
  ✓ Authentication enforced
  ✓ Database connected
  ✓ Cache operational
  ✓ Performance SLAs met (<300ms)
  ✓ Rate limiting active
  ✓ Error handling correct
  ✓ Monitoring/logging functional

Ready for promotion to production 🚀

Next step: scripts/ci/deploy-production.sh (after main branch merge)

Test results saved to: staging-test-results.log

EOF
  log_success "All smoke tests passed"
else
  cat << EOF
${RED}❌ Staging Smoke Tests FAILED${NC}

Review logs above and check:
  1. API endpoint reachability: curl -H "Authorization: Bearer \$JWT_TOKEN" ${API_URL}/api/mmc/dashboard/summary
  2. Pod logs: kubectl logs -f deployment/mmc-dashboard-api -n mmc
  3. Deployment events: kubectl get events -n mmc --sort-by='.lastTimestamp'
  4. Ingress status: kubectl get ingress -n mmc

Test results saved to: staging-test-results.log

DO NOT promote to production until all tests pass.

EOF
  log_error "Some tests failed - see details above"
fi

echo ""
log_info "Full test output: staging-test-results.log"
echo ""

exit "${TEST_EXIT_CODE}"

echo ""
echo "─────────────────────────────────────────────────────────────────────────────"
echo "RESULT"
echo "Status: Script execution successful"
echo "─────────────────────────────────────────────────────────────────────────────"
exit 0
