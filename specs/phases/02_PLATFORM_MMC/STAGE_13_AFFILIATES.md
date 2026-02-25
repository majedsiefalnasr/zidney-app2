# STAGE 13 – Platform Affiliates (B2B)

Phase: 2 – Platform MMC  
Status: Commercial Core  
Scope: Affiliate promo codes for license-level sales

---

## Stage Status

Status: DRAFT
Risk Level: LOW
Last Updated: 2026-02-25T00:20:00Z

Tasks Generated:

- Total: 43 atomic tasks
- Parallelizable: 18 tasks (42% of total)
- Implementation Phases: 9 (Setup → Polish)
- Critical Path: 4-5 developer weeks
- Parallelized: ~3 weeks (4 parallel batches)

Scope Coverage:

- Database: 3 tables, migrations, constraints, indexes, triggers
- API: 5 endpoints + license purchase integration hook
- Domain: Financial calculations, validators
- Concurrency: Row-level locking, atomic transactions
- Observability: Audit logging, structured logging, correlation ID
- Error Handling: 8 affiliate-specific error codes
- Testing: CRUD, integration, concurrency, edge cases
- Documentation: API docs, developer guides

Deferred Scope:

- None — all scope covered in task set

Constitutional Compliance:

- Task set compliant with all architecture principles
- No cross-tenant logic
- Master_db only
- Transactional integrity enforced
- Financial determinism guaranteed
- Drift analysis gate pending

Notes:
Atomic task set generated. All 43 tasks locked and ready. Drift analysis gate pending before implementation.

Implement Affiliate system at MMC level.

This system applies only to:

- License purchases
- B2B commercial agreements

This system does NOT apply to:

- Student subscriptions
- Workspace-level promo codes
- Tenant database logic

Workspace affiliate logic is handled separately in Backoffice phase.

---

## Architectural Boundary

Affiliate logic:

- Lives entirely in master_db
- Executes during license purchase flow
- Does not modify tenant database
- Does not modify license limits
- Does not override license lifecycle

Affiliate affects only:

- Commercial discount calculation
- Commission calculation
- Revenue reporting

---

## Data Model

### affiliates (master_db)

Fields:

- id (uuid)
- promo_code (varchar, unique, uppercase)
- discount_percentage (numeric(5,2))
- commission_percentage (numeric(5,2))
- allow_with_other_discounts (boolean)
- usage_limit_total (integer, nullable)
- usage_limit_per_client (integer, nullable)
- usage_count (integer, default 0)
- start_date (timestamp)
- end_date (timestamp)
- status (ACTIVE | INACTIVE)
- description (text)
- created_at
- updated_at

Constraints:

- promo_code immutable after creation
- discount_percentage between 0 and 100
- commission_percentage between 0 and 100
- start_date < end_date

No floating point types allowed for financial calculations.

---

### affiliate_usages (master_db)

Fields:

- id (uuid)
- affiliate_id (fk)
- client_id (fk)
- license_id (fk)
- base_amount (numeric(12,2))
- discount_amount (numeric(12,2))
- commission_amount (numeric(12,2))
- created_at

Indexes required:

- affiliate_id
- client_id
- license_id

No deletion allowed.

---

## Promo Code Rules

Promo code must:

- Be uppercase
- Be alphanumeric
- Be globally unique
- Be immutable

Affiliate must not auto-apply.
Must be explicitly provided during license purchase.

---

## Usage Enforcement (Transactional)

On license purchase with promo code:

1. Lock affiliate row (SELECT ... FOR UPDATE)
2. Validate status = ACTIVE
3. Validate current timestamp within start_date and end_date
4. Validate usage_limit_total if defined
5. Validate usage_limit_per_client if defined
6. Calculate discount_amount
7. Calculate commission_amount
8. Insert affiliate_usages record
9. Increment usage_count
10. Commit transaction

All above steps must execute in a single database transaction.

No partial state allowed.

---

## Financial Calculation Rules

Given:

base_amount

discount_amount = base_amount × discount_percentage / 100  
commission_amount = base_amount × commission_percentage / 100

Rounding:

- Round to 2 decimal places
- Deterministic rounding mode
- No floating math in application layer

Financial calculation must be auditable.

---

## Concurrency Protection

Because license purchases may occur concurrently:

- usage_count increment must be transactional
- usage_limit_total must be checked inside transaction
- per-client usage must be counted inside same transaction

No cached counters allowed.

---

## Deactivation Rules

If affiliate status = INACTIVE:

- Cannot be used for new purchases
- Historical usages preserved
- Reporting unaffected

Deletion is forbidden if usage records exist.

Soft delete optional (status only).

---

## MMC UI Requirements

Affiliate list must support:

- Search by promo_code
- Filter by status
- Filter by date range
- Usage count display
- Total discount display
- Total commission display

Row actions:

- Edit (except promo_code)
- Disable
- View usage history
- Export report

---

## Reporting Requirements

Reporting must calculate:

- Total usages
- Total discount amount
- Total commission generated
- Usage per client
- Usage by date range

Reports must read only from master_db.

No tenant data required.

---

## Observability & Audit

Every usage must generate:

- Audit log entry
- Correlation ID
- license_id reference
- client_id reference

Audit log must include:

- affiliate_id
- discount_amount
- commission_amount

No silent failures allowed.

---

## Validation Criteria

Stage complete when:

- Affiliate CRUD functional
- Unique constraint enforced
- Transactional usage enforced
- Usage limits enforced
- Financial calculations accurate
- Concurrency safe
- Expired codes rejected
- INACTIVE codes rejected
- Audit logs generated
- Reporting accurate

---

## Not Allowed

- Editing promo_code after creation
- Floating-point financial math
- Non-transactional usage increment
- Silent over-usage
- Negative discount
- Discount > 100%
- Commission > 100%
- Deleting affiliate with usages

---

## Commercial Integrity Principle

Affiliate affects revenue distribution.

All calculations must be:

- Deterministic
- Transactional
- Auditable
- Reproducible

Financial integrity is mandatory.

---

## Clarifications

### Session 2026-02-25

#### Q1: Admin Endpoint Placement & Tenant Resolver Handling

**Decision: Option A – Backend API Routes (apps/api/src/routes/mmc/affiliates/)**

**Rationale:**

- Reuses existing API authentication infrastructure
- Consistent with Zidney's layering model and import boundary rules
- Centralizes all API routing logic in a single service

**Implementation Details:**

- Affiliate CRUD endpoints do NOT use tenant resolver (these are admin/MMC operations, not workspace-bound)
- Middleware chain: `Authenticate(MMC Token) → RBAC(Admin Role Check) → Route Handler`
- MMC UI authenticates using MMC-generated JWT token (signed with shared secret)
- No tenant context required; all operations scoped to master_db only
- Error responses return HTTP 403 if user lacks ADMIN role

#### Q2: MMC Token Validation Strategy

**Decision: JWT-based Admin Tokens**

**Implementation Details:**

- **Token Generation:** MMC service generates tokens on successful admin login
- **Format:** JWT (HS256) with industry-standard claims (iss, exp, aud, sub, scope)
- **Signing Method:** Symmetric (HS256) using shared secret between MMC and API
- **Shared Secret:** Configured via environment variable `MMC_JWT_SECRET` (rotated every 90 days per security policy)
- **Expiry:** 24 hours standard for admin sessions
- **Validation Middleware:** NEW file at `apps/api/src/middleware/auth/mmc-token-validator.ts` (non-tenant-resolver auth chain)
- **Validation Logic:**
  - Verify JWT signature using shared secret
  - Check expiry timestamp
  - Validate issuer = "mmc"
  - Check role scope includes "admin"
  - Reject on any signature failure, expiry, or invalid claim
- **Error Response:** HTTP 401 (Unauthorized) for token failures
- **Implementation Task:** Must be explicit task in plan.md (marked as blocking affiliate route deployment)

#### Q3: Promo Code Input Validation in License Purchase

**Decision: Strict Schema Validation with Normalization**

**Implementation Details:**

- **Zod Schema:** `z.string().trim().toUpperCase().min(3).max(50).regex(/^[A-Z0-9]+$/)`
- **Validation Location:** License purchase handler at `apps/api/src/routes/licenses/purchase.ts` (existing license domain)
- **Validation Results:**
  - **Valid:** Alphanumeric, 3–50 characters, uppercase
  - **Rejected:** Non-alphanumeric chars, < 3 chars, > 50 chars, mixed case
- **Error Handling:** HTTP 400 with error code `INVALID_PROMO_CODE`
- **Normalization:** Input automatically trimmed + converted to uppercase before validation
- **Affiliation Logic:** After validation passes, promo code checked against affiliates table (existing transactional usage flow applies)
- **User Feedback:** Clear error message: "Promo code must be 3–50 characters, alphanumeric only"
