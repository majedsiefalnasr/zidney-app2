# QA Audit Summary: Licenses Management

**VERDICT: 🔴 BLOCKED**

---

## Coverage by Criteria

| #   | Criterion               | Status     | Coverage | Risk     |
| --- | ----------------------- | ---------- | -------- | -------- |
| 1   | Tenant Isolation Tests  | ✅ PASS    | 100%     | LOW      |
| 2   | RBAC Validation         | 🔴 BLOCKED | 25%      | HIGH     |
| 3   | License Lifecycle       | 🟡 PARTIAL | 75%      | MEDIUM   |
| 4   | Idempotency Safety      | ✅ PASS    | 100%     | LOW      |
| 5   | Soft-Lock Expiration    | 🟡 PARTIAL | 50%      | HIGH     |
| 6   | Status Transition Rules | ✅ PASS    | 100%     | LOW      |
| 7   | Provisioning Failure    | 🔴 BLOCKED | 0%       | CRITICAL |
| 8   | Version Enforcement     | ✅ PASS    | 90%      | LOW      |
| 9   | Limits Validation       | 🟡 PARTIAL | 60%      | MEDIUM   |
| 10  | Concurrency Tests       | ✅ PASS    | 95%      | LOW      |
| 11  | Single Source of Truth  | 🟡 PARTIAL | 70%      | HIGH     |
| 12  | Error Format (RFC 7807) | ✅ PASS    | 100%     | LOW      |

---

## Critical Blocking Issues

### 🔴 Issue #1: RBAC Tests Missing (Security Gap)

- **Location**: [apps/api/src/routes/license-router.ts](apps/api/src/routes/license-router.ts)
- **Problem**: No tests verify that students cannot create/modify licenses
- **Tests Needed**: 4 negative RBAC tests
- **Impact**: Non-MMC users could create licenses if auth middleware fails

### 🔴 Issue #2: Provisioning Worker Missing (Operational Gap)

- **Problem**: Licenses created immediately ACTIVE, bypassing PENDING_PROVISION safety check
- **Tests Needed**: 6 provisioning + retry + failure tests
- **Impact**: Tenant DB may not be fully provisioned before access allowed

### 🔴 Issue #3: Soft-Lock Grace Period Wrong (Business Logic Gap)

- **Location**: [packages/domain-core/src/license/service.ts:220](packages/domain-core/src/license/service.ts#L220-L224)
- **Problem**: Hardcoded to 7 days instead of 90 days per spec
- **Fix**: Change `7` to `90` in setDate() call
- **Impact**: Customers get incorrect grace period after payment failure

### 🔴 Issue #4: Limits Validation Not API-Tested (Integration Gap)

- **Problem**: Limits enforced in domain-core, but no API integration test
- **Tests Needed**: 3 API endpoint tests (student/staff over limit)
- **Impact**: Limit enforcement could break if endpoint logic bypassed

---

## Test Coverage Statistics

| Metric             | Current | Required | Gap |
| ------------------ | ------- | -------- | --- |
| Passing Tests      | 47      | 70       | -23 |
| RBAC Tests         | 0       | 4        | -4  |
| Provisioning Tests | 0       | 6        | -6  |
| Soft-Lock Tests    | 2       | 6        | -4  |
| Limits API Tests   | 0       | 3        | -3  |
| Divergence Tests   | 0       | 2        | -2  |
| Cache Tests        | 0       | 2        | -2  |

---

## Action Items (Priority Order)

### BEFORE MERGE (Required)

1. ✋ **Add RBAC Check** (15 min)
   - File: [apps/api/src/routes/license-router.ts](apps/api/src/routes/license-router.ts)
   - Add role validation in `POST /mmc/licenses` handler
   - Add 4 negative tests

2. ✋ **Fix Soft-Lock Grace Period** (5 min)
   - File: [packages/domain-core/src/license/service.ts](packages/domain-core/src/license/service.ts#L220)
   - Change `7` → `90` days
   - Add grace period validation test

3. ✋ **Implement Provisioning Worker** (4–6 hours)
   - Create worker task for DB provisioning
   - Add retry logic (5 retries, exponential backoff)
   - Add 6 tests for success/failure scenarios

4. ✋ **Add Limits API Tests** (1–2 hours)
   - Add 3 integration tests for student/staff creation limits
   - Test concurrent creation at limit boundary

### AFTER MERGE (Before Production)

5. 📊 **Add Observability**
   - Metrics for provisioning success/failure
   - Alerts for divergence (licenses vs tenants_registry)
   - Dashboard for license lifecycle states

6. 🏋️ **Load Testing**
   - Stress: 10+ concurrent provisioning requests
   - Stress: 100 concurrent state transitions
   - Stress: Concurrent limits enforcement at boundary

---

## Files Requiring Changes

| File                                                                                       | Change                         | Severity |
| ------------------------------------------------------------------------------------------ | ------------------------------ | -------- |
| [apps/api/src/routes/license-router.ts](apps/api/src/routes/license-router.ts)             | Add RBAC check to POST handler | CRITICAL |
| [packages/domain-core/src/license/service.ts](packages/domain-core/src/license/service.ts) | Fix grace period 7→90 days     | CRITICAL |
| Test suite                                                                                 | Add 23+ new tests              | CRITICAL |
| Worker                                                                                     | Implement provisioning job     | CRITICAL |

---

## Risk Assessment

| Risk                         | Level    | Mitigated By            |
| ---------------------------- | -------- | ----------------------- |
| Non-MMC user creates license | HIGH     | RBAC test #1            |
| Tenant DB not provisioned    | CRITICAL | Provisioning tests      |
| Insufficient grace period    | MEDIUM   | Grace period fix        |
| Limit enforcement bypass     | MEDIUM   | API integration tests   |
| Race condition on expiry     | LOW      | Concurrency test T044.1 |
| Divergence undetected        | MEDIUM   | Divergence tests        |

---

## Estimated Effort to Compliance

| Task                        | Effort          | Dependency            |
| --------------------------- | --------------- | --------------------- |
| RBAC fix + tests            | 1 hour          | None                  |
| Grace period fix            | 30 min          | None                  |
| Provisioning implementation | 6–8 hours       | Worker infrastructure |
| Limits API tests            | 2 hours         | None                  |
| Cache invalidation tests    | 1 hour          | None                  |
| **Total**                   | **10–12 hours** | None                  |

---

## Recommendation

**DO NOT MERGE** until all 4 critical blockers resolved.

**Current Readiness**: 34% (34 of 100 points)  
**Production Readiness**: 0%  
**Timeline to Compliance**: 2–3 days with 1 engineer

---

**Report**: [QA_AUDIT_LICENSES_MANAGEMENT.md](QA_AUDIT_LICENSES_MANAGEMENT.md)  
**Generated**: 2026-02-22
