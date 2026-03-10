# Testing Guide: STAGE_10_LICENSES (Licenses Management)

**Stage:** STAGE_10_LICENSES  
**Phase:** 02_PLATFORM_MMC  
**Version:** 1.0  
**Date:** 2026-02-22

---

## Overview

This testing guide covers comprehensive verification of the Licenses Management feature. The feature
includes:

- License provisioning and lifecycle management
- Soft-lock grace period enforcement (90 days)
- Multi-workspace isolation
- RBAC authorization for MMC admins
- Idempotent background job processing
- Snapshot-based versioning and rollback protection

**Testing Scope:** 14 critical P1/P2 test scenarios + 87 scaffolded test cases  
**Estimated Time:** 2-3 hours (full suite)  
**Prerequisites:** PostgreSQL local, Redis local, test database seeded

---

## Test Environment Setup

### Database Preparation

```bash
# Reset test databases
npm run test:reset-db

# Verify master_db and tenant databases exist
psql -U postgres -l | grep -E "master_db|tenant_"

# Check license table schema
psql master_db -c "\d licenses"
psql tenant_default -c "\d licenses"
```

### Prerequisites

- Node.js v20+ (Bun v1+)
- PostgreSQL 15+
- Redis 7+ (local)
- `.env.test` configured with:
  ```
  POSTGRES_HOST=localhost
  POSTGRES_PORT=5432
  REDIS_HOST=localhost
  REDIS_PORT=6379
  ```

---

## Quick Start: Run All Tests

```bash
# Run full test suite (all 14 critical + scaffolding)
npm run test:licenses

# Run specific test file
npm run test -- tests/unit/license-rbac.test.ts

# Run with coverage
npm run test:coverage -- tests/integration/

# Watch mode (for development)
npm run test:watch
```

---

## 🎯 Critical Test Scenarios (Must Pass)

### Tier 1: RBAC & Authorization (3 tests)

#### Test 1.1: Student Cannot Create License

**File:** `tests/unit/license-rbac.test.ts`  
**Status:** ✅ Implemented (no longer `.skip()`)

**What it tests:** Authorization layer prevents non-MMC users from creating licenses

**Expected Behavior:**

- Student user calls: `POST /v1/mmc/licenses`
- Response: `401 UNAUTHORIZED`
- Message: "Only MMC administrators can create licenses"

**Manual Verification:**

```bash
# As student user:
curl -X POST http://localhost:3000/v1/mmc/licenses \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id": "product-123", "workspace_slug": "acme"}'

# Expected: 401 with error code: LICENSE_CREATION_UNAUTHORIZED
```

**Pass Criteria:** Status code 401, no license created

---

#### Test 1.2: Institution Admin Cannot Create License

**File:** `tests/unit/license-rbac.test.ts`  
**Status:** ✅ Implemented

**What it tests:** RBAC prevents institution admins (non-MMC) from creating licenses

**Expected Behavior:**

- Institution admin calls: `POST /v1/mmc/licenses`
- Response: `403 FORBIDDEN`
- Message: "Insufficient permissions"

**Manual Verification:**

```bash
curl -X POST http://localhost:3000/v1/mmc/licenses \
  -H "Authorization: Bearer $INSTITUTION_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id": "product-123", "workspace_slug": "test-org"}'

# Expected: 403 with error code: INSUFFICIENT_PERMISSIONS
```

**Pass Criteria:** Status code 403, no license created

---

#### Test 1.3: MMC Admin Can Create License

**File:** `tests/unit/license-rbac.test.ts`  
**Status:** ✅ Implemented

**What it tests:** RBAC allows MMC admins to create licenses

**Expected Behavior:**

- MMC admin calls: `POST /v1/mmc/licenses`
- Response: `201 CREATED`
- Body: License object with status `PENDING_PROVISION`

**Manual Verification:**

```bash
curl -X POST http://localhost:3000/v1/mmc/licenses \
  -H "Authorization: Bearer $MMC_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "product-pro",
    "workspace_slug": "acme-corp",
    "student_limit": 500,
    "staff_limit": 50,
    "language": "en"
  }'

# Expected: 201 with license object, status: PENDING_PROVISION
```

**Pass Criteria:** Status code 201, license created with PENDING_PROVISION status

---

### Tier 2: Provisioning Worker (3+ tests)

#### Test 2.1: Provisioning with Database Timeout and Retry

**File:** `tests/integration/provisioning-failure.test.ts`  
**Status:** ✅ Implemented

**What it tests:** Worker retries after database timeout with exponential backoff

**Expected Behavior:**

- Provision job times out on attempt 1
- Retries with backoff: 2s, 4s, 8s, 16s, 32s (total 62s budget)
- Eventually succeeds on attempt 3-5

**Sequence Flow:**

```
1. License created with status PENDING_PROVISION
2. Worker jobs enqueued
3. Job attempt 1: DB timeout → FAIL (retry in 2s)
4. Job attempt 2: DB timeout → FAIL (retry in 4s)
5. Job attempt 3: SUCCESS → License status ACTIVE
6. DLQ: Empty (not needed)
```

**Manual Verification:**

```bash
# Enable database timeout simulation in config
export SIMULATE_DB_TIMEOUT=true
export TIMEOUT_UNTIL_ATTEMPT=2

npm run test -- tests/integration/provisioning-failure.test.ts

# Check worker logs for retry attempts
# Should see: "provisioning_handler: retry attempt 1", "attempt 2", etc.
```

**Pass Criteria:**

- Job retries exactly 2-3 times
- Status transitions to ACTIVE after success
- No DLQ entries

---

#### Test 2.2: Transient Failure Retry (Connection Refused)

**File:** `tests/integration/provisioning-failure.test.ts`  
**Status:** ✅ Implemented

**What it tests:** Worker handles transient network failures

**Expected Behavior:**

- Provision job: Connection refused on first attempt
- Retries immediately
- Succeeds on second attempt

**Manual Verification:**

```bash
# Simulate network issue for first attempt
npm run test -- tests/integration/provisioning-failure.test.ts --scenario=connection-refused

# Monitor worker logs for:
# "Connection refused" → "Retrying..." → "Success"
```

**Pass Criteria:**

- License eventually reaches ACTIVE status
- Only 1 retry needed (not all 5)

---

#### Test 2.3: Idempotency via job_id Deduplication

**File:** `tests/integration/provisioning-failure.test.ts`  
**Status:** ✅ Implemented

**What it tests:** Duplicate job submissions create only one license

**Expected Behavior:**

- Submit same provision job twice (same job_id)
- Only ONE license is created
- Second submission returns ALREADY_PROCESSED

**Manual Verification:**

```bash
# Create two identical provision requests with same job_id
curl -X POST http://localhost:3000/v1/mmc/licenses \
  -H "Authorization: Bearer $MMC_TOKEN" \
  -H "X-Job-ID: job-12345" \
  -d '{...license data...}'

curl -X POST http://localhost:3000/v1/mmc/licenses \
  -H "Authorization: Bearer $MMC_TOKEN" \
  -H "X-Job-ID: job-12345" \
  -d '{...same data...}'

# First response: 201 CREATED
# Second response: 409 CONFLICT with code: DUPLICATE_PROVISION_REQUEST
```

**Pass Criteria:**

- Exactly 1 license in database
- Second request returns 409 CONFLICT
- Both return same license_id in response

---

### Tier 3: Soft-Lock Grace Period (4 tests)

#### Test 3.1: Lazy Soft-Lock Expiration (On Request)

**File:** `tests/integration/license-soft-lock.test.ts`  
**Status:** ✅ Implemented

**What it tests:** Soft-lock expiration is evaluated on request, not cron

**Expected Behavior:**

- License soft-locked with grace until: 2026-02-25 10:00:00Z
- Request at 2026-02-25 09:59:59Z: License is SOFT_LOCKED (still valid)
- Request at 2026-02-25 10:00:01Z: License is ARCHIVED (expired)
- No background cron job runs

**Manual Verification:**

```bash
npm run test -- tests/integration/license-soft-lock.test.ts --scenario=lazy-expiration

# Check logs:
# "Evaluated soft_lock_until: 2026-02-25T10:00:00Z"
# "Current time: 2026-02-25T09:59:59Z"
# "Status: SOFT_LOCKED (within grace)"
```

**Pass Criteria:**

- Expiration only checked on request (not background job)
- Accurate boundary evaluation (>= NOT >)
- No cron logs in output

---

#### Test 3.2: Boundary Condition: NOT at Exactly soft_lock_until

**File:** `tests/integration/license-soft-lock.test.ts`  
**Status:** ✅ Implemented

**What it tests:** Exact equality doesn't trigger expiration

**Expected Behavior:**

- Soft-lock until: 2026-02-25 10:00:00Z (exactly)
- Request at 2026-02-25 10:00:00Z: License is SOFT_LOCKED (NOT expired)
- Request at 2026-02-25 10:00:01Z: License is ARCHIVED (expired)

**Manual Verification:**

```bash
npm run test -- tests/integration/license-soft-lock.test.ts --scenario=boundary-exact

# SQL should execute:
# SELECT status FROM licenses
# WHERE NOW() > soft_lock_until AND status = 'SOFT_LOCKED'
# (Note: > not >=)
```

**Pass Criteria:**

- Exact timestamp does NOT trigger expiration
- Only > (strictly greater) triggers transition

---

#### Test 3.3: Immediate Transition 1ms After Expiration

**File:** `tests/integration/license-soft-lock.test.ts`  
**Status:** ✅ Implemented

**What it tests:** Grace period expires immediately after boundary

**Expected Behavior:**

- At: 2026-02-25 10:00:00.000Z → SOFT_LOCKED
- At: 2026-02-25 10:00:00.001Z → ARCHIVED (immediately)

**Manual Verification:**

```bash
npm run test -- tests/integration/license-soft-lock.test.ts --scenario=immediate-transition

# Logs should show:
# T+0ms: SOFT_LOCKED
# T+1ms: ARCHIVED
# No delay needed
```

**Pass Criteria:**

- Transition happens immediately (not deferred)
- No sleep/delay processing

---

#### Test 3.4: Concurrent Requests at Grace Boundary

**File:** `tests/integration/license-soft-lock.test.ts`  
**Status:** ✅ Implemented

**What it tests:** SELECT FOR UPDATE prevents race conditions near grace boundary

**Expected Behavior:**

- 10 concurrent requests at grace boundary (T+0.5ms mark)
- All read same license
- Only ONE transitions to ARCHIVED
- All other requests see ARCHIVED status (not multiple transitions)

**Manual Verification:**

```bash
npm run test -- tests/integration/license-soft-lock.test.ts --scenario=concurrent-race

# Logs should show:
# [Request 1] SELECT FOR UPDATE... ARCHIVED
# [Request 2-10] SELECT FOR UPDATE... returns ARCHIVED
# Database logs: Exactly 1 UPDATE statement executed
```

**Pass Criteria:**

- Exactly 1 UPDATE executed (not 10)
- All concurrent requests see consistent state
- No duplicate transitions

---

### Tier 4: Limits & Enforcement (4 tests)

#### Test 4.1: Update Student Limit via PATCH

**File:** `tests/integration/license-limits-api.test.ts`  
**Status:** ✅ Implemented

**What it tests:** API allows MMC admin to update license limits

**Expected Behavior:**

- License created with student_limit: 500
- MMC admin executes: `PATCH /licenses/:id` with student_limit: 1000
- Response: 200 OK, license updated

**Manual Verification:**

```bash
curl -X PATCH http://localhost:3000/v1/mmc/licenses/lic-123 \
  -H "Authorization: Bearer $MMC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"student_limit": 1000}'

# Expected: 200 OK, student_limit now 1000
```

**Pass Criteria:** Status 200, student_limit updated

---

#### Test 4.2: Immutability Enforcement (Prevent product_id Update)

**File:** `tests/integration/license-limits-api.test.ts`  
**Status:** ✅ Implemented

**What it tests:** product_id cannot be changed after creation

**Expected Behavior:**

- Try to PATCH license with different product_id
- Response: 409 CONFLICT
- Error: "Cannot modify immutable field: product_id"

**Manual Verification:**

```bash
curl -X PATCH http://localhost:3000/v1/mmc/licenses/lic-123 \
  -H "Authorization: Bearer $MMC_TOKEN" \
  -d '{"product_id": "different-product"}'

# Expected: 409 CONFLICT
```

**Pass Criteria:** Status 409, product_id unchanged

---

#### Test 4.3: Enforce student_limit on User Creation

**File:** `tests/integration/license-limits-api.test.ts`  
**Status:** ✅ Implemented

**What it tests:** License limit enforces user creation within workspace

**Expected Behavior:**

- License has student_limit: 5
- Create 5 students in workspace: OK
- Create 6th student: 409 CONFLICT with error "STUDENT_LIMIT_EXCEEDED"

**Manual Verification:**

```bash
# Create license with limit=5
LICENSE=$(curl -X POST /v1/mmc/licenses -d '{"student_limit": 5}')

# Create 5 students
for i in {1..5}; do
  curl -X POST /v1/$WORKSPACE/students \
    -d "{\"user_id\": \"student-$i\"}"
done
# All: 201 Created

# Create 6th
curl -X POST /v1/$WORKSPACE/students \
  -d '{"user_id": "student-6"}'
# Expected: 409 CONFLICT with STUDENT_LIMIT_EXCEEDED
```

**Pass Criteria:** 5 success (201), 6th fails (409)

---

#### Test 4.4: Concurrency Safety Under Concurrent Creates

**File:** `tests/integration/license-limits-api.test.ts`  
**Status:** ✅ Implemented

**What it tests:** Concurrent creates respect limit boundary atomically

**Expected Behavior:**

- License limit: 2 students
- 5 concurrent create requests (all start simultaneously)
- Database: Exactly 2 increments succeed
- Remaining 3: 409 CONFLICT

**Manual Verification:**

```bash
npm run test -- tests/integration/license-limits-api.test.ts --scenario=concurrent-creates

# Database should record:
# CREATE requests: 5
# Success: 2 (current_count = 2)
# Conflict: 3 (409 responses)
# Final count: exactly 2
```

**Pass Criteria:**

- Exactly 2 successes (not more)
- Exactly 3 conflicts
- Final count = 2 (not 5)

---

## 🧪 Running Test Suites

### Core Unit Tests

```bash
# RBAC Authorization Tests
npm run test -- tests/unit/license-rbac.test.ts

# Expected output:
# ✓ Student cannot create license (401)
# ✓ Institution admin cannot create license (403)
# ✓ MMC admin can create license (201)
# Tests: 3 passed
```

### Integration Tests

```bash
# Provisioning Workflow Tests
npm run test -- tests/integration/provisioning-failure.test.ts

# Soft-Lock Grace Period Tests
npm run test -- tests/integration/license-soft-lock.test.ts

# Limits Validation Tests
npm run test -- tests/integration/license-limits-api.test.ts

# Expected: All 14+ tests pass (no `.skip()`)
```

### Full Test Suite

```bash
# Run all license tests
npm run test:licenses

# Expected: 14+ critical tests pass, 87 scaffolded tests defined
```

---

## 🔍 Key Validation Points

### Multi-Tenant Isolation

**Test:** Create licenses in workspace A and workspace B

```bash
# Workspace A
curl -X POST /v1/mmc/licenses \
  -d '{"workspace_slug": "org-a", "product_id": "product-123"}'

# Workspace B
curl -X POST /v1/mmc/licenses \
  -d '{"workspace_slug": "org-b", "product_id": "product-123"}'

# Verify: Query workspace A database should NOT see org-b license
psql org_a_tenant_db -c "SELECT id FROM licenses WHERE workspace_slug='org-b'"
# Expected: 0 rows (org-b data physically separate)
```

### API Response Format (RFC 7807)

**Test:** Verify all error responses follow RFC 7807

```bash
# Make request that fails
curl -X POST /v1/mmc/licenses \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{...}'

# Expected response structure:
{
  "success": false,
  "data": null,
  "error": {
    "code": "LICENSE_CREATION_UNAUTHORIZED",
    "message": "Only MMC administrators can create licenses",
    "details": "Student user cannot provision licenses"
  }
}
```

**Pass Criteria:** All errors return this exact format

---

## 📊 Test Results Checklist

After running full test suite, verify:

- [ ] Unit Tests Pass: 3/3 RBAC tests pass
- [ ] Provisioning Tests Pass: 3+ provisioning scenarios pass
- [ ] Soft-Lock Tests Pass: 4/4 grace period tests pass
- [ ] Limits Tests Pass: 4/4 limit enforcement tests pass
- [ ] No `.skip()` Markers: All 14 critical tests executable
- [ ] Coverage: >80% of production code
- [ ] Error Codes: All 14 codes properly used
- [ ] RFC 7807 Format: All errors comply
- [ ] Logging: Correlation IDs in all logs
- [ ] Database: No cross-tenant data visible
- [ ] Transactions: All multi-statement operations ACID

---

## 🚀 Common Test Commands

```bash
# Run tests matching pattern
npm run test -- --grep "soft-lock"

# Run single test file with verbose output
npm run test -- tests/integration/license-soft-lock.test.ts --reporter=verbose

# Run with code coverage
npm run test:coverage

# Watch mode (re-run on file change)
npm run test:watch

# Debug mode (pause at breakpoints)
node --inspect-brk node_modules/.bin/vitest run
```

---

## 🐛 Troubleshooting

### Test: "Cannot connect to PostgreSQL"

```bash
# Verify PostgreSQL running
psql -U postgres -c "SELECT 1"

# Reset test databases
npm run test:reset-db

# Retry test
npm run test
```

### Test: "License not found in database"

```bash
# Ensure tenant database selected correctly
echo $TEST_WORKSPACE_SLUG

# Check master_db has license record
psql master_db -c "SELECT id, workspace_slug FROM licenses LIMIT 5"

# Check tenant database has license record
psql ${TEST_WORKSPACE_SLUG}_tenant_db -c "SELECT id FROM licenses"
```

### Test: "Job not retrying"

```bash
# Check Redis connection
redis-cli ping

# Verify worker running
ps aux | grep worker

# Check worker logs
npm run worker:dev 2>&1 | grep -i "provisioning\|retry"
```

---

## 📚 Additional Resources

- **Full Specification:** `specs/runtime/010-licenses-management/reports/SPECIFY_REPORT.md`
- **Architecture Plan:** `specs/runtime/010-licenses-management/reports/PLAN_REPORT.md`
- **Implementation Report:** `specs/runtime/010-licenses-management/reports/IMPLEMENT_REPORT.md`
- **Test Scaffolding:** `tests/integration/license-*.test.ts` (87 scenarios)

---

**Generated:** 2026-02-22  
**Stage:** STAGE_10_LICENSES (Production Ready)  
**Test Status:** ✅ All 14 critical tests implemented and passing
