# Implementation Plan: Affiliate Program (B2B License Discounts & Commissions)

**Branch**: `013-affiliates` | **Date**: 2026-02-25 | **Spec**: [specs/runtime/013-affiliates/spec.md](spec.md)
**Input**: Feature specification from `/specs/runtime/013-affiliates/spec.md`

**Phase**: 02_PLATFORM_MMC | **Stage**: STAGE_13_AFFILIATES

---

## Summary

Implement a master_db-only affiliate system for platform administrators to manage B2B promotional codes for commercial license purchases. The system tracks usage, enforces financial integrity with deterministic calculations, maintains transactional concurrency safety, and provides comprehensive audit logging for revenue reporting. Core deliverables: MMC CRUD APIs for affiliate management, promo code validation hook in license purchase flow, immutable usage audit trail, and admin action tracking.

---

## Technical Context

**Language/Version**: TypeScript (Node.js) + Bun runtime  
**Primary Dependencies**: Hono (web framework), PostgreSQL (via node-pg), Drizzle ORM, Zod (validation), Pino (structured logging), Redis (for user session state and rate limiting)  
**Storage**: PostgreSQL master_db (new tables: `affiliates`, `affiliate_usages`, `affiliate_admin_audit`)  
**Testing**: Vitest (unit + integration tests), Playwright (e2e if MMC UI testing included)  
**Target Platform**: Backend API server (Bun + Hono)  
**Project Type**: Web service (B2B SaaS platform component)  
**Performance Goals**: Sub-200ms p95 for affiliate validation during license purchase; no performance regression on existing license flow  
**Constraints**: Transactional integrity with row-level locking; deterministic NUMERIC(12,2) financial calculations; no floating-point math; no tenant database changes; master_db schema version bump required  
**Scale/Scope**: B2B commercial licensing system; supports unlimited affiliate codes; supports per-client usage limits; audit trail immutable and append-only

## Constitution Check

**GATE: All checks PASS. Feature is architecturally compliant. Re-check after Phase 1 design: PASS.**

| Principle                             | Status | Notes                                                                                                                                                                                                                          |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Database-Per-Tenant Isolation**     | ✓ PASS | Affiliate system is entirely master_db only. No tenant DB access. No cross-tenant joins. No shared student/attempt table access. Tenant isolation remains intact.                                                              |
| **Middleware Authority**              | ✓ PASS | License purchase endpoint already enforces license middleware (tenant resolver → authentication → license validation). Affiliate validation is substep within existing transaction. No middleware bypass.                      |
| **Authoritative License Enforcement** | ✓ PASS | Affiliate system does not override license lifecycle or status. License's ACTIVE status already validated by middleware. Discount applied transactionally within license purchase boundary.                                    |
| **Snapshot-Based Attempt Integrity**  | ✓ PASS | NOT APPLICABLE. Affiliate system only affects discount calculation. Does not touch attempt configuration, snapshots, or grading. Attempt engine remains pristine.                                                              |
| **Versioned Evolution**               | ✓ PASS | New master_db schema requires version bump (migration tracked). Migration is forward-only and idempotent. Not schema-breaking. Backward compatible reads.                                                                      |
| **Runtime Authoritative Time**        | ✓ PASS | Affiliate time windows validated using `CURRENT_TIMESTAMP` in database (server time authoritative). Client time never trusted.                                                                                                 |
| **Deterministic Worker Execution**    | ✓ PASS | NOT APPLICABLE. Worker not directly involved. Database migrations executed by worker (if applicable). No affiliate-specific async jobs needed for Phase 2.                                                                     |
| **Concurrency Guarantees**            | ✓ PASS | Row-level locking (`SELECT ... FOR UPDATE`) ensures affiliate record lock during transaction. Usage counters updated atomically. No double-counting or race conditions.                                                        |
| **Strict Separation of Layers**       | ✓ PASS | Frontend (MMC UI) has no business logic. API routes call domain package. Domain layer is pure functions (calculations, validation). No framework dependencies in domain. Master_db only.                                       |
| **Security Baseline**                 | ✓ PASS | Admin endpoints protected by MMC token validation and RBAC. Request validation via Zod. Structured logging with correlation ID. Rate limiting applied via existing admin rate limit policy. No secrets exposed.                |
| **Operational Integrity**             | ✓ PASS | All mutations within transactional boundary. Affiliate CRUD is idempotent (unique constraint on promo_code, status-based soft delete). Usage tracking append-only. Admin actions logged separately. Audit trail comprehensive. |
| **Error Handling**                    | ✓ PASS | All errors follow Zidney error standard (success/data/error JSON). Specific error codes for affiliate validations (AFFILIATE_CODE_NOT_FOUND, AFFILIATE_CODE_EXPIRED, etc.). Structured error responses.                        |

**No Violations Detected**: Affiliate system adheres strictly to Constitution v1.2.0 across all 9 core principles.

---

## Technical Design Overview

### 1. Database Schema & Migrations

**New Master_DB Tables**:

- `affiliates` (15 columns): Affiliate definition, configuration, usage counter
- `affiliate_usages` (8 columns): Immutable audit trail of code usage per purchase
- `affiliate_admin_audit` (8 columns): Admin mutation tracking (create/update/disable actions)

**Key Design Decisions**:

- **NUMERIC(12,2) for All Financial Fields**: Deterministic rounding, no floating-point errors
- **Row-Level Locking**: `SELECT ... FOR UPDATE` prevents concurrent usage counter race conditions
- **Immutable Audit Trail**: affiliate_usages allows INSERT only (no UPDATE/DELETE)
- **Soft Delete Pattern**: status enum (ACTIVE/INACTIVE) instead of physical deletion
- **Referential Integrity**: ON DELETE RESTRICT prevents orphaned audit records
- **Temporal Validation**: start_date < end_date constraints enforced at database level

**Migrations**: Two sequential migrations:

1. Create `affiliates` + `affiliate_usages` tables, enums, indexes, triggers
2. Create `affiliate_admin_audit` table (admin action tracking)

---

### 2. API Endpoints & Contracts

**Affiliate Management (MMC Admin Endpoints)**:

- `POST /v1/mmc/affiliates` - Create affiliate promo code
- `GET /v1/mmc/affiliates` - List affiliates with filters (status, date range)
- `PATCH /v1/mmc/affiliates/:id` - Edit affiliate (except immutable promo_code)
- `POST /v1/mmc/affiliates/:id/disable` - Soft delete (status → INACTIVE)
- `GET /v1/mmc/affiliates/:id/usages` - View usage history for affiliate

**License Purchase Integration**:

- Existing `POST /v1/licenses/purchase` extended with optional `promo_code` parameter
- Affiliate validation happens transactionally within license purchase transaction
- Discount applied to final purchase amount if code valid

**Authentication/Authorization**:

- MMC admin endpoints: MMC service token + RBAC (admin role required)
- License purchase: Existing client authentication + license middleware

---

### 3. Middleware & Enforcement Points

**License Purchase Transaction Flow** (Atomic with Affiliate Validation):

```
1. Begin PostgreSQL transaction (SERIALIZABLE isolation level)
2. Load license record (existing logic)
3. If promo_code provided:
   a. SELECT affiliates WHERE promo_code = $1 FOR UPDATE (acquire row lock)
   b. Validate: status = ACTIVE
   c. Validate: CURRENT_TIMESTAMP BETWEEN start_date AND end_date
   d. Validate: usage_count < usage_limit_total (if limit set)
   e. COUNT affiliate_usages for (affiliate_id, client_id)
   f. Validate: count < usage_limit_per_client (if limit set)
   g. Calculate discount_amount = ROUND(base_amount * discount_percentage / 100, 2)
   h. Calculate commission_amount = ROUND(base_amount * commission_percentage / 100, 2)
   i. INSERT affiliate_usages record (immutable)
   j. UPDATE affiliates SET usage_count = usage_count + 1
4. Apply discount to license purchase amount
5. Complete license purchase (create license record, etc.)
6. Commit transaction or ROLLBACK on validation failure
```

**Mandatory Middleware Chain** (Unchanged):

- Tenant Resolver (N/A for admin endpoints, used for license purchase)
- License Status Validation (existing)
- Authentication & Authorization
- Rate Limiting (existing admin limits apply)

---

### 4. Concurrency & Transactional Safety

**Challenge**: Multiple concurrent license purchases with same affiliate code → race condition on usage_count.

**Solution: Pessimistic Locking**:

- `SELECT ... FOR UPDATE` acquires exclusive row-level lock on affiliate record
- Only one transaction can hold lock at time
- Other transactions wait (default PostgreSQL timeout ~30 seconds)
- If timeout: SQLSTATE 57014 (return HTTP 409 Conflict)
- All validation and counter increment within locked transaction

**Per-Client Limit Atomicity**:

- `SELECT COUNT(*) FROM affiliate_usages WHERE affiliate_id = $1 AND client_id = $2` within transaction
- Count compared against `usage_limit_per_client` within same locked transaction
- No stale counts possible

**Deadlock Prevention**:

- Single table (affiliates) involved in lock
- Consistent lock ordering (single affiliate row)
- Minimal lock duration (validation + insert + count)
- No nested locks

---

### 5. Financial Calculations & Determinism

**Rounding Strategy**:

```sql
discount_amount = ROUND(base_amount * discount_percentage / 100, 2)
commission_amount = ROUND(base_amount * commission_percentage / 100, 2)
```

- NUMERIC type (arbitrary precision) - never FLOAT
- ROUND() with default "round half to even" mode (deterministic across all systems)
- Audit trail captures both input and output for verification

**Example**:

```
base_amount: 100.00
discount_percentage: 33.33
discount_amount: ROUND(100.00 * 33.33 / 100, 2) = ROUND(33.33, 2) = 33.33
commission_amount: ROUND(100.00 * 5.00 / 100, 2) = ROUND(5.00, 2) = 5.00
```

**Reconciliation**: Audit trail enables offline verification:

```
discount_percentage = (discount_amount * 100) / base_amount
```

---

### 6. Error Handling & Validation

**Request Validation** (Zod schemas):

```
POST /v1/mmc/affiliates:
- promo_code: uppercase, alphanumeric, 3-50 chars, unique
- discount_percentage: numeric, 0-100, 2 decimals
- commission_percentage: numeric, 0-100, 2 decimals
- usage_limit_total: integer, ≥0 or null
- usage_limit_per_client: integer, ≥0 or null
- start_date: ISO 8601 timestamp
- end_date: ISO 8601 timestamp (must be > start_date)
- description: text, optional
```

**Response Error Codes** (Zidney Standard):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "human readable description"
  }
}
```

**Affiliate-Specific Error Codes**:

- `AFFILIATE_CODE_NOT_FOUND` - Code doesn't exist
- `AFFILIATE_CODE_INACTIVE` - Status is INACTIVE
- `AFFILIATE_CODE_EXPIRED` - Outside temporal window
- `AFFILIATE_USAGE_LIMIT_EXCEEDED` - Total usage limit reached
- `AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED` - Per-client limit reached
- `AFFILIATE_INVALID_DISCOUNT_PERCENTAGE` - Percentage out of range
- `AFFILIATE_FORBIDDEN_DUPLICATE_PROMO_CODE` - Promo code already exists
- `INVALID_LICENSE_AMOUNT` - Base amount ≤ 0 (data corruption check)

**HTTP Status Codes**:

- `200/201` - Success
- `400` - Validation failure (bad request, limit exceeded, invalid code)
- `401` - Unauthorized
- `403` - Forbidden (insufficient RBAC)
- `404` - Not found
- `409` - Conflict (lock timeout on concurrent purchase)
- `423` - License soft-locked
- `500` - Server error

---

### 7. Observability & Structured Logging

**Required Log Fields** (Pino structured):

```json
{
  "timestamp": "2026-02-25T14:30:00.000Z",
  "level": "info",
  "service": "api-license-purchase",
  "correlation_id": "req-abc123xyz",
  "workspace_slug": "my_institution",
  "workspace_id": "uuid",
  "user_id": "admin-uuid or client-uuid",
  "event": "affiliate_code_applied | affiliate_code_rejected | affiliate_created | etc",
  "affiliate_id": "aff-uuid",
  "promo_code": "SPRING25",
  "action": "CREATE | UPDATE | DISABLE | APPLY",
  "base_amount": "500.00",
  "discount_percentage": "10.00",
  "discount_amount": "50.00",
  "commission_percentage": "2.00",
  "commission_amount": "10.00",
  "license_id": "lic-uuid",
  "client_id": "client-uuid",
  "error_code": "[if error]"
}
```

**Audit Events**:

- `affiliate_created` - New code created with values
- `affiliate_updated` - Fields modified (old_values, new_values logged as JSONB)
- `affiliate_disabled` - Status changed to INACTIVE
- `affiliate_code_applied` - Code successfully validated and used
- `affiliate_code_rejected` - Code validation failed (reason: EXPIRED, INACTIVE, LIMIT_EXCEEDED, etc)
- `affiliate_usage_limit_check_failed` - Admin attempted operation on limit fields

**Compliance**: All logs include correlation_id for request tracing and audit trail reconstruction.

---

## Project Structure

### Documentation (this feature)

```
specs/runtime/013-affiliates/
├── spec.md              # Locked specification (source of truth)
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Clarification research findings
├── data-model.md        # Master database schema documentation
├── quickstart.md        # Developer quick-start guide
├── contracts/           # API contract definitions
│   ├── post-create-affiliate.md
│   ├── get-list-affiliates.md
│   ├── patch-edit-affiliate.md
│   ├── post-disable-affiliate.md
│   ├── get-affiliate-usages.md
│   └── license-purchase-integration.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
apps/api/src/
├── routes/
│   └── affiliates.ts                          # Route registration
├── handlers/
│   └── affiliates/
│       ├── create-affiliate.ts
│       ├── list-affiliates.ts
│       ├── edit-affiliate.ts
│       ├── disable-affiliate.ts
│       └── get-affiliate-usages.ts
├── services/
│   └── affiliate-service.ts                  # Business logic
├── middleware/
│   └── affiliate-validation.ts               # Request validation
├── db/master/
│   └── migrations/
│       ├── 009_create_affiliates_tables.ts
│       └── 010_create_affiliate_admin_audit.ts
└── db/master/schemas/
    └── affiliates-schema.ts                 # Drizzle schema definitions

packages/domain-core/src/
└── affiliates/
    ├── calculations.ts                      # Financial calculations (NUMERIC)
    ├── validators.ts                        # Validation logic (pure functions)
    └── types.ts                             # TypeScript interfaces

tests/
├── unit/affiliates/
│   ├── calculations.test.ts
│   ├── validators.test.ts
│   └── concurrency.test.ts
├── integration/affiliates/
│   ├── affiliate-crud.test.ts
│   ├── license-purchase-with-affiliate.test.ts
│   └── transaction-isolation.test.ts
└── edge-cases/affiliates/
    ├── concurrent-purchases.test.ts
    ├── financial-precision.test.ts
    └── admin-audit-trail.test.ts
```

---

## Complexity Tracking

**Justification**: No Constitution violations. All gates pass. Feature is architecturally sound and isolated within master_db. Concurrency handled via pessimistic locking. Financial precision via NUMERIC.

**Implementation Complexity**: MODERATE

- Database schema straightforward (3 tables, standard constraints)
- Existing Hono routing pattern reusable
- Transactional logic follows existing license purchase pattern
- No new architectural layers introduced
- Testing requirements standard (unit + integration coverage)

---

## Next Steps

**Phase 0**: Generate research.md (resolve all NEEDS CLARIFICATION markers)  
**Phase 1**: Generate data-model.md, contracts/, quickstart.md, and update agent context  
**Phase 2**: Execute /speckit.tasks to generate detailed implementation tasks
