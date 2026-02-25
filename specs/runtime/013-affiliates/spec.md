# SPECIFICATION: Affiliate Program (B2B License Discounts & Commissions)

**Feature Stage**: STAGE_13_AFFILIATES  
**Phase**: 02_PLATFORM_MMC  
**Scope**: B2B affiliate marketing for commercial license purchases  
**Referenced Source**: [STAGE_13_AFFILIATES.md](../../phases/02_PLATFORM_MMC/STAGE_13_AFFILIATES.md)

---

## Feature Overview

Implement a master_db-only affiliate system that enables platform administrators to create and manage promotional codes for B2B commercial license purchases. The affiliate system tracks usage, enforces financial integrity, calculates discounts and commissions, and maintains audit records for revenue reporting.

**What is being built:**

- MMC affiliate management interface (CRUD for affiliate records)
- Promo code validation and enforcement during license purchase flow
- Transactional usage tracking with concurrency protection
- Financial calculations with deterministic rounding
- Comprehensive audit logging
- Usage reporting and analytics

**Phase Context**: Part of Platform MMC (Organizational control layer)

**Affected Architectural Layers**:

- Database: master_db only (no tenant DB changes)
- License Enforcement: Existing license purchase flow extended
- Observability: New audit trail for affiliate usage
- API: New affiliate management endpoints + usage enforcement hook
- Worker: None direct (async jobs handled by existing attempt finalizer)

---

## Constitutional Compliance Declaration

**Isolation**: ✓ CONFIRMED

- Affiliate logic is entirely in master_db
- No cross-tenant data access
- No tenant database modifications
- No shared student or attempt table access
- Tenant isolation remains intact

**License Enforcement**: ✓ CONFIRMED

- Affiliate system affects discount calculation only
- Does not override license lifecycle or status
- Does not modify license limits or provisioning
- License middleware remains mandatory for license purchase endpoint

**Attempt Engine**: ✓ NOT APPLICABLE

- Affiliate system does not touch attempt configuration, snapshots, or grading
- Attempt engine remains pristine and unchanged

**Middleware Chain**: ✓ CONFIRMED

- Affiliate enforcement is part of license purchase transaction
- Tenant resolver → License validation → (Affiliate validation & usage) → Purchase finalization
- No middleware bypass required

**Versioning Strategy**: ✓ CONFIRMED

- New master_db schema requires version bump
- Migration is forward-only, idempotent, and transactional
- Not schema-breaking (backward compatible reads)

**No Violations Detected**: Affiliate system adheres strictly to database-per-tenant model, license enforcement chain, and transactional boundaries without weakening any foundational principle.

---

## Isolation Impact Analysis

**Database Scope**:

- **Primary**: master_db (new tables: `affiliates`, `affiliate_usages`)
- **Secondary**: None (tenant databases remain untouched)
- **Connection Pool**: Uses existing master_db connection pool (no new pool required)

**Tenant Resolution**:

- Affiliate operations are administrative (MMC level)
- Affiliate enforcement happens during license purchase (master_db transaction within license context)
- No tenant resolver needed for affiliate CRUD (admin-only endpoints)
- License purchase flow uses existing tenant resolver for license validation

**New Tables**:

1. `affiliates` - Affiliate definition and configuration
2. `affiliate_usages` - Immutable audit trail of usage

**Data Flow**:

```
MMC Admin → Affiliate CRUD → master_db.affiliates (stored)
  ↓
Client Purchase License with Code → License Purchase Endpoint
  ↓
License Purchase Flow → Validate Code in master_db.affiliates
  ↓
Apply Discount → Create affiliate_usages record (transactional)
  ↓
License remains in client tenant_db (unchanged)
```

**Confirmation**: No shared tenant data, no cross-tenant joins, no tenant isolation compromise.

---

## License & Version Enforcement

**License Middleware on Affiliate CRUD**: ✓ REQUIRED

- Affiliate management is admin-only feature within MMC
- MMC access requires authenticated admin session (not license-bound)
- No license state check needed for affiliate CRUD (administrative only)

**License Middleware on License Purchase (with Affiliate)**: ✓ REQUIRED

- Existing license purchase endpoint already enforces license middleware
- Affiliate validation added as substep within existing transactional boundary
- License status (`ACTIVE` only) already validated by existing middleware

**Schema Version Enforcement**: ✓ REQUIRED

- New master_db migration requires schema version bump
- Migration is tracked and versioned
- Worker executes migration idempotently with checksum validation
- Forward-only: no rollback of affiliate tables

**Product Version Compatibility**: ✓ NOT APPLICABLE

- Affiliate system does not introduce breaking changes to product schema
- Existing products work with or without affiliate codes (soft feature)
- No product version gating required

---

## Data Model Changes

### New Master_DB Tables

#### affiliates

| Column                     | Type                   | Constraints                 | Notes                                      |
| -------------------------- | ---------------------- | --------------------------- | ------------------------------------------ |
| id                         | uuid                   | PRIMARY KEY                 |                                            |
| promo_code                 | varchar(50)            | UNIQUE, NOT NULL, IMMUTABLE | Uppercase alphanumeric only                |
| discount_percentage        | numeric(5,2)           | NOT NULL, >= 0, <= 100      | Deterministic decimal (NUMERIC, not FLOAT) |
| commission_percentage      | numeric(5,2)           | NOT NULL, >= 0, <= 100      | Deterministic decimal (NUMERIC, not FLOAT) |
| allow_with_other_discounts | boolean                | DEFAULT false               | Discount stacking rule                     |
| usage_limit_total          | integer                | NULLABLE                    | Global usage cap per affiliate             |
| usage_limit_per_client     | integer                | NULLABLE                    | Per-client usage cap                       |
| usage_count                | integer                | DEFAULT 0                   | Running counter (transactionally updated)  |
| start_date                 | timestamp              | NOT NULL                    | Promo validity start                       |
| end_date                   | timestamp              | NOT NULL                    | Promo validity end                         |
| status                     | enum(ACTIVE, INACTIVE) | DEFAULT ACTIVE              | Soft delete via status                     |
| description                | text                   | NULLABLE                    | Admin-facing notes                         |
| created_at                 | timestamp              | DEFAULT now()               |                                            |
| updated_at                 | timestamp              | DEFAULT now()               |                                            |

**Indexes**:

- UNIQUE (promo_code)
- INDEX (status)
- INDEX (start_date, end_date)

**Constraints**:

- start_date < end_date
- All numeric fields must be NUMERIC type (PostgreSQL), never FLOAT
- promo_code is immutable after insert

#### affiliate_usages

| Column            | Type          | Constraints               | Notes                           |
| ----------------- | ------------- | ------------------------- | ------------------------------- |
| id                | uuid          | PRIMARY KEY               |                                 |
| affiliate_id      | uuid          | FK → affiliates, NOT NULL |                                 |
| client_id         | uuid          | FK → clients, NOT NULL    |                                 |
| license_id        | uuid          | FK → licenses, NOT NULL   |                                 |
| base_amount       | numeric(12,2) | NOT NULL                  | Purchase amount before discount |
| discount_amount   | numeric(12,2) | NOT NULL                  | Calculated discount             |
| commission_amount | numeric(12,2) | NOT NULL                  | Calculated commission           |
| created_at        | timestamp     | DEFAULT now()             | Immutable                       |

**Indexes**:

- INDEX (affiliate_id)
- INDEX (client_id)
- INDEX (license_id)
- INDEX (created_at)
- FOREIGN KEY (affiliate_id) → affiliates(id)
- FOREIGN KEY (client_id) → clients(id)
- FOREIGN KEY (license_id) → licenses(id)

**Immutability Rule**: No UPDATE or DELETE operations allowed on affiliate_usages records. Only INSERT for audit trail.

---

## Transaction Boundaries

### License Purchase with Affiliate Code (Atomic Transaction)

**Pre-conditions**:

- License purchase endpoint called with optional `promo_code` parameter
- License validation middleware already executed
- Client authenticated and authorized

**Transactional Flow** (Single PostgreSQL Transaction):

1. Begin transaction with isolation level `SERIALIZABLE`
2. Load license record (validates all license requirements - already done by middleware)
3. If `promo_code` provided:
   a. `SELECT affiliates WHERE promo_code = $1 FOR UPDATE` (row lock, pessimistic)
   b. Validate `status = ACTIVE` (reject if INACTIVE)
   c. Validate `current_timestamp BETWEEN start_date AND end_date` (temporal validity)
   d. Validate `usage_count < usage_limit_total` (if limit set, else skip)
   e. Count existing usages for this client+affiliate pair:
   - `SELECT COUNT(*) FROM affiliate_usages WHERE affiliate_id = $1 AND client_id = $2`
   - Validate count < `usage_limit_per_client` (if limit set, else skip)
     f. Calculate: `discount_amount = base_amount * discount_percentage / 100`
     g. Calculate: `commission_amount = base_amount * commission_percentage / 100`
     h. Both calculations: Round to 2 decimals using `ROUND(value, 2)` (deterministic)
     i. Insert `affiliate_usages` record with discount_amount, commission_amount
     j. Update `affiliates.usage_count = usage_count + 1`
4. Apply discount to license purchase amount (if applicable)
5. Complete license purchase (existing logic - create license record, etc.)
6. Commit transaction

**Failure Handling**:

- Any validation failure → ROLLBACK transaction, return HTTP 400 with specific error code
- Concurrency conflict (locked row timeout) → ROLLBACK, return HTTP 409 (Conflict)
- Database error → ROLLBACK, return HTTP 500 with correlation ID for investigation

**Constraint Enforcement**: All constraints via database CHECK constraints and UNIQUE / FOREIGN KEY constraints (not application-layer validation only).

**Idempotency**: Affiliate code application itself is idempotent (no second application of same code during same transaction). License purchase endpoint already implements idempotency via unique constraint on purchase ID.

---

## Transactional Financial Calculations

**Rounding Strategy**:

- All financial calculations use PostgreSQL `NUMERIC` type (never FLOAT)
- Rounding formula: `ROUND(value, 2)` with default "round half to even" mode
- Calculations:
  ```
  discount_amount = ROUND(base_amount * discount_percentage / 100, 2)
  commission_amount = ROUND(base_amount * commission_percentage / 100, 2)
  ```

**Auditability Requirement**:

- Every usages record immutably captures input values and calculated values
- Audit logs include affiliate_id, discount_amount, commission_amount, license_id
- Any dispute: audit log is authoritative source of truth
- Calculation reversibility: `discount_percentage = (discount_amount * 100) / base_amount` must equal original percentage (within rounding precision)

---

## Concurrency Protection

**Challenge**: Multiple license purchases may apply same affiliate code simultaneously.

**Protection Mechanism**:

```sql
SELECT * FROM affiliates WHERE promo_code = $1 FOR UPDATE;
```

- `FOR UPDATE` acquires a row-level lock on the affiliate record
- Only one transaction can hold this lock at a time
- Other transactions wait until lock released
- Prevents race conditions on usage_count increment

**Usage-Count Safety**:

- `usage_count` incremented only within locked transaction
- Check `usage_count < usage_limit_total` within same transaction
- No stale value problems
- Deadlock risk: Mitigated by single table (affiliates) and consistent lock ordering

**Per-Client Limits**:

- Counted within same locked transaction
- Query: `SELECT COUNT(*) FROM affiliate_usages WHERE affiliate_id = $1 AND client_id = $2`
- Result compared against `usage_limit_per_client` within transaction
- No cached counters allowed

**Connection Pool**: Uses existing master_db pool (no new pool required).

---

## Failure Modes & Recovery

### Database Connection Loss During Purchase

- Transaction is ROLLED BACK by database
- Client receives 500 Internal Server Error with correlation ID
- Investigating team can trace logs using correlation ID
- Affiliate usage record NOT created (transactional safety)
- Client safe to retry (idempotent purchase endpoint)

### Affiliate Record Locked (Concurrent Purchases)

- Transaction waits for lock (default PostgreSQL timeout: ~30 seconds)
- If timeout exceeded: `SQLSTATE 57014` (lock timeout)
- Application returns HTTP 409 Conflict to caller
- Caller may retry (affiliate safe for retry)

### Validation Failure (Expired Code)

- Check `current_timestamp BETWEEN start_date AND end_date` fails
- Transaction ROLLBACK
- Return HTTP 400 Bad Request + error code
- Purchase does NOT proceed

### Usage Limit Exceeded

- Check fails either on total or per-client limit
- Transaction ROLLBACK
- Return HTTP 400 Bad Request + specific limit error
- Logged as expected validation failure (not error-level log)

### Missing or Inactive Affiliate

- `SELECT ... FOR UPDATE` finds no active affiliate
- Transaction ROLLBACK
- Return HTTP 400 Bad Request (invalid code)

### Numeric Calculation Edge Case

- Extreme base amounts or percentages still use NUMERIC (no overflow risk as NUMERIC handles arbitrary precision)
- Rounding always deterministic
- No floating-point errors possible

---

## Idempotency Strategy

**Affiliate Code Application**:

- Not inherently idempotent (each application increments usage_count)
- Protection via license purchase endpoint idempotency (already implemented)
- License purchase is protected by unique constraint on purchase ID
- If client retries same purchase: existing idempotency logic handles (no duplicate charge)

**Affiliate CRUD Operations**:

- Create: UNIQUE constraint on promo_code prevents duplicate inserts
- Update: Idempotent by nature (overwrites fields)
- Delete: Forbidden if usage records exist (prevents accidental data loss) via referential integrity
- Soft delete (status → INACTIVE): Always idempotent

**Immutable Audit Trail**:

- Every usage creates exactly one `affiliate_usages` record
- Records never deleted or updated
- Audit trail remains source of truth for reporting and reconciliation

---

## Observability Requirements

### Structured Logging Fields (Required for all affiliate operations)

```json
{
  "timestamp": "2026-02-25T14:30:00.000Z",
  "level": "info",
  "service": "api-license-purchase",
  "correlation_id": "req-abc123xyz",
  "workspace_slug": "my_institution",
  "workspace_id": "uuid",
  "user_id": "admin-uuid",
  "event": "affiliate_code_applied",
  "affiliate_id": "aff-uuid",
  "promo_code": "SPRING25",
  "discount_amount": "500.00",
  "commission_amount": "100.00",
  "license_id": "lic-uuid",
  "client_id": "client-uuid"
}
```

### Audit Log Events

**Affiliate Management**:

- `affiliate_created` - New code created
- `affiliate_updated` - Code updated (except promo_code immutable)
- `affiliate_deactivated` - Status changed to INACTIVE
- `affiliate_viewed_report` - Admin viewed usage report

**Usage Events**:

- `affiliate_code_applied` - Code successfully used in purchase
- `affiliate_code_rejected` - Code validation failed + reason
  - Reason codes: EXPIRED, INACTIVE, LIMIT_EXCEEDED, LIMIT_PER_CLIENT_EXCEEDED, NOT_FOUND

**Calculation Transparency**:

- Log includes: base_amount, discount_percentage, discount_amount
- Log includes: commission_percentage, commission_amount
- Allows offline verification of financial calculations

### Error Contract Compliance

All affiliate-related errors must follow project error standard:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AFFILIATE_CODE_INVALID",
    "message": "Affiliate code not found or inactive"
  }
}
```

Error codes:

- `AFFILIATE_CODE_NOT_FOUND`
- `AFFILIATE_CODE_INACTIVE`
- `AFFILIATE_CODE_EXPIRED`
- `AFFILIATE_USAGE_LIMIT_EXCEEDED`
- `AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED`
- `AFFILIATE_INVALID_DISCOUNT_PERCENTAGE`
- `AFFILIATE_FORBIDDEN_DUPLICATE_PROMO_CODE`

---

## Rate Limiting & Abuse Protection

### Affiliate CRUD Operations (Admin Endpoints)

- **Classification**: Admin/Protected
- **Rate Limit**: Standard admin rate limiting (existing rate limit policy applies)
- **Affected Operations**: Create, Update, Deactivate affiliate
- **No new rate limiting needed**: Reuse existing admin endpoint rate limits

### License Purchase with Affiliate (Public/Auth Endpoint)

- **Classification**: Public/Authenticated
- **Existing Rate Limit**: Already enforced on license purchase endpoint (5 attempts / min per user)
- **No new rate limiting needed**: Affiliate code validation is substep within purchase
- **Concurrency**: Affiliate lock mechanism itself prevents abuse (natural throttling)

### Affiliate Usage Export/Reporting (Admin Endpoint)

- **Classification**: Admin/Protected
- **Rate Limit**: Standard admin limits
- **No new rate limiting needed**: Reuse existing admin endpoint rate limits

---

## Layer Separation Confirmation

✓ **Frontend (MMC UI)**:

- Displays affiliate list, usage data (read from API)
- No business logic, no direct DB access
- Uses shadcn-vue components + Tailwind CSS

✓ **API Layer**:

- Routes to affiliate CRUD endpoints
- Calls domain package for validation and calculation
- Executes tenant resolver (N/A - admin only) and admin auth
- Never embeds business rules in route handlers

✓ **Domain Layer**:

- Pure functions for financial calculations
- Validation logic (date ranges, limits, etc.)
- No HTTP logic, no framework dependencies
- Reusable across API and Worker

✓ **Worker Layer**:

- Not directly involved in affiliate system
- Database migrations executed by worker (if applicable)
- No affiliate-specific async jobs needed for Phase 2

✓ **Master DB**:

- Only database accessed for affiliate operations
- Tenant DBs remain untouched
- No cross-database joins

---

## Explicit Non-Goals

This feature does NOT include:

- **Workspace-level promo codes**: Affiliate system is B2B commercial only (master_db). Workspace-level promotional codes are handled separately in Backoffice phase.
- **Student subscription discounts**: Affiliate system applies only to B2B license purchases, not student plans.
- **Dynamic discount recalculation**: Once a license is purchased with an affiliate code, the discount is immutable (no retroactive adjustments).
- **Affiliate payout system**: This stage implements tracking only. Payouts/accounting are handled by separate financial operations.
- **Email notifications for affiliate usage**: Notification system is handled by worker/alert system (separate stage).
- **Oauth/external affiliate networks**: Only internal platform-managed affiliates; no third-party integration in this stage.

---

## Test Strategy

### Unit Tests (Business Logic)

**Financial Calculation Module**:

- ✓ Test discount_amount calculation with various percentages
- ✓ Test commission_amount calculation with various percentages
- ✓ Test rounding to 2 decimals (deterministic ROUND behavior)
- ✓ Test edge cases: 0%, 100%, fractional amounts
- ✓ Test invalid percentages (negative, > 100)

**Validation Module**:

- ✓ Test promo code format validation (uppercase, alphanumeric)
- ✓ Test date range validation (start < end, current time within range)
- ✓ Test usage limit enforcement (total and per-client)
- ✓ Test status validation (ACTIVE vs INACTIVE)

### Integration Tests (API Flow)

**Affiliate CRUD Endpoints**:

- ✓ Create affiliate with valid data
- ✓ Reject duplicate promo_code
- ✓ Reject invalid percentages (< 0, > 100)
- ✓ Prevent updating immutable promo_code
- ✓ Deactivate affiliate (soft delete)
- ✓ List affiliates with filters (status, date range)
- ✓ View affiliate usage history

**License Purchase with Affiliate**:

- ✓ Apply valid affiliate code (discount applied correctly)
- ✓ Reject expired code (current timestamp outside range)
- ✓ Reject inactive affiliate
- ✓ Reject code with limit exceeded
- ✓ Reject code with per-client limit exceeded
- ✓ Purchase without affiliate code (normal flow unaffected)

### Transaction & Concurrency Tests

- ✓ Transactional integrity: Concurrent purchases don't corrupt usage_count
- ✓ Usage limit enforcement under concurrency (multiple purchases simultaneously)
- ✓ Lock timeout behavior (graceful degradation)
- ✓ Rollback on validation failure (usage_count not incremented)

### Idempotency & Audit Tests

- ✓ Duplicate usage records not created on retry
- ✓ Audit log captures every usage event
- ✓ Immutability of affiliate_usages records enforced
- ✓ Calculation audit trail allows offline reconciliation

### Edge Case Tests

- ✓ Very large base_amounts (still precise NUMERIC calculation)
- ✓ Fractional percentages (0.01%, 99.99%)
- ✓ Date boundaries (start_date exactly, end_date exactly)
- ✓ Connection loss during transaction (rollback confirmed)

---

## Final Constitutional Compliance Statement

**Isolation**: ✓ Master_db only, no tenant data access  
**License Enforcement**: ✓ Existing framework unchanged, affiliate enforced within purchase transaction  
**Attempt Engine**: ✓ Untouched, remains pristine  
**Transactional Boundaries**: ✓ Single atomic transaction with row locking  
**Server Authority**: ✓ Server time validates affiliate windows, not client time  
**Versioning**: ✓ Forward-only migration with version bump  
**Error Handling**: ✓ Structured error responses per standard  
**Observability**: ✓ Structured logging with correlation ID tracking  
**Layer Separation**: ✓ UI/API/Domain properly isolated  
**Idempotency**: ✓ License purchase already idempotent; affiliate code validation is atomic within transaction

**Compliant with Zidney Constitution v1.2.0 — No violations detected.**

---

## References

- [STAGE_13_AFFILIATES.md](../../phases/02_PLATFORM_MMC/STAGE_13_AFFILIATES.md) - Stage requirements document
- [PROJECT_CONTEXT_PRIMER.md](../../PROJECT_CONTEXT_PRIMER.md) - Architectural context
- [ADR-0006: Server Time Authoritative](../../architecture/ADR-0006-server-time-authoritative.md)
- [ADR-0008: Semantic Versioning](../../architecture/ADR-0008-semantic-versioning.md)
