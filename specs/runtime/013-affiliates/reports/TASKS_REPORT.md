# Tasks Report — STAGE_13_AFFILIATES

**Step:** 4 — Tasks  
**Timestamp:** 2026-02-25T00:20:00Z  
**Status:** COMPLETE

---

## Summary

Comprehensive task breakdown successfully generated for B2B affiliate system implementation. 43
atomic tasks span 9 implementation phases from database migrations through documentation. Tasks are
properly ordered with dependencies, prioritized by critical path, and identified parallelizable
work. Estimated duration: 4-5 developer weeks (compressible to ~3 weeks via parallelization). All
tasks align with Zidney architecture and constitutional compliance.

---

## Task Generation Metrics

| Metric                       | Value                                                              |
| ---------------------------- | ------------------------------------------------------------------ |
| **Total Tasks**              | 43                                                                 |
| **Parallelizable Tasks [P]** | 18 (42% of total)                                                  |
| **User Story Breakdown**     | US1: 9 tasks / US2: 10 tasks / US3: 3 tasks / Foundation: 21 tasks |
| **Implementation Phases**    | 9 (Setup → Polish)                                                 |
| **Critical Path Duration**   | 4-5 developer weeks                                                |
| **Parallelized Duration**    | ~3 weeks (4 parallel batches)                                      |
| **Expected Task File Size**  | 18 KB, 850+ lines                                                  |

---

## Task Organization

### Phase 1: Setup (T001-T005)

Initialization and project structure.

### Phase 2: Foundation (T006-T010)

- Database migrations (3 tables with all constraints, indexes, triggers)
- Domain layer (calculations, validators)
- Middleware framework (affiliate validation interceptor)

### Phase 3: US1 — Affiliate CRUD (T011-T019)

9 endpoint/operatino tasks covering:

- Create affiliate
- List/search affiliates
- Edit affiliate
- Disable affiliate
- Usage history retrieval
- Admin audit logging
- Integration tests for full CRUD workflow

**Independent Completion**: Affiliate system functional without license purchase integration

### Phase 4: US2 — License Purchase Integration (T020-T029)

10 tasks covering:

- Extend license purchase endpoint with optional promo_code parameter
- Transactional integration (single atomic transaction)
- Row-level locking for concurrency
- Per-client/global usage limit validation
- Concurrency safety tests (global + per-client limits under 12 concurrent purchases)
- Financial calculation verification
- Rollback/transaction integrity tests

**Independent Completion**: License purchase with affiliate code atomic and safe

### Phase 5: US3 — Reporting (T030-T032)

3 tasks covering:

- Usage aggregation endpoint
- Financial reconciliation report
- Date-range filtered reporting

### Phase 6: Audit Trail (T033-T036)

Observability tasks:

- Admin action audit logging (who, what, when, IP)
- Usage event logging
- Structured logging framework
- Audit trail immutability verification

### Phase 7: Error Handling (T037-T038)

- All 8 affiliate-specific error codes implemented and tested
- Validation consolidation

### Phase 8: Edge Cases (T039-T041)

- Fractional cent rounding precision tests
- Large amount calculation tests
- Temporal boundary edge cases (start_date exact, end_date exact)
- Zero/negative amount rejection

### Phase 9: Documentation (T042-T043)

- API documentation
- Developer guides

---

## Task Reference Format

All 43 tasks follow the mandatory format:

```
- [ ] T### [P-if-parallel] [US#-if-story] Description with exact file path
```

**Example Tasks**:

```
- [ ] T001 Create project structure per plan.md in apps/api/src/ and packages/domain-core/src/

- [ ] T008 [P] Implement affiliate calculations: packages/domain-core/src/affiliates/calculations.ts

- [ ] T019 [US1] Create integration tests for CRUD workflow: tests/integration/affiliates/crud-workflow.test.ts

- [ ] T027 [US2] [P] Create concurrency test: Global affiliate usage limit under concurrent purchases: tests/integration/affiliates/concurrent-purchases.test.ts
```

---

## Parallel Execution Strategy

**Identified 4 Parallel Batches:**

| Batch       | Tasks                                | Duration | Dependency                 | Trigger                       |
| ----------- | ------------------------------------ | -------- | -------------------------- | ----------------------------- |
| **Batch 1** | T008, T009, T010                     | 1 day    | After T006-T007 migrations | Foundation work               |
| **Batch 2** | T011-T019 (CRUD endpoints + tests)   | 1.5 days | After T010 middleware      | Independent from US2          |
| **Batch 3** | T020-T029 (License integration)      | 1.5 days | After T010 middleware      | Independent from US1          |
| **Batch 4** | T033-T041 (Audit, Error, Edge cases) | 2 days   | After Batches 2-3          | Depends on API implementation |

**Compression Strategy**: Sequential likely 4-5 weeks → Parallel likely ~3 weeks

---

## Coverage by Concern

### Database (T006-T007)

- ✅ affiliates table (15 columns, indexes, constraints)
- ✅ affiliate_usages table (immutable audit log with triggers)
- ✅ affiliate_admin_audit table (admin action tracking)
- ✅ Referential integrity (ON DELETE RESTRICT)
- ✅ Temporal constraints (start_date < end_date)
- ✅ Financial precision (NUMERIC type)

### API Endpoints (5 Operations, ~9-10 tasks)

- ✅ POST /v1/mmc/affiliates (create)
- ✅ GET /v1/mmc/affiliates (list with filters)
- ✅ PATCH /v1/mmc/affiliates/:id (edit, promo_code immutable)
- ✅ POST /v1/mmc/affiliates/:id/disable (soft delete)
- ✅ GET /v1/mmc/affiliates/:id/usages (reporting)
- ✅ License purchase hook (promo_code optional parameter)

### Domain Layer (T008-T009, T022)

- ✅ Financial calculations (calculateDiscount, calculateCommission)
- ✅ Validation functions (validatePromoCode, validatePercentageRange, validateDateRange)
- ✅ Pure functions (no side effects, reusable)

### Middleware & Integration (T010, T020)

- ✅ Affiliate code validation interceptor
- ✅ Transactional wrapper (single atomic transaction with license purchase)
- ✅ Row-level locking (SELECT FOR UPDATE)

### Concurrency & Transactions (T027-T029)

- ✅ Concurrent global usage limit test
- ✅ Concurrent per-client usage limit test
- ✅ Transaction rollback and data consistency test
- ✅ Lock timeout handling (HTTP 409 Conflict)

### Financial Precision (T039-T041)

- ✅ Fractional cent handling (0.01 cent, 99.99 cent amounts)
- ✅ Large amount calculations
- ✅ Invalid input rejection (zero, negative)

### Observability (T033-T036)

- ✅ Admin audit logging (action, old/new values, IP address)
- ✅ Usage event logging
- ✅ Structured logging with correlation ID
- ✅ Audit trail immutability

### Error Handling (T037-T038)

- ✅ AFFILIATE_NOT_FOUND
- ✅ AFFILIATE_INACTIVE
- ✅ AFFILIATE_EXPIRED
- ✅ AFFILIATE_USAGE_LIMIT_EXCEEDED
- ✅ AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED
- ✅ AFFILIATE_INVALID_DISCOUNT_PERCENTAGE
- ✅ AFFILIATE_FORBIDDEN_DUPLICATE_PROMO_CODE
- ✅ LOCK_TIMEOUT

---

## Constitutional Compliance in Tasks

Every task respects Zidney architecture:

- ✅ **No Cross-Tenant Logic**: All tasks operate in master_db only
- ✅ **Middleware Chain Intact**: License validation → Affiliate validation → Purchase
- ✅ **Attempt Engine Untouched**: No snapshot/grading modifications
- ✅ **Transactional Integrity**: All purchase + affiliate steps in single atomic transaction
- ✅ **Layer Separation**: UI/API/Domain/Database properly isolated
- ✅ **Error Standard**: All responses follow `{success, data, error}` format
- ✅ **Observability**: Correlation ID propagated; structured logging mandatory
- ✅ **Financial Determinism**: NUMERIC types; database-side ROUND()
- ✅ **No Breaking Changes**: Existing license flow unaffected; promo_code is optional parameter

---

## User Story Completion Criteria

**After US1 CRUD Complete (T019)**:

- ✓ Create, read, list, edit, disable affiliates functional
- ✓ Promo code immutability enforced
- ✓ Admin audit trail populated
- ✓ Search and filtering working
- ✓ Affiliate system works standalone (no license purchase integration needed)
- ✓ All CRUD endpoint errors properly handled

**After US2 License Integration Complete (T029)**:

- ✓ License purchase with affiliate code atomic (single transaction)
- ✓ Row-level locks prevent concurrency bugs
- ✓ Global usage limits enforced under concurrent purchases (12 concurrent, limit=10 → 10 succeed, 2
  rejected)
- ✓ Per-client limits enforced under concurrency
- ✓ Financial calculations deterministic and auditable
- ✓ Affiliate code optional (purchase without code still works)

**After US3 Reporting Complete (T032)**:

- ✓ Usage aggregations accurate
- ✓ Financial reconciliation queries work
- ✓ Date-range filtering functional
- ✓ Reports include client/affiliate breakdown

---

## File Locations

All tasks and implementation artifacts locate in:

```
specs/runtime/013-affiliates/tasks.md  ← Master task list (850+ lines, 18 KB)

Implementation per-task (created during Phase 7 — Implement):
apps/api/src/routes/mmc/affiliates/
apps/api/src/domain/affiliates/
packages/domain-core/src/affiliates/
tests/integration/affiliates/
tests/unit/affiliates/
```

---

## Next Step

✅ **Approved for Step 5 — Analyze (Drift Audit)**

Proceed to comprehensive drift detection scan to verify:

- Specification-to-plan alignment
- Plan-to-tasks consistency
- Constitutional compliance across all artifacts
- No architectural violations
