# Testing Guide — STAGE_13_AFFILIATES (B2B Affiliate Program)

**For:** QA Engineers, Code Reviewers, Deployment Teams  
**Date:** 2026-02-25  
**Status:** BACKEND CLOSED — Ready for Staging Validation

---

## Quick Start

### Prerequisites

- PostgreSQL 14+ running with master_db initialized
- Bun runtime installed
- Git branch: `013-affiliates`

### Run Unit Tests

```bash
# All affiliate tests
npm run test -- tests/unit/affiliates tests/edge-cases/affiliates
# Expected: 91 tests PASSED

# Specific category
npm run test -- tests/unit/affiliates/calculations.test.ts
npm run test -- tests/edge-cases/affiliates/financial-precision.test.ts
```

### Run Full Suite

```bash
npm run test
# Expected: ~1090 tests PASSED (5 failures = pre-existing DB issues, not affiliate-related)
```

### Start Dev Server

```bash
npm run dev:api
# Expected: Server starts on http://localhost:3000
```

---

## Unit Test Coverage (91 Tests)

### Calculations Tests (14 tests)

**File:** `tests/unit/affiliates/calculations.test.ts`

What's tested:

- ✅ Discount calculation: $100 × 15% = $15.00 (NUMERIC precision)
- ✅ Commission calculation: same formula
- ✅ Large amounts: $99,999,999.99 × 0.01% (handles precision edge cases)
- ✅ Fractional cents: 1/3 cent scenarios round to exact 2 decimals
- ✅ Zero percentage (0%)
- ✅ Max percentage (100%)
- ✅ Small percentages: 0.01%, 0.001% (precision maintained)

**run:** `npm run test -- tests/unit/affiliates/calculations.test.ts`

### Validators Tests (33 tests)

**File:** `tests/unit/affiliates/validators.test.ts`

What's tested:

- ✅ **Promo Code Validation:**
  - Valid: `SPRING25`, `EARLYBIRD`, `PROMO123` (uppercase alphanumeric, 3-50 chars)
  - Invalid: `spring25` (lowercase), `PROMO-2024` (hyphen), `PRO` (too short), `A` (repeat 51 times
    = too long)
  - Normalization: input `spring 25` → trimmed → `SPRING25` → validated

- ✅ **Percentage Range Validation:**
  - Valid: 0, 0.01, 15.50, 99.99, 100
  - Invalid: -0.01, 100.01, 150

- ✅ **Date Range Validation:**
  - Valid: `2026-01-01 < 2026-12-31`
  - Invalid: `2026-01-01 >= 2026-01-01`, `2026-12-31 < 2026-01-01`

- ✅ **Usage Limit Validation:**
  - Valid: null (no limit), 0, 1, 1000
  - Invalid: -1, `-999` (negative values)

**run:** `npm run test -- tests/unit/affiliates/validators.test.ts`

### Error Handling Tests (3 tests)

**File:** `tests/unit/affiliates/error-handling.test.ts`

What's tested:

- ✅ Error code → HTTP status mapping
  - `AFFILIATE_CODE_EXPIRED` → 400
  - `AFFILIATE_NOT_FOUND` → 404
  - `AFFILIATE_CONSTRAINT_VIOLATION` → 409
- ✅ Error messages contain actionable information
- ✅ Structured error response format

**run:** `npm run test -- tests/unit/affiliates/error-handling.test.ts`

### Edge-Case: Invalid Inputs (13 tests)

**File:** `tests/edge-cases/affiliates/invalid-inputs.test.ts`

What's tested:

- ✅ Promo code with whitespace: `PROMO` → trimmed → `PROMO` ✅
- ✅ Promo code with tabs/newlines (rejected)
- ✅ Duplicate promo code created (UNIQUE constraint violation → 409 Conflict)
- ✅ Negative base amounts (rejected)
- ✅ Date range start >= end (rejected)
- ✅ Percentage > 100 (rejected)
- ✅ Usage limit -1 (rejected)

**run:** `npm run test -- tests/edge-cases/affiliates/invalid-inputs.test.ts`

### Edge-Case: Temporal Boundaries (8 tests)

**File:** `tests/edge-cases/affiliates/temporal-edge-cases.test.ts`

What's tested:

- ✅ Affiliate at exact `start_date`: VALID ✅
- ✅ Affiliate at exact `end_date`: VALID ✅
- ✅ Affiliate 1 microsecond before `start_date`: INVALID ❌
- ✅ Affiliate 1 microsecond after `end_date`: INVALID ❌
- ✅ Leap year dates: 2024-02-29, 2026-02-28 boundaries
- ✅ DST transition dates (handled correctly by PostgreSQL TIMESTAMP)

**run:** `npm run test -- tests/edge-cases/affiliates/temporal-edge-cases.test.ts`

### Edge-Case: Financial Precision (11 tests)

**File:** `tests/edge-cases/affiliates/financial-precision.test.ts`

What's tested:

- ✅ NUMERIC(12,2) precision maintained across 1000 transactions
- ✅ Rounding: `0.333...` amount → `0.33` (truncated, not rounded up)
- ✅ Very large amounts: `$999,999,999.99 × 0.01%` = correct value
- ✅ Very small percentages: `0.001%` handled without loss
- ✅ Cumulative error test: 1000 fractional-cent transactions → no drift from expected total
- ✅ NUMERIC type vs. IEEE 754 floating-point: ensures determinism

**run:** `npm run test -- tests/edge-cases/affiliates/financial-precision.test.ts`

### Edge-Case: Concurrency & Limits (9 tests)

**File:** `tests/edge-cases/affiliates/edge-cases.test.ts`

What's tested:

- ✅ **Global Usage Limit:**
  - Set limit to 100, create 100 purchases → all succeed
  - 101st purchase → REJECTED with `AFFILIATE_USAGE_LIMIT_EXCEEDED` (400)
  - usage_count = exactly 100 (no partial/phantom updates)

- ✅ **Per-Client Usage Limit:**
  - Set per-client limit to 5
  - Client A: 5 purchases (all succeed), 6th rejected
  - Client B: 5 purchases (independent counter, all succeed)
  - Limits don't bleed across clients

- ✅ **Concurrent Purchases (Race Condition Test):**
  - 50 clients simultaneously purchase with same promo code
  - Expected result: all 50 succeed, usage_count = exactly 50
  - No phantom reads/writes, no double-counting

- ✅ **Transaction Rollback:**
  - Purchase flow hits validation error (e.g., limit exceeded)
  - Entire transaction rolled back
  - usage_count NOT incremented
  - affiliate_usages table has no partial record

---

## Manual API Testing

### 1. Create Affiliate

**Endpoint:** `POST /api/v1/mmc/affiliates`

**Request:**

```bash
curl -X POST http://localhost:3000/api/v1/mmc/affiliates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MMC_JWT_TOKEN>" \
  -d '{
    "promo_code": "SPRING25",
    "discount_percentage": 15.00,
    "commission_percentage": 2.50,
    "usage_limit_total": 1000,
    "usage_limit_per_client": 10,
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "allow_with_other_discounts": false,
    "description": "Spring 2026 promotion"
  }'
```

**Expected Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "promo_code": "SPRING25",
    "discount_percentage": 15.0,
    "commission_percentage": 2.5,
    "usage_limit_total": 1000,
    "usage_limit_per_client": 10,
    "usage_count": 0,
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "status": "ACTIVE",
    "allow_with_other_discounts": false,
    "description": "Spring 2026 promotion",
    "created_at": "2026-02-25T14:40:00Z",
    "updated_at": "2026-02-25T14:40:00Z"
  },
  "error": null
}
```

**Error Cases:**

- Missing token → 401 Unauthorized
- Non-admin user → 403 Forbidden
- Invalid promo code format → 400 Bad Request
- Duplicate promo code → 409 Conflict
- start_date >= end_date → 400 Bad Request

---

### 2. List Affiliates

**Endpoint:** `GET /api/v1/mmc/affiliates?status=ACTIVE&limit=10&offset=0`

**Request:**

```bash
curl -X GET "http://localhost:3000/api/v1/mmc/affiliates?status=ACTIVE&limit=10&offset=0" \
  -H "Authorization: Bearer <MMC_JWT_TOKEN>"
```

**Expected Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "promo_code": "SPRING25",
      "discount_percentage": 15.0,
      "commission_percentage": 2.5,
      "usage_count": 42,
      "status": "ACTIVE",
      "created_at": "2026-02-25T14:40:00Z"
    },
    {
      "id": "uuid-2",
      "promo_code": "EARLYBIRD",
      "discount_percentage": 20.0,
      "commission_percentage": 3.0,
      "usage_count": 156,
      "status": "ACTIVE",
      "created_at": "2026-02-25T14:35:00Z"
    }
  ],
  "error": null
}
```

---

### 3. Edit Affiliate

**Endpoint:** `PATCH /api/v1/mmc/affiliates/:id`

**Request:**

```bash
curl -X PATCH "http://localhost:3000/api/v1/mmc/affiliates/uuid-1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MMC_JWT_TOKEN>" \
  -d '{
    "discount_percentage": 18.00,
    "usage_limit_total": 500
  }'
```

**Expected Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "uuid-1",
    "promo_code": "SPRING25",
    "discount_percentage": 18.0,
    "usage_limit_total": 500,
    "status": "ACTIVE",
    "updated_at": "2026-02-25T14:45:00Z"
  },
  "error": null
}
```

**Error: Immutable Field (400 Bad Request):**

```bash
curl -X PATCH "http://localhost:3000/api/v1/mmc/affiliates/uuid-1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MMC_JWT_TOKEN>" \
  -d '{ "promo_code": "SUMMER25" }'
```

Response:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "IMMUTABLE_FIELD_MODIFICATION",
    "message": "Cannot modify immutable field: promo_code"
  }
}
```

---

### 4. Disable Affiliate

**Endpoint:** `POST /api/v1/mmc/affiliates/:id/disable`

**Request:**

```bash
curl -X POST "http://localhost:3000/api/v1/mmc/affiliates/uuid-1/disable" \
  -H "Authorization: Bearer <MMC_JWT_TOKEN>"
```

**Expected Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "uuid-1",
    "promo_code": "SPRING25",
    "status": "INACTIVE",
    "updated_at": "2026-02-25T14:50:00Z"
  },
  "error": null
}
```

---

### 5. Get Affiliate Usages

**Endpoint:** `GET /api/v1/mmc/affiliates/:id/usages?limit=10&offset=0`

**Request:**

```bash
curl -X GET "http://localhost:3000/api/v1/mmc/affiliates/uuid-1/usages?limit=10" \
  -H "Authorization: Bearer <MMC_JWT_TOKEN>"
```

**Expected Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "usage-uuid-1",
      "affiliate_id": "uuid-1",
      "client_id": "client-uuid-1",
      "license_id": "license-uuid-1",
      "base_amount": "10000.00",
      "discount_amount": "1800.00",
      "commission_amount": "300.00",
      "created_at": "2026-02-25T14:40:00Z"
    }
  ],
  "error": null
}
```

---

## Security Testing Checklist

### Token Validation

- [ ] **Expired Token**: Submit JWT with `exp` in past → 401 Unauthorized
- [ ] **Tampered Signature**: Modify JWT payload or signature → 401 Unauthorized
- [ ] **Wrong Scope**: Submit token without `scope: admin` → 403 Forbidden
- [ ] **Missing Token**: No Authorization header → 401 Unauthorized

**Command:**

```bash
# Expired token (valid signature, but exp is past)
curl -X GET http://localhost:3000/api/v1/mmc/affiliates \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# Expected: 401 Unauthorized
```

### SQL Injection Prevention

- [ ] **Test Payload 1:** Promo code = `'; DROP TABLE affiliates; --`
  - **Expected:** 400 Bad Request (regex validation rejects)

- [ ] **Test Payload 2:** Promo code = `SPRING25' OR 1=1`
  - **Expected:** 400 Bad Request (regex validation rejects)

- [ ] **Test Payload 3:** Description = `"<script>alert(1)</script>"`
  - **Expected:** 200 OK (stored as literal text, never executed in DB context)

**Command:**

```bash
curl -X POST http://localhost:3000/api/v1/mmc/affiliates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <MMC_JWT_TOKEN>" \
  -d '{
    "promo_code": "'\'' DROP TABLE affiliates; --",
    "discount_percentage": 10,
    "commission_percentage": 2,
    "start_date": "2026-01-01",
    "end_date": "2026-12-31"
  }'
# Expected: 400 Bad Request with validation error, never reaches DB
```

### Rate Limiting

- [ ] **Rate Limit Test:** Submit 11 requests in rapid succession to `/api/v1/mmc/affiliates`
  - First 10: 200 OK
  - 11th: 429 Too Many Requests

**Command:**

```bash
for i in {1..11}; do
  curl -X GET http://localhost:3000/api/v1/mmc/affiliates \
    -H "Authorization: Bearer <MMC_JWT_TOKEN>"
  echo "Request $i"
  sleep 0.1
done
# Expected: 10 succeed (200 OK), 11th returns 429
```

### Logging & Redaction

- [ ] **Check Logs:** Run `npm run dev:api`, create affiliate, check console output
- [ ] **Promo Code Redaction:** Logs should show `promo_code: "SPR*"` (not full code)
- [ ] **Token Redaction:** Logs should show `token_id: "abc123", exp: 1234567890` (not full token)
- [ ] **Error Sanitization:** Error logs should NOT expose DB query structure or schema details

**Expected Log Output:**

```
[2026-02-25T14:40:00Z] [app] [INFO] [create_affiliate] affiliate created promo_code=SPR* admin_id=xyz
[2026-02-25T14:40:01Z] [app] [INFO] [validate_token] token_id=abc123 exp=1709865600 scope=admin
```

---

## Staging Deployment Checklist

Before promoting to PRODUCTION READY, validate:

- [ ] **Deployment:** Code deployed to staging environment
- [ ] **Database:** Migrations 009, 010 executed successfully
- [ ] **API Boot:** `/api/v1/mmc/affiliates` endpoint responding
- [ ] **Auth:** MMC token validation working (test with valid + expired tokens)
- [ ] **Rate Limiting:** 10 req/min limit enforced (11th returns 429)
- [ ] **SQL Injection:** All test payloads rejected
- [ ] **Concurrency:** 50 simultaneous purchases → no race conditions
- [ ] **Logging:** Redaction verified in runtime logs
- [ ] **Rollback:** Execute reverse migrations, verify schema restored
- [ ] **Ops Sign-Off:** Confirmed with deployment team

---

## Troubleshooting

### Tests Fail: ECONNREFUSED PostgreSQL

**Issue:** Integration tests connect to DB **Solution:** Start PostgreSQL or skip integration tests

```bash
# Run unit tests only (no DB needed)
npm run test -- tests/unit/affiliates
```

### API Won't Start: Migration Failed

**Issue:** Migration 009/010 didn't execute **Solution:** Check PostgreSQL connection + migrate:

```bash
npm run migrate:master
npm run dev:api
```

### Unit Tests Pass, but Endpoint Returns 404

**Issue:** Routes not registered **Solution:** Verify affiliates-router.ts is imported in app.ts:

```typescript
// In apps/api/src/app.ts
import affiliatesRouter from "./routes/mmc/affiliates-router";
app.use("/api/v1/mmc", affiliatesRouter);
```

### Promo Code Validation Rejects Valid Code

**Issue:** Case sensitivity **Solution:** Input must be uppercase or automatically normalized:

```bash
# This works:
POST {"promo_code": "SPRING25"}

# This also works (normalized):
POST {"promo_code": "spring25"}  # → automatically becomes "SPRING25"

# This fails:
POST {"promo_code": "Spring25"}  # lowercase 's' in middle remains
```

---

## Final Checklist

- [ ] All unit tests passing (91/91)
- [ ] All edge-case tests passing
- [ ] ESLint clean (0 errors)
- [ ] TypeScript clean (affiliate code scope)
- [ ] Dev server boots without errors
- [ ] Manual API tests pass (create, list, edit, disable, usages)
- [ ] Security tests pass (token, SQL injection, rate limiting, logging)
- [ ] Code reviewed by security team
- [ ] Code reviewed by infrastructure team
- [ ] Ready for staging deployment

---

**Questions?** Contact DevOps or Security team for staging environment access and deployment
procedures.
