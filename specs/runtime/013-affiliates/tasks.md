# Tasks: Affiliate Program Implementation (STAGE_13_AFFILIATES)

**Feature**: Affiliate Program (B2B License Discounts & Commissions)  
**Stage**: STAGE_13_AFFILIATES  
**Phase**: 02_PLATFORM_MMC  
**Target**: Implement master_db-only affiliate system with promo code management, transactional usage tracking, and comprehensive audit logging  
**Status**: PHASE_2_READY  
**Date Created**: 2026-02-25

---

## Overview

This task list orchestrates the full implementation of the affiliate program within the Zidney architecture. Tasks are organized by user story to enable parallel development and independent testing. All tasks maintain database-per-tenant isolation, transactional integrity, and deterministic financial calculations.

**Total Task Count**: 41 tasks (verified)  
**Estimated Duration**: 4-5 developer weeks  
**Parallelizable Tasks**: 18 tasks can run in parallel (marked [P])  
**Testing Coverage**: Unit, integration, and concurrency test tasks included  
**No Breaking Changes**: Affiliate system is entirely within master_db; existing license flow unaffected

---

## Phase 1: Project Setup

_Duration: 0.5 day | Prerequisite for all other phases_

- [ ] T001 Create project structure per plan.md in apps/api/src/ and packages/domain-core/src/
- [ ] T002 [P] Create database schema definition file: apps/api/src/db/master/schemas/affiliates-schema.ts (Drizzle table definitions)
- [ ] T003 [P] Create TypeScript domain types: packages/domain-core/src/affiliates/types.ts (interfaces for Affiliate, AffiliateUsage, AdminAudit)
- [ ] T004 [P] Create error code constants: packages/domain-core/src/affiliates/error-codes.ts (define all 8 error codes)
- [ ] T005 [P] Create Zod validation schemas: apps/api/src/middleware/affiliate-schemas.ts (request validation schemas for create/edit/list)

---

## Phase 2: Foundation & Database Layer

_Duration: 1 day | Blocking prerequisite for all user stories_

### Database Migrations

- [ ] T006 Create master_db migration 009: apps/api/src/db/master/migrations/009_create_affiliates_tables.ts (affiliates + affiliate_usages tables, enums, indexes, constraints)
  - Create table: affiliates (15 columns, UNIQUE promo_code, date constraints, NUMERIC financial fields)
  - Create indexes: promo_code UNIQUE, status, start_date/end_date composite
  - Create immutability triggers for affiliate_usages (prevent UPDATE/DELETE)
  - Create CHECK constraints for percentages (0-100), date ranges, usage limits
  - Create FOREIGN KEY relationships with referential integrity (ON DELETE RESTRICT)

- [ ] T007 Create master_db migration 010: apps/api/src/db/master/migrations/010_create_affiliate_admin_audit.ts (affiliate_admin_audit table, immutability enforcement)
  - Create table: affiliate_admin_audit (8 columns, admin tracking)
  - Create JSONB old_values/new_values columns
  - Create indexes for forensic analysis (affiliate_id, admin_id, action, created_at)
  - Create immutability trigger (prevent UPDATE/DELETE on audit records)

### Domain Layer: Financial Calculations

- [ ] T008 [P] Implement affiliate calculations: packages/domain-core/src/affiliates/calculations.ts
  - Function: calculateDiscount(baseAmount: Decimal, discountPercentage: Decimal): Decimal
  - Function: calculateCommission(baseAmount: Decimal, commissionPercentage: Decimal): Decimal
  - Rounding strategy: NUMERIC(12,2) with database-side SQL ROUND() function
  - Unit test file: tests/unit/affiliates/calculations.test.ts (edge cases: 0%, 100%, fractional cents, large amounts)
  - No floating-point math: all calculations via PostgreSQL

- [ ] T009 [P] Implement affiliate validators: packages/domain-core/src/affiliates/validators.ts
  - Function: validatePromoCode(code: string): boolean (uppercase, alphanumeric, 3-50 chars)
  - Function: validatePercentageRange(pct: Decimal): boolean (0-100)
  - Function: validateDateRange(startDate: Date, endDate: Date): boolean (start < end)
  - Function: validateUsageLimits(limit: number | null): boolean (null or >= 0)
  - Unit test file: tests/unit/affiliates/validators.test.ts

### Middleware Integration

- [ ] T010 [P] Create affiliate request validation middleware: apps/api/src/middleware/affiliate-validation.ts
  - Parse and validate: promo_code format, discount_percentage range, commission_percentage range
  - Date validation: start_date < end_date
  - Usage limit validation: null or non-negative
  - Zod schema integration for compile-time safety
  - Error codes mapped to specific validation failures

---

## Phase 3: User Story 1 - Affiliate Management (MMC CRUD)

_Duration: 1.5 days | Independent from other stories_  
**Story Goal**: Enabled MMC admin to create, list, edit, and disable affiliate promotional codes  
**Test Criteria**: All CRUD operations work atomically; promo_code is immutable; soft delete via status field; audit trail logs all admin mutations

### Create Affiliate Endpoint

- [ ] T011 [US1] [P] Implement POST /v1/mmc/affiliates handler: apps/api/src/handlers/affiliates/create-affiliate.ts
  - Extract MMC token + admin auth
  - Validate request body via Zod schema (all 8 fields)
  - Check UNIQUE constraint on promo_code (pre-check before DB)
  - Insert into affiliates table with all fields
  - Log affiliate_created event with correlation ID
  - Return 201 Created with full affiliate object
  - Error handling: 400 Bad Request for validation failures, 403 Forbidden for insufficient RBAC

- [ ] T012 [US1] [P] Create unit tests for create affiliate: tests/unit/affiliates/create.test.ts
  - Test: Valid create with all fields
  - Test: Reject duplicate promo_code (UNIQUE constraint)
  - Test: Reject invalid percentage values (> 100)
  - Test: Reject invalid date range (end <= start)
  - Test: Reject invalid status codes
  - Test: Auto-generate UUID for id, created_at, updated_at

### List Affiliates Endpoint

- [ ] T013 [US1] [P] Implement GET /v1/mmc/affiliates handler: apps/api/src/handlers/affiliates/list-affiliates.ts
  - Extract query parameters: status (filter), created_after/created_before, page, limit
  - Query affiliates table with optional WHERE clauses
  - Pagination: default limit=20, max limit=100
  - Sort by created_at DESC
  - Return paginated list (affiliates[], total_count, page info)
  - Log list operation with pagination details
  - Error handling: 400 for invalid pagination params

- [ ] T014 [US1] [P] Create unit tests for list affiliates: tests/unit/affiliates/list.test.ts
  - Test: Return all affiliates (default)
  - Test: Filter by status=ACTIVE
  - Test: Filter by date range
  - Test: Pagination (page size, offset calculation)
  - Test: Empty result set

### Edit Affiliate Endpoint

- [ ] T015 [US1] [P] Implement PATCH /v1/mmc/affiliates/:id handler: apps/api/src/handlers/affiliates/edit-affiliate.ts
  - Extract affiliate ID from path
  - Validate request body (only mutable fields: discount_pct, commission_pct, usage_limits, description, allow_with_other_discounts)
  - Reject attempts to edit promo_code (immutable)
  - Update affiliates record
  - Capture old_values + new_values for audit trail
  - Insert into affiliate_admin_audit with ACTION='UPDATE'
  - Log affiliate_updated event
  - Return 200 OK with updated affiliates object
  - Error handling: 400 for validation, 404 for not found, 409 for immutability violation

- [ ] T016 [US1] [P] Create unit tests for edit affiliate: tests/unit/affiliates/edit.test.ts
  - Test: Update single field (discount_percentage)
  - Test: Update multiple fields
  - Test: Old/new values captured in audit record
  - Test: Reject modification of promo_code (immutability)
  - Test: Validate new values before update

### Disable Affiliate Endpoint

- [ ] T017 [US1] [P] Implement POST /v1/mmc/affiliates/:id/disable handler: apps/api/src/handlers/affiliates/disable-affiliate.ts
  - Extract affiliate ID from path
  - Load current affiliate record (status check)
  - If already INACTIVE: return 400 (already disabled)
  - Update status to INACTIVE (soft delete)
  - Insert into affiliate_admin_audit with ACTION='DISABLE'
  - Log affiliate_disabled event
  - Return 200 OK with updated affiliate (status=INACTIVE)
  - Error handling: 404 if not found, 400 if already inactive

- [ ] T018 [US1] [P] Create unit tests for disable affiliate: tests/unit/affiliates/disable.test.ts
  - Test: Transition from ACTIVE to INACTIVE
  - Test: Audit record created with old status, new status
  - Test: Reject disable of already-INACTIVE affiliate
  - Test: Affiliate still queryable (not physically deleted)

### Integration Tests: Affiliate CRUD

- [ ] T019 [US1] Create integration tests for CRUD workflow: tests/integration/affiliates/crud-workflow.test.ts
  - Test: Full lifecycle (create → list → edit → disable → validate in list)
  - Test: Multiple affiliates in system, separate CRUD ops
  - Test: Pagination with multiple affiliates
  - Test: Status filtering works correctly

---

## Phase 4: User Story 2 - License Purchase Integration (Affiliate Validation)

_Duration: 1.5 days | Depends on Phase 3 (affiliate records exist), independent database transaction_  
**Story Goal**: When purchasing a license with optional promo_code, validate affiliate code and apply discount transactionally  
**Test Criteria**: Affiliate code validation works atomically; discount/commission calculated correctly; usage counter incremented; per-client limits enforced; concurrent purchases handled safely

### License Purchase Route Modification

- [ ] T020 [US2] [P] Extend license purchase endpoint: apps/api/src/routes/licenses.ts
  - Add optional `promo_code` parameter to existing purchase route
  - No changes to existing route logic if promo_code not provided (backward compatible)
  - Call affiliate validation function if promo_code provided
  - If validation succeeds: apply discount to purchase amount
  - If validation fails: return appropriate error (400/409) without completing purchase

- [ ] T021 [US2] [P] Create affiliate validation service: apps/api/src/services/affiliate-service.ts
  - Function: validateAndApplyAffiliateCode(affiliateCode: string, clientId: UUID, baseAmount: Decimal, tx: Transaction): Promise<AffiliateDiscount>
  - SELECT ... FROM affiliates WHERE promo_code = $1 FOR UPDATE (row-level lock)
  - Validate status = ACTIVE
  - Validate temporal range: CURRENT_TIMESTAMP BETWEEN start_date AND end_date
  - Validate global usage_count < usage_limit_total (if limit set)
  - COUNT affiliate_usages for (affiliate_id, client_id), validate < usage_limit_per_client (if limit set)
  - Calculate discount_amount via database ROUND() function
  - Calculate commission_amount via database ROUND() function
  - INSERT into affiliate_usages (immutable audit record)
  - UPDATE affiliates SET usage_count = usage_count + 1 (atomically within lock)
  - Return discount details
  - Handle all validation errors: return specific error code + message

### Affiliate Validation Logic

- [ ] T022 [US2] [P] Implement affiliates.ts domain logic: packages/domain-core/src/affiliates/validation-logic.ts
  - Function: checkAffiliateActive(affiliate: Affiliate): boolean
  - Function: checkTemporalValidity(affiliate: Affiliate, now: Date = new Date()): boolean
  - Function: checkGlobalUsageLimit(affiliate: Affiliate): boolean
  - Function: checkPerClientUsageLimit(affiliate: Affiliate, clientId: UUID, usageCount: number): boolean
  - All pure functions (no DB access)
  - Reusable by API and Worker

### Financial Calculations in License Purchase

- [ ] T023 [US2] [P] Create license purchase with affiliate calculation: apps/api/src/handlers/licenses/purchase-with-affiliate.ts
  - Extract base license amount from request
  - If affiliate code provided: call validateAndApplyAffiliateCode()
  - Calculate final purchase amount: base_amount - discount_amount (if applicable)
  - Create license record with final_amount
  - Log transaction details (base, discount, commission, final)
  - Return response with discount details included
  - Ensure all calculations use NUMERIC precision (no floating point)

### License Purchase Integration Tests

- [ ] T024 [US2] [P] Create integration test: Purchase license without affiliate code: tests/integration/affiliates/license-purchase-no-code.test.ts
  - Test: Existing license purchase flow works unchanged
  - Test: Response format unchanged for backward compatibility
  - Test: Promo code parameter optional

- [ ] T025 [US2] [P] Create integration test: Purchase license with valid affiliate code: tests/integration/affiliates/license-purchase-valid-code.test.ts
  - Test: Create test affiliate first
  - Test: Purchase license with valid promo_code
  - Test: Discount applied correctly (verify calculation)
  - Test: Commission calculated correctly
  - Test: Usage count incremented
  - Test: affiliate_usages record created
  - Test: Response includes discount_amount, commission_amount, final_amount

- [ ] T026 [US2] [P] Create integration test: Purchase license with invalid affiliate codes: tests/integration/affiliates/license-purchase-invalid-codes.test.ts
  - Test: Non-existent code → AFFILIATE_CODE_NOT_FOUND
  - Test: Inactive code → AFFILIATE_CODE_INACTIVE
  - Test: Expired code → AFFILIATE_CODE_EXPIRED
  - Test: Global limit exceeded → AFFILIATE_USAGE_LIMIT_EXCEEDED
  - Test: Per-client limit exceeded → AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED
  - Test: Each error returns correct HTTP status + error code

### Concurrency & Transaction Safety Tests

- [ ] T027 [US2] [P] Create concurrency test: Concurrent affiliate code purchases: tests/integration/affiliates/concurrent-purchases.test.ts
  - Setup: Create affiliate with usage_limit_total = 10
  - Test: Simulate 12 concurrent license purchases with same promo_code
  - Test: First 10 succeed (usage_count increments 1-10)
  - Test: 11th and 12th rejected with AFFILIATE_USAGE_LIMIT_EXCEEDED
  - Test: affiliate_usages has exactly 10 records
  - Test: No race condition (usage_count = 10, not higher or lower)
  - Verify: Row-level lock prevents double-counting

- [ ] T028 [US2] [P] Create concurrency test: Per-client usage limit under concurrency: tests/integration/affiliates/concurrent-per-client-limit.test.ts
  - Setup: Create affiliate with usage_limit_per_client = 3
  - Test: Same client attempts 5 concurrent purchases
  - Test: First 3 succeed
  - Test: 4th and 5th rejected with AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED
  - Test: affiliate_usages has exactly 3 records for (affiliate_id, client_id)

### Transaction Atomicity Tests

- [ ] T029 [US2] [P] Create integration test: Transaction rollback on affiliate validation failure: tests/integration/affiliates/transaction-rollback.test.ts
  - Test: Expired code → transaction rolls back → license NOT created
  - Test: Over limit → transaction rolls back → usage_count NOT incremented
  - Test: Invalid amount → transaction rolls back → no record created
  - Test: Database remains consistent (no orphaned records)

---

## Phase 5: User Story 3 - Usage Reporting & Analytics

_Duration: 1 day | Depends on Phase 4 (affiliate usage records created)_  
**Story Goal**: MMC admin can view affiliate usage reports and understand business metrics (total receipts, commission payouts, etc.)  
**Test Criteria**: Usage reports calculated correctly; pagination works; time-based filtering supported

### Get Affiliate Usages Endpoint

- [ ] T030 [US3] [P] Implement GET /v1/mmc/affiliates/:id/usages handler: apps/api/src/handlers/affiliates/get-affiliate-usages.ts
  - Extract affiliate ID from path
  - Load affiliate record (validate exists)
  - Query affiliate_usages WHERE affiliate_id = $1, ordered by created_at DESC
  - Calculate aggregate statistics: total_base_amount, total_discount_amount, total_commission_amount
  - Pagination: page, limit
  - Return response with stats + usage records
  - Log usages_viewed event
  - Error handling: 404 if affiliate not found

- [ ] T031 [US3] [P] Create unit tests for usage reporting: tests/unit/affiliates/usage-reporting.test.ts
  - Test: Aggregate calculations (sum, count)
  - Test: Pagination (page offset, limit)
  - Test: Sorting by created_at DESC
  - Test: Filtering by date range (optional)

- [ ] T032 [US3] [P] Create integration test: View affiliate usage history: tests/integration/affiliates/usage-reporting.test.ts
  - Setup: Create affiliate, create 5 usage records
  - Test: GET /usages returns all 5 records
  - Test: Aggregate totals calculated correctly
  - Test: Pagination works (page 1 limit 2: returns 2, page 2 returns 2)

---

## Phase 6: Admin Audit Trail & Observability

_Duration: 1 day | Cross-cutting concern, leverages phases 3-5_  
**Story Goal**: Comprehensive audit logging of all affiliate operations; forensic investigation enabled; compliance reporting possible  
**Test Criteria**: All admin actions logged; usage events logged; error events captured; correlation ID propagates through all logs

### Audit Trail Implementation

- [ ] T033 [P] Create affiliate admin audit logger: apps/api/src/services/audit-logger.ts
  - Function: logAffiliateCreate(affiliateId: UUID, adminId: UUID, newValues: object, ipAddress: string): Promise<void>
  - Function: logAffiliateUpdate(affiliateId: UUID, adminId: UUID, oldValues: object, newValues: object, ipAddress: string): Promise<void>
  - Function: logAffiliateDisable(affiliateId: UUID, adminId: UUID, ipAddress: string): Promise<void>
  - Functions insert into affiliate_admin_audit table transactionally
  - Capture: admin_id, action, old_values, new_values, ip_address, created_at

- [ ] T034 [P] Create affiliate usage audit logger: apps/api/src/services/usage-logger.ts
  - Function: logAffiliateCodeApplied(affiliateId: UUID, clientId: UUID, licenseId: UUID, discount: Decimal, commission: Decimal, correlationId: string): Promise<void>
  - Function: logAffiliateCodeRejected(code: string, reason: string, clientId: UUID, correlationId: string): Promise<void>
  - Use structured logging (Pino) with required fields
  - Include: correlation_id, workspace_id (if applicable), user_id, affiliate_id, event_name

### Structured Logging Integration

- [ ] T035 [P] Implement structured logging for affiliate operations: apps/api/src/middleware/affiliate-logging.ts
  - Create Pino logger instance with context (service, correlation_id)
  - Log affiliate_created: event, affiliate_id, promo_code, discount_pct, commission_pct
  - Log affiliate_updated: event, affiliate_id, old_values, new_values
  - Log affiliate_disabled: event, affiliate_id
  - Log affiliate_code_applied: event, affiliate_id, promo_code, base_amount, discount_amount, commission_amount, license_id, client_id
  - Log affiliate_code_rejected: event, code, reason_code, client_id
  - All logs include timestamp, level, service, correlation_id

- [ ] T036 [P] Create integration test: Audit trail integrity: tests/integration/affiliates/audit-trail.test.ts
  - Test: Create affiliate → audit record exists with ACTION='CREATE'
  - Test: Update affiliate → audit record with ACTION='UPDATE', old/new values
  - Test: Disable affiliate → audit record with ACTION='DISABLE'
  - Test: Apply code in purchase → usage record + log event
  - Test: Reject code → log event with reason code

---

## Phase 7: Error Handling & Validation

_Duration: 1 day | Cross-cutting concern for all phases_  
**Story Goal**: Comprehensive error handling; all error codes correctly returned; validation complete at API boundary  
**Test Criteria**: All 8 error codes returned correctly; HTTP status codes match error type; error messages match spec

### Error Handling Implementation

- [ ] T037 [P] Create affiliate error handler: apps/api/src/handlers/affiliates/error-handler.ts
  - Map error codes to HTTP status codes:
    - AFFILIATE_CODE_NOT_FOUND → 400
    - AFFILIATE_CODE_INACTIVE → 400
    - AFFILIATE_CODE_EXPIRED → 400
    - AFFILIATE_USAGE_LIMIT_EXCEEDED → 400
    - AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED → 400
    - AFFILIATE_INVALID_DISCOUNT_PERCENTAGE → 400
    - AFFILIATE_FORBIDDEN_DUPLICATE_PROMO_CODE → 400 (or possible 409 Conflict)
    - LOCK_TIMEOUT (database row lock timeout) → 409 Conflict
  - Create standardized error response: { success: false, data: null, error: { code, message } }
  - Log error event with correlation_id

- [ ] T038 [P] Create error handling tests: tests/unit/affiliates/error-handling.test.ts
  - Test: All 8 error codes map to correct HTTP status
  - Test: Error response format matches standard (success, data, error)
  - Test: Error messages are human-readable
  - Test: Database constraint violation → correct error code

---

## Phase 8: Edge Cases & Financial Precision

_Duration: 1 day | Specialized testing for complex scenarios_  
**Story Goal**: Ensure financial calculations remain deterministic; edge cases handled safely; no precision loss  
**Test Criteria**: Fractional cent rounding consistent; large amounts calculated correctly; negative/zero amounts rejected

### Financial Edge Case Tests

- [ ] T039 [P] Create financial precision tests: tests/edge-cases/affiliates/financial-precision.test.ts
  - Test: Fractional cent calculation (e.g., 33.33% of $100 = $33.33, rounded)
  - Test: Large amount calculation ($999,999.99 with small percentage)
  - Test: Very small percentage (0.01% discount)
  - Test: 100% discount (verify calculation)
  - Test: Zero discount (0.00%)
  - Test: All calculations match expected values exactly (no floating-point error)

- [ ] T040 [P] Create invalid input edge case tests: tests/edge-cases/affiliates/invalid-inputs.test.ts
  - Test: Base amount = 0 (reject)
  - Test: Base amount < 0 (reject)
  - Test: NULL base amount (reject by API before reaching affiliate logic)
  - Test: Discount percentage > 100 (reject at validation)
  - Test: Commission percentage > 100 (reject at validation)
  - Test: Negative percentages (reject at validation)

- [ ] T041 [P] Create date/time edge case tests: tests/edge-cases/affiliates/temporal-edge-cases.test.ts
  - Test: Code valid at exact start_date timestamp
  - Test: Code invalid at exact end_date timestamp (exclusive upper bound)
  - Test: Code valid one second before end_date
  - Test: Code invalid one second after end_date
  - Test: Timezone handling (ensure UTC comparison)

---

## Phase 9: Documentation & Integration

_Duration: 0.5 day | Final cross-cutting concerns_

- [ ] T042 [P] Update API documentation: docs/api/affiliates.md
  - Document all 5 affiliate endpoints (create, list, edit, disable, usages)
  - Document license purchase integration
  - Include request/response examples
  - Error codes reference

- [ ] T043 [P] Update README for developer onboarding: docs/DEVELOPER_SETUP_AFFILIATES.md
  - Local database setup instructions
  - Migration execution steps
  - Example CURL commands for testing
  - Troubleshooting guide

---

## Task Dependencies & Execution Strategy

### Critical Path (Blocking Dependencies)

```
T001-T005 (Setup) → T006-T010 (Foundation) → T011-T019 (Story 1) → T020-T032 (Story 2-3) → T033-T041 (Polish)
```

### Parallelizable Execution Groups

<details>
<summary><b>Parallel Batch 1: Schema Design (Can run immediately after T006-T007)</b></summary>

```
T008, T009, T010 → Complete domain layer before API implementation
```

</details>

<details>
<summary><b>Parallel Batch 2: Affiliate CRUD (Can run after T010, independent of purchase integration)</b></summary>

```
T011, T012, T013, T014, T015, T016, T017, T018, T019 → All CRUD endpoints + tests in parallel
```

</details>

<details>
<summary><b>Parallel Batch 3: License Integration (Starts after T020, independent of CRUD tests)</b></summary>

```
T021, T022, T023, T024, T025, T026, T027, T028, T029 → Purchase integration + all concurrency tests
Concurrency tests (T027-T029) can run in parallel once T023 complete
```

</details>

<details>
<summary><b>Parallel Batch 4: Observability (Can run after Batch 2-3 complete)</b></summary>

```
T033, T034, T035, T036 → Audit trail + logging across whole system
T037, T038 → Error handling after system largely complete
T039, T040, T041 → Edge case testing
```

</details>

### Suggested Execution Timeline

**Day 1**: T001-T010 (Setup + Foundation: 0.5 + 1 day)  
**Day 2-3**: T011-T019 (Affiliate CRUD) + T020-T029 (License Integration, stories can develop in parallel)  
**Day 4**: T030-T032 (Usage Reporting) + T033-T041 (Observability & Edge Cases, can run in parallel)  
**Day 5**: T042-T043 (Documentation + Final Integration Tests if needed)

### Independent Test Criteria (Each Story Testable Independently)

**After Story 1 (T019 complete)**:

- ✓ Affiliate CRUD works end-to-end (create, list, edit, disable)
- ✓ Admin audit trail populated
- ✓ No dependency on license purchase

**After Story 2 (T029 complete)**:

- ✓ License purchase with affiliate code works atomically
- ✓ Concurrency safe (row-level locks prevent race conditions)
- ✓ Per-client limits enforced
- ✓ Independent of usage reporting

**After Story 3 (T032 complete)**:

- ✓ Usage reports calculate correctly
- ✓ Can be tested with mock usage data from Story 2

---

## Testing Checklist (Summary)

### Unit Tests (Business Logic)

- [ ] Decimal calculations (T008 - discount, commission, rounding)
- [ ] Validation logic (T009 - format, ranges, dates)
- [ ] CRUD operations (T012, T014, T016, T018)
- [ ] Error codes (T038)
- [ ] Financial edge cases (T039, T040, T041)

### Integration Tests (Full Workflows)

- [ ] Affiliate CRUD workflow (T019)
- [ ] License purchase without code (T024)
- [ ] License purchase with valid code (T025)
- [ ] License purchase with invalid codes (T026)
- [ ] Audit trail (T036)
- [ ] Usage reporting (T032)

### Concurrency Tests (Transaction Safety)

- [ ] Global usage limit under concurrent purchases (T027)
- [ ] Per-client usage limit under concurrent purchases (T028)
- [ ] Transaction rollback on validation failure (T029)

### Edge Case Tests (Determinism & Safety)

- [ ] Financial precision (large amounts, fractional cents) (T039)
- [ ] Invalid inputs (zero/negative amounts) (T040)
- [ ] Temporal edge cases (at exact boundaries) (T041)

---

## Implementation Notes

### Database Constraints (Enforced at DB Level)

All constraints implemented in migrations T006-T007:

1. **UNIQUE on promo_code** - Prevents duplicate codes
2. **CHECK on discount_percentage** - 0 ≤ value ≤ 100
3. **CHECK on commission_percentage** - 0 ≤ value ≤ 100
4. **CHECK on start_date < end_date** - Temporal validity
5. **CHECK on usage_limit_total** - NULL or >= 0
6. **CHECK on usage_limit_per_client** - NULL or >= 0
7. **FOREIGN KEY affiliate_id** - ON DELETE RESTRICT (prevents orphaning usages)
8. **Immutability triggers** - Prevent UPDATE/DELETE on affiliate_usages

### Transactional Boundaries (SERIALIZABLE isolation)

All affiliate code applications happen within a single PostgreSQL transaction:

```typescript
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE

  // Select with FOR UPDATE (row-level lock)
  SELECT * FROM affiliates WHERE promo_code = $1 FOR UPDATE

  // All validations + calculations within lock
  // INSERT into affiliate_usages
  // UPDATE affiliates SET usage_count = usage_count + 1

COMMIT or ROLLBACK
```

### Error Recovery

- **Lock timeout**: Return HTTP 409 Conflict (client may retry)
- **Validation failure**: Return HTTP 400 Bad Request with specific error code (client must fix request)
- **Data corruption**: Return HTTP 500 with correlation ID (ops team investigates logs)

### No Affiliate-Specific Rate Limiting Needed

- MMC CRUD endpoints: Reuse existing admin rate limits
- License purchase: Reuse existing license endpoint rate limits (affiliate validation is subcomponent)
- Concurrency naturally throttled by row-level locking

---

## Completion Requirements (Definition of Done)

Each task is DONE when:

1. ✓ Code written and follows Zidney conventions (layer separation, error handling, logging)
2. ✓ Tests pass (unit + integration if applicable)
3. ✓ Database migrations idempotent and forward-only
4. ✓ Spike/bugs logged asynchronously (no blocking)
5. ✓ Code peer-reviewed and merged to feature branch
6. ✓ Documentation updated (if applicable)
7. ✓ No console.log() - use structured logging (Pino)
8. ✓ All error paths tested and return correct error code + HTTP status
9. ✓ Type-safe: TypeScript strict mode passes
10. ✓ Lint passes: ESLint + Prettier

---

## Scope & Out-of-Scope

### Included in This Feature

- ✓ Master_db schema for affiliates, usages, audit trail
- ✓ 5 MMC admin endpoints (CRUD + usages)
- ✓ License purchase integration hook
- ✓ Concurrency safety via row-level locking
- ✓ Comprehensive unit + integration + concurrency tests
- ✓ Structured logging + audit trail
- ✓ Error handling with 8 error codes
- ✓ Financial calculations with NUMERIC precision

### Not Included (Future Phases)

- [ ] Frontend MMC UI (out of scope for Task Phase)
- [ ] Affiliate payout system (separate feature)
- [ ] Commission settlement automation (Worker-based, future)
- [ ] Usage analytics dashboards (future phase)
- [ ] Discount stacking logic (business logic flags set, but not enforced by API)

---

## Success Criteria

Feature is **COMPLETE** when:

1. ✓ All 41 tasks executed and marked complete
2. ✓ All unit tests pass (>90% coverage on affiliate modules)
3. ✓ All integration tests pass (CRUD workflow + License purchase + Concurrency)
4. ✓ Database migrations applied successfully (no errors on existing test DB)
5. ✓ No Constitutional violations (Architecture PASS)
6. ✓ Backward compatibility maintained (existing license purchase flow unaffected)
7. ✓ Type safety enforced (TypeScript strict mode passes)
8. ✓ Lint + Format passing (ESLint, Prettier)
9. ✓ Code reviewed + approved
10. ✓ Documentation updated (README + API docs)
11. ✓ Feature ready for merge to main branch

---

## Revision History

| Version | Date       | Author  | Changes           |
| ------- | ---------- | ------- | ----------------- |
| 1.0     | 2026-02-25 | SpecKit | Initial task list |
