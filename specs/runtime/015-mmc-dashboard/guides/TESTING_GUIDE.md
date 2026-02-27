# MMC Dashboard — Testing Guide for QA & Developers

**Date:** February 27, 2026  
**Stage:** MMC Dashboard (STAGE_15_MMC_DASHBOARD)  
**Status:** Production Ready  
**Test Coverage:** 833 tests passing (100%)

---

## Overview

This guide provides step-by-step testing procedures for the MMC Dashboard feature. All backend infrastructure has been implemented and tested in Phases 0-2. This guide is intended for:

- QA engineers validating production readiness
- Frontend developers integrating API responses
- Operations team monitoring deployment

---

## Quick Start: Running the Test Suite

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (master_db with schema version ≥ 8)
- Redis 7.0+
- Bun package manager

### Setup

```bash
# Install dependencies
bun install

# Start test database
npm run dev:test-db

# Run full test suite
npm run test:mmc

# Or specific test tier
npm run test:unit -- mmc/
npm run test:integration -- mmc/
npm run test:performance -- mmc-dashboard/
```

---

## Manual Testing Procedures

### 1. Environment Validation

**Objective:** Verify database schema and connection health

**Steps:**

1. Check schema version in master_db:

   ```sql
   SELECT schema_version FROM schema_meta WHERE db_type = 'master';
   -- Expected: ≥ 8
   ```

2. Verify dashboard indexes exist:

   ```sql
   \d indexes -- List all indexes
   -- Expected: idx_licenses_status, idx_revenue_records_created_at, etc.
   ```

3. Check test data is seeded:
   ```sql
   SELECT COUNT(*) FROM licenses; -- Expected: 1000
   SELECT COUNT(*) FROM revenue_records; -- Expected: 100
   SELECT COUNT(*) FROM affiliates; -- Expected: 20
   ```

**Expected Outcome:** ✅ All queries return expected counts

---

### 2. Middleware Chain Validation

**Objective:** Verify middleware executes in correct order

**Steps:**

1. **License Middleware Test**
   - Create a soft-locked workspace license
   - Call GET /api/mmc/dashboard/summary without auth
   - Expected: 403 (permission denied first)
   - Call with auth but soft-locked license
   - Expected: 423 LICENSE_LOCKED

2. **Permission Middleware Test**
   - Call GET /api/mmc/dashboard/summary with user missing `reporting.view` role
   - Expected: 403 PERMISSION_DENIED
   - Add `reporting.view` role
   - Expected: 200 OK

3. **Schema Version Middleware Test**
   - Manually downgrade schema_version in master_db to 6
   - Call any dashboard endpoint
   - Expected: 426 SCHEMA_INCOMPATIBLE
   - Upgrade schema_version back to 8+
   - Expected: 200 OK

4. **Rate Limiting Middleware Test (CRITICAL)**
   - Call POST /api/mmc/dashboard/export 100 times rapidly
   - Expected: First 100 return 200 OK
   - Call 101st time
   - Expected: 429 TOO_MANY_REQUESTS
   - Call other endpoints 1000 times rapidly
   - Expected: First 1000 return 200 OK
   - Expected: 1001st returns 429

---

### 3. Endpoint Testing

#### 3.1 GET /api/mmc/dashboard/summary

**Objective:** Verify summary endpoint returns correct structure and caching behavior

**Test Case 1: Basic Call**

```bash
curl -X GET \
  http://localhost:3000/api/mmc/dashboard/summary \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "X-Workspace-Slug: test-workspace"
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "licenses": {
      "active": 750,
      "soft_locked": 200,
      "archived": 50
    },
    "revenue": {
      "this_month": 45000.0,
      "this_year": 180000.0,
      "last_month": 42000.0
    },
    "timestamp": "2026-02-27T14:50:00Z"
  },
  "error": null
}
```

**Expected Status:** 200 OK  
**Expected Headers:**

- `X-Cache: HIT` (if called within 5 minutes)
- `X-Cache: MISS` (first call)

**Test Case 2: Cache Validation**

- Call endpoint, note timestamp
- Call again immediately (within 5 seconds)
- Expected: Same data, X-Cache: HIT header
- Wait 5+ minutes
- Call again
- Expected: Fresh data, X-Cache: MISS header

**Test Case 3: Permission Denied**

- Call without `reporting.view` role
- Expected: 403 PERMISSION_DENIED

**Performance Validation:**

- Response time should be <150ms on cache HIT
- Response time should be <200ms on cache MISS

---

#### 3.2 GET /api/mmc/dashboard/revenue-breakdown

**Objective:** Verify revenue breakdown returns TOP 5 products with growth %

**Test Call:**

```bash
curl -X GET \
  "http://localhost:3000/api/mmc/dashboard/revenue-breakdown?date_from=2026-01-01&date_to=2026-02-27" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "X-Workspace-Slug: test-workspace"
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "product_id": "prod_001",
        "name": "Product A",
        "revenue": 50000.00,
        "growth_percent": 12.5,
        "license_count": 250
      },
      ...
    ],
    "timestamp": "2026-02-27T14:50:00Z"
  },
  "error": null
}
```

**Validations:**

- TOP 5 products by revenue ✅
- All revenue values have 2-decimal precision ✅
- growth_percent calculated correctly ✅
- No caching (fresh query every call) ✅
- Response time <300ms ✅

**Test Edge Cases:**

- Call with future date_to: Expected 400 INVALID_REQUEST
- Call with date_to < date_from: Expected 400 INVALID_REQUEST
- Call with no data in date range: Expected 200 OK, empty products

---

#### 3.3 GET /api/mmc/dashboard/geographic

**Objective:** Verify geographic data grouped by country with sorting

**Test Call:**

```bash
curl -X GET \
  "http://localhost:3000/api/mmc/dashboard/geographic?sort_by=revenue&limit=10" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "X-Workspace-Slug: test-workspace"
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "countries": [
      {
        "country_code": "US",
        "country_name": "United States",
        "revenue": 120000.00,
        "license_count": 600,
        "avg_revenue_per_license": 200.00
      },
      ...
    ],
    "timestamp": "2026-02-27T14:50:00Z"
  },
  "error": null
}
```

**Validations:**

- Grouped by country ✅
- Sorted by revenue (descending) or license_count ✅
- Limited to 10 results ✅
- All currency values are 2-decimal precision ✅

**Test Sorting:**

- sort_by=revenue: Verify descending order ✅
- sort_by=license_count: Verify descending order ✅
- limit=1: Return only top country ✅
- limit=100: Return up to 100 countries ✅

---

#### 3.4 GET /api/mmc/dashboard/affiliates

**Objective:** Verify affiliate leaderboard with pagination and filtering

**Test Call:**

```bash
curl -X GET \
  "http://localhost:3000/api/mmc/dashboard/affiliates?page=1&page_size=10&status=ACTIVE" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "X-Workspace-Slug: test-workspace"
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "affiliates": [
      {
        "affiliate_id": "aff_001",
        "name": "Top Affiliate",
        "commission_this_month": 5000.00,
        "usage_count": 150,
        "status": "ACTIVE"
      },
      ...
    ],
    "pagination": {
      "page": 1,
      "page_size": 10,
      "total_count": 20,
      "has_next": true
    },
    "timestamp": "2026-02-27T14:50:00Z"
  },
  "error": null
}
```

**Validations:**

- Paginated correctly (page 1 = 0-9 items) ✅
- Status filtering (ACTIVE/INACTIVE/ALL) ✅
- Pagination metadata accurate ✅
- Cache hit for repeated calls (1-min TTL) ✅

**Test Pagination:**

- page=1, page_size=10: Return items 0-9 ✅
- page=2, page_size=10: Return items 10-19 ✅
- page=3 (out of bounds): Expected 200 OK but empty affiliates array ✅

---

#### 3.5 GET /api/mmc/dashboard/trends

**Objective:** Verify monthly trending data with configurable time window

**Test Call:**

```bash
curl -X GET \
  "http://localhost:3000/api/mmc/dashboard/trends?months=6&metric=revenue" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "X-Workspace-Slug: test-workspace"
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "trend_data": [
      { "month": "2025-09-01", "revenue": 30000.00, "license_count": 500 },
      { "month": "2025-10-01", "revenue": 32000.00, "license_count": 520 },
      ...
    ],
    "summary": {
      "total_revenue": 185000.00,
      "avg_growth_percent": 3.5,
      "license_growth_trend": "UPWARD"
    },
    "timestamp": "2026-02-27T14:50:00Z"
  },
  "error": null
}
```

**Validations:**

- months parameter (3|6|12) supported ✅
- 6 months = 6 data points ✅
- All revenue values 2-decimal precision ✅
- Cache hit for repeated calls (10-min TTL) ✅

**Test Time Windows:**

- months=3: Return last 3 months ✅
- months=6: Return last 6 months ✅
- months=12: Return last 12 months ✅
- months=99 (invalid): Expected 400 INVALID_REQUEST ✅

---

#### 3.6 POST /api/mmc/dashboard/export

**Objective:** Verify CSV export with streaming and size limits

**Test Call:**

```bash
curl -X POST \
  http://localhost:3000/api/mmc/dashboard/export \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "X-Workspace-Slug: test-workspace" \
  -H "Content-Type: application/json" \
  -d '{"section":"geographic","include_timestamp":true}' \
  --output export.csv
```

**Expected CSV Format:**

```
"Country Code","Country Name","Revenue","License Count","Avg Revenue per License","Exported At"
"US","United States","120000.00","600","200.00","2026-02-27T14:50:00Z"
"CA","Canada","45000.00","225","200.00","2026-02-27T14:50:00Z"
...
```

**Validations:**

- CSV header row present ✅
- UTF-8 BOM present (check file starts with EF BB BF) ✅
- All currency values 2-decimal precision ✅
- Timestamps in ISO 8601 format ✅
- Response streaming (not fully buffered in memory) ✅

**Test Size Limits (CRITICAL):**

- Export 50,000 rows: Expected 200 OK ✅
- Seed 51,000 rows, attempt export: Expected 413 PAYLOAD_TOO_LARGE ✅

**Test Timeout:**

- Monitor export duration
- Expected completion time <2 seconds (hard timeout) ✅
- If timeout triggers: Expected 408 REQUEST_TIMEOUT ✅

---

### 4. Error Handling Tests

**Objective:** Verify all error codes are returned correctly with proper envelope

#### Test 400 INVALID_REQUEST

```bash
# Missing required parameter
curl -X GET \
  "http://localhost:3000/api/mmc/dashboard/revenue-breakdown" \
  -H "Authorization: Bearer <JWT_TOKEN>"
# Expected: 400, error.code = INVALID_REQUEST
```

#### Test 403 PERMISSION_DENIED

```bash
# User without reporting.view
curl -X GET \
  "http://localhost:3000/api/mmc/dashboard/summary" \
  -H "Authorization: Bearer <INVALID_ROLE_JWT>"
# Expected: 403, error.code = PERMISSION_DENIED
```

#### Test 408 REQUEST_TIMEOUT

```bash
# Export beyond 2-second timeout (manual test - seed 100k records)
curl -X POST \
  http://localhost:3000/api/mmc/dashboard/export \
  --max-time 3
# Expected: 408 (or timeout connection)
```

#### Test 413 PAYLOAD_TOO_LARGE

```bash
# Seed 51,000 records, then export
curl -X POST \
  http://localhost:3000/api/mmc/dashboard/export \
  -d '{"section":"geographic"}'
# Expected: 413, error.code = PAYLOAD_TOO_LARGE
```

#### Test 423 LICENSE_LOCKED

```bash
# Soft-lock workspace license
UPDATE licenses SET status = 'SOFT_LOCKED' WHERE workspace_id = '<test_id>';

curl -X GET \
  "http://localhost:3000/api/mmc/dashboard/summary" \
  -H "Authorization: Bearer <JWT_TOKEN>"
# Expected: 423, error.code = LICENSE_LOCKED
```

#### Test 426 SCHEMA_INCOMPATIBLE

```bash
# Downgrade schema version
UPDATE schema_meta SET schema_version = 6 WHERE db_type = 'master';

curl -X GET \
  "http://localhost:3000/api/mmc/dashboard/summary" \
  -H "Authorization: Bearer <JWT_TOKEN>"
# Expected: 426, error.code = SCHEMA_INCOMPATIBLE
```

#### Test 429 RATE_LIMIT_EXCEEDED

```bash
# Hit rate limit
for i in {1..101}; do
  curl -X POST \
    "http://localhost:3000/api/mmc/dashboard/export" \
    -H "Authorization: Bearer <JWT_TOKEN>" &
done

# Request #101 expected: 429, error.code = RATE_LIMIT_EXCEEDED
# Headers include X-RateLimit-Remaining: 0
```

---

### 5. Performance Validation

| Test                             | Expected           | Validation                      |
| -------------------------------- | ------------------ | ------------------------------- |
| Concurrent 100 users to /summary | <150ms avg         | ✅ Load test suite              |
| Concurrent 100 users to /export  | <300ms avg         | ✅ Streaming validates this     |
| Cache hit ratio                  | >70% overall       | ✅ Check logs, monitor hit rate |
| Query execution                  | 0 sequential scans | ✅ EXPLAIN ANALYZE (T029)       |
| Response memory                  | <5MB per request   | ✅ Monitor RSS during load      |

---

### 6. Database Isolation Tests (CRITICAL)

**Objective:** Verify no queries access tenant databases

**Test Procedure:**

1. Start test with error injection on tenantDbPool
2. All 6 endpoints should succeed without accessing tenant DB
3. Check logs for correlation_id - should see only master_db queries

**Expected:** All endpoints use only master_db, zero tenant DB hits

---

### 7. Logging & Audit Validation

**Objective:** Verify structured logs contain required fields

**Test Call:**

```bash
# Call endpoint and inspect logs
curl -X GET \
  "http://localhost:3000/api/mmc/dashboard/summary" \
  -H "Authorization: Bearer <JWT_TOKEN>"

# Expected logs should contain:
# - DASHBOARD_REQUEST_START: timestamp, correlation_id, user_id, workspace_id
# - PERMISSION_CHECK_PASS: timestamp, correlation_id, user_id, permission_required
# - DASHBOARD_QUERY_EXECUTED: timestamp, correlation_id, query_type, response_time_ms
# - RESPONSE_SENT: timestamp, correlation_id, response_status, response_time_ms, cache_hit
```

**Validations:**

- All events include correlation_id ✅
- All events include user_id and workspace_id ✅
- No PII in logs ✅
- response_time_ms recorded for each step ✅

---

## Automated Test Execution

### Run Full Test Suite

```bash
npm run test:mmc
```

### Run Unit Tests Only

```bash
npm run test:unit -- mmc/
# Expected: 416 tests pass, 0 failures
```

### Run Integration Tests Only

```bash
npm run test:integration -- mmc/
# Expected: 339 tests pass, 0 failures
```

### Run Performance Tests Only

```bash
npm run test:performance -- mmc-dashboard/
# Expected: 78 tests pass, latencies <300ms
```

### Generate Coverage Report

```bash
npm run test:coverage -- mmc/
# Expected: >90% coverage for metrics, >85% for endpoints
```

---

## Load Testing (Optional for Staging)

### Setup Load Test

```bash
# Install k6 if not present
npm install -D k6

# Run 100 concurrent users for 2 minutes
k6 run tests/load/dashboard-load.js \
  -e BASE_URL=http://localhost:3000 \
  -e VUS=100 \
  -e DURATION=120s
```

### Expected Results

- Request success rate: >99%
- Average latency: <150ms
- P95 latency: <300ms
- No error spikes
- Cache hit rate: >70%

---

## Production Readiness Checklist

- [ ] All 833 automated tests passing
- [ ] Average latency <150ms (manual load test)
- [ ] P99 latency <300ms (manual load test)
- [ ] Cache hit rate >70%
- [ ] Database isolation verified (no tenant DB access)
- [ ] Rate limiting enforced (export 100/hr, others 1000/hr)
- [ ] Error handling tested (all 7 codes)
- [ ] Logging validated (correlation IDs, no PII)
- [ ] Performance baseline documented
- [ ] QA signoff obtained

---

## Support & Escalation

**Issues or Questions?**

- Check logs for correlation_id to trace requests
- Review PHASE_2_TESTING_SUMMARY.md for detailed test results
- Refer to CLOSURE_REPORT.md for architecture overview

**Performance Degradation?**

- Check cache hit rate (should be >70%)
- Verify indexes are present: `\d indexes` in master_db
- Review query plans: `EXPLAIN ANALYZE` on slowest queries

**Authorization Failures?**

- Verify user has reporting.view role
- Check workspace license status (not SOFT_LOCKED)
- Confirm schema_version ≥ 8

---

**Testing Guide Version:** 1.0  
**Last Updated:** February 27, 2026  
**Status:** Production Ready
