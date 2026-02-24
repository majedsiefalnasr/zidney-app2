# Tasks — Licenses Management (STAGE_10_LICENSES)

**Stage:** STAGE_10_LICENSES  
**Phase:** 02_PLATFORM_MMC  
**Status:** IN PROGRESS  
**Generated:** 2026-02-22  
**Target Completion:** 75 atomically-executable tasks

---

## Stage Context

- **Phase:** 02_PLATFORM_MMC (Platform MMC Control Layer)
- **Stage:** STAGE_10_LICENSES (License Management — Commercial Activation Layer)
- **Related Plan:** specs/runtime/010-licenses-management/reports/PLAN_REPORT.md
- **Related Spec:** specs/runtime/010-licenses-management/reports/SPECIFY_REPORT.md
- **Related Clarification:** specs/runtime/010-licenses-management/reports/CLARIFY_REPORT.md
- **Related ADR:** ADR-0001 (Multi-Tenancy), ADR-0005 (Opt-In Upgrades), ADR-0008 (Semantic Versioning)

---

## Phase 1: Setup & Infrastructure Preparation

**Objective:** Prepare API structure and shared infrastructure for license management implementation.

---

### T001: Create License Domain Package Structure

- [ ] T001 Create domain package directory structure in `packages/domain-core/src/licenses/`
  - **Files to create:**
    - `packages/domain-core/src/licenses/index.ts` (barrel export)
    - `packages/domain-core/src/licenses/types.ts` (TypeScript interfaces)
    - `packages/domain-core/src/licenses/constants.ts` (enums, error codes)
    - `packages/domain-core/src/licenses/errors.ts` (custom error classes)
  - **Transaction:** No
  - **Idempotency:** N/A (initialization)
  - **Middleware:** N/A
  - **Version Required:** No

### T002: Create License Types & Interfaces

- [ ] T002 Define License domain types in `packages/domain-core/src/licenses/types.ts`
  - **Interfaces to define:**
    - `License` (full entity with 21 fields per plan)
    - `CreateLicenseRequest` (user input schema)
    - `EditLicenseRequest` (mutable fields only)
    - `LicenseStatus` (enum: PENDING_PROVISION | ACTIVE | SOFT_LOCKED | PROVISION_FAILED | ARCHIVED | DELETED)
    - `ProvisioningJobPayload` (worker input)
  - **Exports:** Named exports from `packages/domain-core/src/licenses/index.ts`
  - **Transaction:** No
  - **Idempotency:** N/A
  - **Middleware:** N/A
  - **Version Required:** No

### T003: Create License Constants & Error Codes

- [ ] T003 Define license error codes in `packages/domain-core/src/licenses/constants.ts`
  - **Error codes (14 total per plan):**
    - VALIDATION_ERROR (INVALID_SLUG_FORMAT, SLUG_NOT_UNIQUE, INVALID_PRODUCT_ID, INVALID_LIMIT, INVALID_LANGUAGE)
    - INVALID_STATE_TRANSITION
    - UNAUTHORIZED (AUTH_MISSING, AUTH_INVALID)
    - FORBIDDEN (PERMISSION_DENIED, LICENSE_SOFT_LOCKED, LICENSE_ARCHIVED)
    - NOT_FOUND (LICENSE_NOT_FOUND, WORKSPACE_NOT_FOUND)
    - UPGRADE_REQUIRED (SCHEMA_VERSION_MISMATCH)
    - SERVICE_UNAVAILABLE (PROVISIONING_QUEUE_UNAVAILABLE, PROVISIONING_FAILED, LICENSE_PENDING_PROVISION)
  - **Status enum:** PENDING_PROVISION, ACTIVE, SOFT_LOCKED, PROVISION_FAILED, ARCHIVED, DELETED
  - **Transaction:** No
  - **Idempotency:** N/A
  - **Middleware:** N/A
  - **Version Required:** No

### T004: Create License Custom Error Classes

- [ ] T004 Implement error classes in `packages/domain-core/src/licenses/errors.ts`
  - **Classes:**
    - `LicenseValidationError` extends `ValidationError`
    - `LicenseNotFoundError` extends `NotFoundError`
    - `InvalidStateTransitionError` extends `AppError`
    - `ProvisioningError` extends `AppError`
  - **Features:** Include error code, HTTP status, sanitized message
  - **Transaction:** No
  - **Idempotency:** N/A
  - **Middleware:** N/A
  - **Version Required:** No

### T005: Create API License Routes Module

- [ ] T005 Create routes module in `apps/api/src/routes/licenses.ts`
  - **Stub route registration (no implementation yet)** for all 10 endpoints:
    - POST /v1/mmc/licenses
    - GET /v1/mmc/licenses
    - GET /v1/mmc/licenses/:id
    - PATCH /v1/mmc/licenses/:id
    - POST /v1/mmc/licenses/:id/soft-lock
    - POST /v1/mmc/licenses/:id/unlock
    - POST /v1/mmc/licenses/:id/archive
    - POST /v1/mmc/licenses/:id/restore
    - DELETE /v1/mmc/licenses/:id
    - POST /v1/mmc/licenses/:id/retry-provisioning
  - **File structure:** Use Hono router pattern
  - **Transaction:** No
  - **Idempotency:** N/A
  - **Middleware:** Yes (will wire middleware in later task)
  - **Version Required:** No

### T006: [P] Create API Controller Stubs

- [ ] T006 [P] Create controller stub in `apps/api/src/controllers/licenses.controller.ts`
  - **Methods (stubs with placeholder implementations):**
    - `create()`, `list()`, `getDetail()`, `edit()`, `softLock()`, `unlock()`, `archive()`, `restore()`, `delete()`, `retryProvisioning()`
  - **Response format:** RFC 7807 with { success, data, error }
  - **Transaction:** No
  - **Idempotency:** N/A
  - **Middleware:** No
  - **Version Required:** No

### T007: [P] Create License Service Stub

- [ ] T007 [P] Create service stub in `packages/domain-core/src/licenses/license.service.ts`
  - **Methods (placeholders):**
    - `create()`, `list()`, `getById()`, `edit()`, `softLock()`, `unlock()`, `archive()`, `restore()`, `delete()`, `retryProvisioning()`
  - **Dependency injection:** Constructor with repositories, queue, logger
  - **Transaction:** No
  - **Idempotency:** N/A
  - **Middleware:** No
  - **Version Required:** No

### T008: [P] Create License Repository Stub

- [ ] T008 [P] Create repository stub in `packages/domain-core/src/licenses/license.repository.ts`
  - **Methods (placeholders):**
    - `create()`, `getById()`, `listByStatus()`, `listByProduct()`, `update()`, `softLock()`, `unlock()`, `archive()`, `restore()`, `delete()`
  - **Database access:** Use masterDB connection pool
  - **Transaction:** No (queries will be wrapped in transaction tasks)
  - **Idempotency:** N/A
  - **Middleware:** No
  - **Version Required:** No

---

## Phase 2: Database Schema & Migrations

**Objective:** Create and version the master database schema for licenses table and supporting structures.

---

### T009: Create Main Licenses Table Migration

- [ ] T009 Create migration file `apps/api/src/db/master/migrations/001_create_licenses_table.ts`
  - **Migration tasks:**
    - Create `status_enum` type with values: PENDING_PROVISION, ACTIVE, SOFT_LOCKED, PROVISION_FAILED, ARCHIVED, DELETED
    - Create `licenses` table with 21 fields (see plan for field definitions)
    - Primary key: `id` (UUID)
    - Foreign key: `product_id` → products.id (ON DELETE RESTRICT, ON UPDATE CASCADE)
    - Unique constraint: `workspace_slug` (globally unique)
    - Check constraints: slug format, limits non-negative, length bounds
    - NOT NULL constraints: id, product_id, workspace_slug, workspace_name, status, schema_version, product_version, created_at, updated_at, use_zidney_payment, default_language, uses_divisions, provisioning_retries
  - **Indexes created:**
    - idx_licenses_status (on status)
    - idx_licenses_created_at (on created_at DESC)
    - idx_licenses_product_id (on product_id)
  - **Down migration:** DROP TABLE licenses, DROP TYPE status_enum
  - **Transaction:** Single transaction, atomic
  - **Idempotency:** Idempotent (IF NOT EXISTS checks)
  - **Middleware:** N/A
  - **Version Required:** Yes (schema_version: 1 → 2)
  - **Rollback consideration:** Test rollback path

### T010: Create Provisioning Fields Migration

- [ ] T010 Create migration file `apps/api/src/db/master/migrations/002_add_provisioning_fields.ts`
  - **Migration tasks:**
    - ALTER TABLE licenses ADD COLUMN provisioning_error TEXT DEFAULT NULL
    - ALTER TABLE licenses ADD COLUMN provisioning_retries INTEGER DEFAULT 0 NOT NULL
    - ALTER TABLE licenses ADD COLUMN provisioning_last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
    - Create composite index `idx_licenses_soft_lock_until` (on soft_lock_until WHERE status = 'SOFT_LOCKED')
  - **Down migration:** DROP COLUMN (reverse order)
  - **Transaction:** Single transaction
  - **Idempotency:** Idempotent (IF NOT EXISTS on columns)
  - **Middleware:** N/A
  - **Version Required:** Yes (schema_version: 2 → 3)
  - **Testing:** Verify existing licenses not affected

### T011: Create Status Enum Extension Migration

- [ ] T011 Create migration file `apps/api/src/db/master/migrations/003_add_status_enum_values.ts`
  - **Migration tasks:**
    - ALTER TYPE status_enum ADD VALUE 'PROVISION_FAILED' (before 'ARCHIVED' if ordering matters)
    - Validate existing records still valid
  - **Down migration:** Note (PostgreSQL ENUM limitation: cannot remove values; requires type recreation if needed)
  - **Transaction:** Single transaction
  - **Idempotency:** Idempotent (careful sequencing, no IF EXISTS for ENUM)
  - **Middleware:** N/A
  - **Version Required:** Yes (schema_version: 3 → 4)
  - **PostgreSQL note:** Schema migration script adds explanatory comment

### T012: [P] Create Update Timestamp Trigger

- [ ] T012 [P] Create trigger for auto-updating `updated_at` field
  - **File:** `apps/api/src/db/master/migrations/004_add_updated_at_trigger.ts`
  - **Trigger:** `licenses_updated_at_trigger` BEFORE UPDATE
  - **Function:** `update_timestamp()` (shared across tables, idempotent)
  - **Logic:** NEW.updated_at = NOW()
  - **Transaction:** Single transaction
  - **Idempotency:** Idempotent (CREATE OR REPLACE)
  - **Middleware:** N/A
  - **Version Required:** Yes (schema_version: 4 → 5)

### T013: [P] Create Audit Log Table

- [ ] T013 [P] Create audit table migration in `apps/api/src/db/master/migrations/005_create_audit_log_table.ts`
  - **Table:** `audit_log`
  - **Fields:**
    - id (UUID, PK)
    - license_id (UUID, FK)
    - action (VARCHAR(50), enum: SOFT_LOCK, UNLOCK, ARCHIVE, RESTORE, DELETE, EDIT)
    - old_status (status_enum, nullable)
    - new_status (status_enum, nullable)
    - reason (TEXT, nullable)
    - correlation_id (VARCHAR(100))
    - created_at (TIMESTAMP, DEFAULT NOW())
  - **Indexes:** idx_audit_license_id, idx_audit_created_at
  - **Transaction:** Single transaction
  - **Idempotency:** Idempotent
  - **Middleware:** N/A
  - **Version Required:** Yes (schema_version: 5 → 6)

### T014: Create Tenants Registry Table Update for License Binding

- [ ] T014 Create migration to link existing `tenants_registry` to licenses in `apps/api/src/db/master/migrations/006_update_tenants_registry_for_licenses.ts`
  - **Migration tasks:**
    - Add column `license_id` (UUID, FK → licenses.id) to tenants_registry
    - Create index `idx_tenants_registry_license_id`
    - Add NOT NULL constraint (after backfilling)
    - Add unique constraint on license_id (1:1 relationship)
  - **Notes per spec:** tenants_registry must NOT contain status field (status only in licenses table)
  - **Transaction:** Single transaction
  - **Idempotency:** Idempotent
  - **Middleware:** N/A
  - **Version Required:** Yes (schema_version: 6 → 7)

### T015: Create Migration Runner & Version Tracking

- [ ] T015 Implement migration runner in `apps/api/src/db/migrations/runner.ts`
  - **Responsibilities:**
    - Load all migration files from masters/migrations/ and tenant/migrations/
    - Execute in order by filename
    - Track schema_version in schema_versions table
    - Validate checksums (SHA256)
    - Rollback support (down migrations)
    - Idempotency: Skip already-executed migrations
  - **Transaction:** Each migration in its own transaction
  - **Idempotency:** Yes (track executed migrations in DB)
  - **Middleware:** N/A
  - **Version Required:** N/A (runner itself handles versioning)

---

## Phase 3: Repository & Domain Service Layer

**Objective:** Implement data access layer and core business logic for licenses.

---

### T016: Implement License Repository — Create

- [ ] T016 Implement `create()` method in `packages/domain-core/src/licenses/license.repository.ts`
  - **Query template:**
    - INSERT INTO licenses (id, product_id, workspace_slug, workspace_name, ..., status, created_at, updated_at)
    - VALUES (?, ?, ?, ..., 'PENDING_PROVISION', NOW(), NOW())
  - **Transaction:** Yes (wrap in transaction task T035)
  - **Idempotency:** No (unique constraint on workspace_slug enforced)
  - **Error handling:** Catch unique constraint violations → SLUG_NOT_UNIQUE
  - **Return:** Mapped License object

### T017: Implement License Repository — Get By ID

- [ ] T017 Implement `getById()` method in `packages/domain-core/src/licenses/license.repository.ts`
  - **Query:** SELECT \* FROM licenses WHERE id = ? AND deleted_at IS NULL
  - **Return:** License object or null

### T018: [P] Implement License Repository — List Methods

- [ ] T018 [P] Implement list methods in `packages/domain-core/src/licenses/license.repository.ts`
  - **Methods:**
    - `listByStatus(status: LicenseStatus, limit, offset): Promise<License[]>`
    - `listByProduct(product_id: UUID, limit, offset): Promise<License[]>`
    - `listWithFilters(filters: {status?, product_id?, search?}, pagination): Promise<{items, total}>`
  - **Queries:** Use parameterized queries with ILIKE for search, ORDER BY created_at DESC
  - **Transaction:** No
  - **Return:** Array of License objects with pagination metadata

### T019: [P] Implement License Repository — Update Methods

- [ ] T019 [P] Implement update methods in `packages/domain-core/src/licenses/license.repository.ts`
  - **Methods:**
    - `update(id: UUID, data: Partial<License>): Promise<License>`
    - `updateStatus(id: UUID, status: LicenseStatus): Promise<License>`
  - **Queries:** UPDATE licenses SET ... WHERE id = ? RETURNING \*
  - **Transaction:** Yes (wrap in service layer transaction)
  - **Validation:** Immutable fields rejected in update data
  - **Return:** Updated License object

### T020: [P] Implement License Repository — Status Transition Methods

- [ ] T020 [P] Implement status transition methods in `packages/domain-core/src/licenses/license.repository.ts`
  - **Methods:**
    - `softLock(id: UUID, grace_period_days: number): Promise<License>`
    - `unlock(id: UUID): Promise<License>`
    - `archive(id: UUID): Promise<License>`
    - `restore(id: UUID): Promise<License>`
    - `delete(id: UUID): Promise<License>`
  - **Queries:** UPDATE licenses SET status = ?, soft_lock_until = ?, ... WHERE id = ? RETURNING \*
  - **Transaction:** Yes (wrap in transaction task)
  - **Return:** Updated License object

### T021: Implement License Repository — Direct Getters

- [ ] T021 Implement direct getter methods for repository support
  - **Methods in `license.repository.ts`:**
    - `getByWorkspaceSlug(slug: string): Promise<License | null>`
    - `countByProduct(product_id: UUID): Promise<number>`
    - `findExpiredSoftLocks(): Promise<License[]>` (for cron task)
  - **Queries:** SELECT \* FROM licenses WHERE workspace_slug = ?
  - **Transaction:** No

### T022: Implement Platform Schema Version Getter

- [ ] T022 Implement `getPlatformSchemaVersion()` in `packages/domain-core/src/licenses/license.repository.ts`
  - **Query:** SELECT version FROM schema_versions ORDER BY version DESC LIMIT 1
  - **Return:** number (current schema version)
  - **Error handling:** Throw if not found

### T023: Implement License Service — Create

- [ ] T023 Implement `create()` method in `packages/domain-core/src/licenses/license.service.ts`
  - **Business logic steps:**
    1. Validate product exists and status = ACTIVE → throw INVALID_PRODUCT_ID
    2. Validate workspace slug format (regex ^[a-z0-9-]+$, length 3-64) → throw INVALID_SLUG_FORMAT
    3. Validate slug globally unique → throw SLUG_NOT_UNIQUE
    4. Validate limits >= 0 or null → throw INVALID_LIMIT
    5. Validate language code (ISO 639-1) → throw INVALID_LANGUAGE
    6. Validate commission >= 0 → throw VALIDATION_ERROR
    7. Fetch current schema_version
    8. Fetch product.product_version
    9. Call repository.create() with snapshotted versions
    10. Enqueue provisioning job (via queue service)
    11. Emit event: 'license:created'
    12. Return License object
  - **Transaction:** Wrap in transaction (T035)
  - **Idempotency:** No (enforced by unique constraint)
  - **Logging:** Structured log: license_created with license_id, workspace_slug, correlation_id

### T024: Implement License Service — Validation Methods

- [ ] T024 Implement validation helper methods in `packages/domain-core/src/licenses/license.service.ts`
  - **Methods:**
    - `validateWorkspaceSlug(slug: string): void`
    - `validateLimits(student_limit, staff_limit): void`
    - `validateLanguageCode(lang: string): void`
    - `validateProductActive(product_id: UUID): Promise<void>`
    - `validateSlugUnique(slug: string): Promise<void>`
  - **Throw:** Appropriate LicenseValidationError on failure

### T025: [P] Implement License Service — Read Methods

- [ ] T025 [P] Implement read methods in `packages/domain-core/src/licenses/license.service.ts`
  - **Methods:**
    - `getById(id: UUID): Promise<License>`
    - `list(filters, pagination): Promise<{items, total}>`
    - `getByWorkspaceSlug(slug: string): Promise<License>`
  - **Error handling:** Throw NOT_FOUND if license not found

### T026: [P] Implement License Service — Edit

- [ ] T026 [P] Implement `edit()` method in `packages/domain-core/src/licenses/license.service.ts`
  - **Business logic steps:**
    1. Fetch license by ID → throw NOT_FOUND
    2. Validate only editable fields in request (student_limit, staff_limit, commission_per_user, use_zidney_payment, default_language, uses_divisions)
    3. Reject if immutable fields present → throw INVALID_FIELD_EDIT
    4. Validate new values (limits, language, etc.)
    5. Call repository.update()
    6. Emit event: 'license:edited'
    7. Return updated License
  - **Transaction:** Yes (wrap in T035)
  - **Logging:** Structured log: license_edited with changed_fields

### T027: [P] Implement License Service — Status Transitions

- [ ] T027 [P] Implement status transition methods in `packages/domain-core/src/licenses/license.service.ts`
  - **Methods:**
    - `softLock(id: UUID, grace_period_days: number, reason?: string): Promise<License>`
    - `unlock(id: UUID, reason?: string): Promise<License>`
    - `archive(id: UUID, reason?: string): Promise<License>`
    - `restore(id: UUID, reason?: string): Promise<License>`
    - `delete(id: UUID): Promise<License>`
  - **Validation rules (per plan):**
    - softLock: only from ACTIVE → SOFT_LOCKED
    - unlock: only from SOFT_LOCKED → ACTIVE
    - archive: only from SOFT_LOCKED → ARCHIVED
    - restore: only from ARCHIVED → ACTIVE
    - delete: only from ARCHIVED → DELETED
    - Throw INVALID_STATE_TRANSITION if rules violated
  - **Transaction:** Yes (each wrapped in transaction)
  - **Side effects:**
    - Insert audit_log entry
    - Emit events: license:soft_locked, license:unlocked, license:archived, license:restored, license:deleted
  - **Logging:** Structured logs for each transition

### T028: Implement License Service — Retry Provisioning

- [ ] T028 Implement `retryProvisioning()` method in `packages/domain-core/src/licenses/license.service.ts`
  - **Business logic steps:**
    1. Fetch license by ID → throw NOT_FOUND
    2. Verify status = PROVISION_FAILED → throw INVALID_STATE_TRANSITION
    3. Verify provisioning_retries < 5 → throw RETRY_LIMIT_EXCEEDED
    4. Verify backoff period respected (2s \* 2^retry_count) → throw RATE_LIMITED
    5. Increment provisioning_retries
    6. Clear provisioning_error
    7. Set status = PENDING_PROVISION
    8. Update provisioning_last_attempt_at = NOW()
    9. Call repository.update()
    10. Enqueue provisioning job (same payload as original)
    11. Emit event: 'provisioning:retry_requested'
    12. Return updated License
  - **Transaction:** Yes (T035)
  - **Idempotency:** Yes (check backoff prevents immediate duplicate retries)
  - **Logging:** Structured log: provisioning_retry_requested with retry_count

---

## Phase 4: API Layer — Controllers & Request Handling

**Objective:** Implement HTTP endpoints for license CRUD and status management operations.

---

### T029: Implement License Controller — Create Endpoint

- [ ] T029 Implement `create()` method in `apps/api/src/controllers/licenses.controller.ts`
  - **HTTP Semantics:**
    - Route: POST /v1/mmc/licenses
    - Status code: 201 Created
    - Response format: { success: true, data: License, error: null }
  - **Steps:**
    1. Parse request body
    2. Call licenseService.create() with validated input
    3. Return 201 with license object
  - **Error handling:**
    - Catch ValidationError → 400 with error details
    - Catch UniqueConstraintError → 400 SLUG_NOT_UNIQUE
    - Catch queue unavailable → 503 SERVICE_UNAVAILABLE
    - Catch other → 500 INTERNAL_ERROR
  - **Headers:** Content-Type: application/json

### T030: Implement License Controller — List Endpoint

- [ ] T030 Implement `list()` method in `apps/api/src/controllers/licenses.controller.ts`
  - **HTTP Semantics:**
    - Route: GET /v1/mmc/licenses
    - Query params: status, product_id, search, page, limit, sort_by, sort_order
    - Status code: 200 OK
    - Response format: { success: true, data: {licenses: [], pagination: {page, limit, total, pages}}, error: null }
  - **Steps:**
    1. Validate query parameters (page >= 1, limit <= 100)
    2. Call licenseService.list() with filters
    3. Include usage metrics (student_count, staff_count) if available (graceful fallback if tenant DB unreachable)
    4. Return 200 with paginated results
  - **Error handling:** Bad pagination params → 400 VALIDATION_ERROR

### T031: Implement License Controller — Get Details Endpoint

- [ ] T031 Implement `getDetail()` method in `apps/api/src/controllers/licenses.controller.ts`
  - **HTTP Semantics:**
    - Route: GET /v1/mmc/licenses/:id
    - Status code: 200 OK
    - Response: Full license object with usage metrics and audit info
  - **Steps:**
    1. Extract ID from path parameter
    2. Call licenseService.getById(id)
    3. Append usage metrics and contextual hints
    4. Return 200
  - **Error handling:** License not found → 404 NOT_FOUND

### T032: Implement License Controller — Edit Endpoint

- [ ] T032 Implement `edit()` method in `apps/api/src/controllers/licenses.controller.ts`
  - **HTTP Semantics:**
    - Route: PATCH /v1/mmc/licenses/:id
    - Status code: 200 OK
  - **Steps:**
    1. Parse request body (only editable fields)
    2. Call licenseService.edit(id, data)
    3. Return 200 with updated license
  - **Error handling:**
    - Immutable field attempt → 400 INVALID_FIELD_EDIT
    - License not found → 404
    - Validation error → 400

### T033: [P] Implement License Controller — Status Transition Endpoints

- [ ] T033 [P] Implement status transition methods in `apps/api/src/controllers/licenses.controller.ts`
  - **Methods:**
    - `softLock(context)` → POST /v1/mmc/licenses/:id/soft-lock → 200
    - `unlock(context)` → POST /v1/mmc/licenses/:id/unlock → 200
    - `archive(context)` → POST /v1/mmc/licenses/:id/archive → 200 (triggers snapshot job)
    - `restore(context)` → POST /v1/mmc/licenses/:id/restore → 200 (triggers restore job)
    - `delete(context)` → DELETE /v1/mmc/licenses/:id → 200 (triggers database drop)
  - **Steps:** Extract ID, call service method, return 200 with updated license
  - **Error handling:**
    - Invalid state transition → 400 INVALID_STATE_TRANSITION
    - Service unavailable (snapshot, restore, delete jobs) → 503 SERVICE_UNAVAILABLE

### T034: Implement License Controller — Retry Provisioning Endpoint

- [ ] T034 Implement `retryProvisioning()` method in `apps/api/src/controllers/licenses.controller.ts`
  - **HTTP Semantics:**
    - Route: POST /v1/mmc/licenses/:id/retry-provisioning
    - Status code: 200 OK
  - **Steps:**
    1. Call licenseService.retryProvisioning(id)
    2. Return 200 with updated license
  - **Error handling:**
    - License not in PROVISION_FAILED → 400 INVALID_STATE_TRANSITION
    - Retry limit exceeded → 400 RETRY_LIMIT_EXCEEDED
    - Rate limited (backoff) → 400 RATE_LIMITED
    - Queue unavailable → 503 SERVICE_UNAVAILABLE

---

## Phase 5: Transaction & Consistency Layer

**Objective:** Wrap write operations in transactions and implement idempotency guarantees.

---

### T035: Implement Transaction Wrapper for Write Operations

- [ ] T035 Implement transaction wrapper in `packages/domain-core/src/licenses/license.repository.ts`
  - **Pattern:** Helper method `withTransaction(callback)` that:
    1. BEGIN transaction
    2. Execute callback
    3. COMMIT on success
    4. ROLLBACK on error
    5. Return result or throw error
  - **Usage:** Used by create(), update(), softLock(), unlock(), archive(), restore(), delete() methods
  - **Database atomicity:** All-or-nothing guarantee
  - **Rollback handling:** Automatic on error; no partial updates

### T036: [P] Implement Idempotency for License Creation

- [ ] T036 [P] Implement idempotency in create flow
  - **Mechanism:** Unique constraint on workspace_slug in database
  - **Duplicate handling in controller:**
    - If UNIQUE constraint violation → Fetch existing license by slug
    - Return 201 (idempotent success) with existing license
  - **Test:** Submit create twice with same slug → verify second returns 201 with existing license

### T037: [P] Implement Idempotency for Provisioning Retry

- [ ] T037 [P] Implement idempotency in retry provisioning flow
  - **Mechanism:** Status check (PROVISION_FAILED) + backoff enforced
  - **Duplicate handling:** If status != PROVISION_FAILED, reject as invalid transition
  - **Backoff:** Calculate required delay, reject if too soon (backoff tolerance window = 500ms)

### T038: Implement Audit Log Writing

- [ ] T038 Implement audit log insertion for all status transitions
  - **Steps in each status transition method:**
    1. Execute status update in transaction
    2. Insert audit_log entry (same transaction)
    3. Include correlation_id from context
  - **Transactional guarantee:** Audit entry written atomically with status change
  - **File:** Implement in `packages/domain-core/src/licenses/audit.repository.ts`

---

## Phase 6: Middleware Layer

**Objective:** Implement license enforcement middleware and tenant routing validation.

---

### T039: Implement License Middleware

- [ ] T039 Implement `licenseLicenseMiddleware()` in `apps/api/src/middleware/license.middleware.ts`
  - **Purpose:** Validate license before allowing tenant API access
  - **Steps:**
    1. Query master_db for license by workspace_slug
    2. If not found → 404 LICENSE_NOT_FOUND
    3. Check status in ALLOWED_STATUSES (only 'ACTIVE')
    4. If not allowed:
       - PENDING_PROVISION → 503 SERVICE_UNAVAILABLE (workspace not ready)
       - SOFT_LOCKED → 403 FORBIDDEN (commercial issue)
       - ARCHIVED → 403 FORBIDDEN (workspace archived)
       - PROVISION_FAILED → 503 SERVICE_UNAVAILABLE (provisioning error)
       - DELETED → 404 NOT_FOUND (no longer exists)
    5. Check soft-lock expiration (lazy evaluation):
       - If status = SOFT_LOCKED AND NOW() > soft_lock_until:
         - Atomically UPDATE status → ARCHIVED
         - Return 403 (grace period expired)
    6. Attach license to context: `context.license = license`
    7. Log structured event: license_middleware_pass
  - **Error handling:** Structured logging for all blocked requests
  - **Idempotency:** N/A (read-only checks)
  - **Transaction:** No (read-only)

### T040: Register License Middleware in Router

- [ ] T040 Register `licenseLicenseMiddleware()` in `apps/api/src/routes/index.ts`
  - **Scope:** Apply to all tenant-bound routes: `/v1/tenant/*`
  - **Order:** After tenant resolver middleware, before route handlers
  - **Attachment:** Add middleware chain to Hono app

### T041: Implement Mutual Exclusion for Soft-Lock Expiration

- [ ] T041 Implement atomic check-and-update for soft-lock auto-transition
  - **Location:** License middleware
  - **Atomicity:**
    - Use UPDATE ... WHERE status = 'SOFT_LOCKED' AND soft_lock_until < NOW() RETURNING \*
    - Handles race condition: if multiple requests arrive simultaneously, only first succeeds
  - **Test:** Verify concurrent requests don't cause duplicate transitions

---

## Phase 7: Worker & Provisioning Jobs

**Objective:** Implement asynchronous provisioning job handler with retry and failure recovery.

---

### T042: Define Provisioning Job Queue

- [ ] T042 Define provisioning job queue in `apps/worker/src/queues/provisioning.ts`
  - **Queue name:** `provisioning:license`
  - **Bull Job configuration:**
    - Max retries: 5
    - Backoff strategy: Exponential (2s, 4s, 8s, 16s, 32s)
    - Timeout: 1800 seconds (30 minutes)
    - Remove on complete: false (keep history)
  - **Dead-letter queue:** `provisioning:dlq` (on 6th failure)
  - **Correlation ID:** Propagate from job context

### T043: Implement Provisioning Job Handler

- [ ] T043 Implement job handler in `apps/worker/src/jobs/provisioning.handler.ts`
  - **Handler signature:** `async handleProvisioningJob(job: ProvisioningJobPayload): Promise<void>`
  - **Steps (per plan):**
    1. Log structured event: provisioning_started
    2. Idempotency check: Verify no existing tenant database
       - If exists: Mark license as ACTIVE (idempotent success), return
    3. Validate license still in PENDING_PROVISION
    4. Create tenant database: CREATE DATABASE tenant\_{workspace_slug}
    5. Get tenant DB connection
    6. Run baseline schema migrations
    7. Seed baseline data (roles, permissions, settings)
    8. Create admin account (temporary credentials)
    9. Insert into tenants_registry
    10. Update license status → ACTIVE
    11. Log structured event: provisioning_completed
  - **Error handling:**
    - On error: DROP DATABASE (cleanup)
    - Update license: status = PROVISION_FAILED, provisioning_error = sanitized_message
    - Log structured event: provisioning_failed
    - Rethrow to trigger retry or DLQ
  - **Transaction:** Each step logged; no overall transaction (idempotency key is license_id)
  - **Idempotency:** Guaranteed by step 2 (database existence check)

### T044: Implement Idempotency Check in Provisioning Handler

- [ ] T044 Implement database existence check in provisioning handler
  - **Query:** SELECT datname FROM pg*database WHERE datname = 'tenant*{workspace_slug}'
  - **Logic:**
    - If found: License already provisioned (idempotent success)
    - If not found: Proceed with provisioning
  - **Multi-request safety:** Atomic query ensures only one handler performs create

### T045: Implement Baseline Schema Migration Execution

- [ ] T045 Implement schema migration runner for tenant database in `apps/worker/src/tenant-provisioning/migrate.ts`
  - **Purpose:** Execute all tenant baseline schema migrations on new database
  - **Steps:**
    1. Connect to tenant database
    2. Load migration files from `apps/api/src/db/tenant/migrations/`
    3. Execute in order
    4. Update schema_version table
    5. Validate final schema matches expected version
  - **Error handling:** Fail provisioning if any migration fails

### T046: Implement Tenant Database Seeding

- [ ] T046 Implement baseline data seeding in `apps/worker/src/tenant-provisioning/seed.ts`
  - **Seed data:**
    - Default roles (admin, instructor, student, guest)
    - Default permissions (per role)
    - Default settings (language, timezone, etc.)
    - Institution metadata (from license)
  - **Parameterization:** Use license fields (default_language, uses_divisions, etc.)
  - **Error handling:** Fail provisioning if any seed fails

### T047: Implement Admin Account Creation

- [ ] T047 Implement admin account creation in `apps/worker/src/tenant-provisioning/admin.ts`
  - **Account details:**
    - Email: `admin@{workspace_slug}.internal`
    - Temporary password: Generated securely, stored in log (or returned to UI)
    - Role assignment: Admin role
  - **Password handling:** Passwords not logged; hint or reset link provided instead
  - **Error handling:** Fail provisioning if account creation fails

### T048: Implement Tenants Registry Insertion

- [ ] T048 Implement tenants registry insertion in provisioning handler
  - **Query:** INSERT INTO tenants_registry (license_id, workspace_slug, database_name, workspace_id, created_at) VALUES (?, ?, ?, ?, NOW())
  - **Fields:**
    - license_id: From job payload
    - workspace_slug: From job payload
    - database*name: `tenant*{workspace_slug}`
    - workspace_id: UUID (generated or from license)
  - **Constraint:** One-to-one relationship enforced by unique license_id

### T049: Implement Provisioning Failure Cleanup

- [ ] T049 Implement cleanup logic on provisioning failure
  - **Steps:**
    1. Drop partial database: DROP DATABASE IF EXISTS tenant\_{workspace_slug} WITH (FORCE)
    2. Remove partial tenants_registry entry (if inserted)
    3. Sanitize error message (no internal details)
    4. Update license: status = PROVISION_FAILED, provisioning_error = sanitized_message
  - **Safety:** All cleanup steps have error handling to prevent cascading failures

### T050: Implement Job Retry Exponential Backoff

- [ ] T050 Configure and implement retry backoff for provisioning jobs
  - **Backoff calculation:**
    ```
    delay = base_delay * (2 ^ attempt_number) + random_jitter
    base_delay = 2 seconds
    max_attempts = 6 (1 initial + 5 retries)
    jitter = 0-20% random
    ```
  - **Configuration:** Bull job options with backoff strategy
  - **Test:** Verify retry delays increase exponentially

### T051: Implement Dead-Letter Queue Handling

- [ ] T051 Implement DLQ processing for provisioning jobs
  - **Trigger:** After 6 failed attempts
  - **DLQ processor:**
    - Move job to DLQ topic `provisioning:dlq`
    - Log alert: `provisioning_job_dlq_moved`
    - Update license: status = PROVISION_FAILED, mark as requires_manual_intervention
  - **Observability:** DLQ jobs visible in admin dashboard (future task)

### T052: Implement Provisioning Error Message Sanitization

- [ ] T052 Create sanitization utility for provisioning errors in `packages/domain-core/src/errors/sanitize.ts`
  - **Purpose:** Remove implementation details from error messages before storing in license.provisioning_error
  - **Examples:**
    - DB connection error → "Database connection failed"
    - Migration error → "Schema validation failed"
    - Permission denied → "Access error during setup"
  - **Safety:** Full errors logged to worker logs; sanitized versions in license table

### T053: Implement Correlation ID Propagation in Jobs

- [ ] T053 Implement correlation ID extraction and propagation in worker jobs
  - **Pattern:**
    1. Extract correlation_id from job context (or generate new one)
    2. Attach to all logged events
    3. Pass to any downstream calls
  - **Logging:** All provisioning logs include correlation_id for tracing

---

## Phase 8: Job Enqueueing & Integration

**Objective:** Integrate job enqueueing into API layer and implement side-effect handlers.

---

### T054: Implement Queue Service

- [ ] T054 Create queue service in `packages/domain-core/src/queue/queue.service.ts`
  - **Methods:**
    - `enqueueProvisioningJob(license_id, payload): Promise<void>`
    - `enqueueSnapshotJob(license_id, workspace_slug): Promise<void>`
    - `enqueueRestoreJob(license_id, workspace_slug): Promise<void>`
    - `enqueueDatabaseDropJob(license_id, workspace_slug): Promise<void>`
  - **Dependency injection:** Inject Bull queue instances
  - **Error handling:** Throw if queue unavailable (caught by controller → 503)

### T055: Implement Provisioning Job Enqueueing in Create Endpoint

- [ ] T055 Integrate job enqueueing in LicenseService.create()
  - **Steps:**
    1. After license inserted in DB
    2. Call queueService.enqueueProvisioningJob(license.id, payload)
    3. If queue fails: License created but queue missed
       - Log warning: provisioning_job_enqueue_failed
       - Return 201 (optimistic) with warning flag
       - UI shows "Provisioning queued but check status later"
  - **Failure handling:** Manual retry button available in UI (T028, T034)

### T056: [P] Implement Snapshot Job Enqueueing

- [ ] T056 [P] Create snapshot job handler stubs in `apps/worker/src/jobs/snapshot.handler.ts` (DEFER implementation to Stage 12)
  - **Stub:** Implement enqueueing in archive endpoint
  - **Payload:** {license_id, workspace_slug, snapshot_type: 'archive'}
  - **Full implementation:** Deferred to snapshot/archive enhancement

### T057: [P] Implement Restore Job Enqueueing

- [ ] T057 [P] Create restore job handler stubs in `apps/worker/src/jobs/restore.handler.ts` (DEFER implementation to Stage 12)
  - **Stub:** Implement enqueueing in restore endpoint
  - **Payload:** {license_id, workspace_slug}
  - **Full implementation:** Deferred to restore enhancement

### T058: [P] Implement Database Drop Job Enqueueing

- [ ] T058 [P] Create database drop job handler stubs in `apps/worker/src/jobs/database-drop.handler.ts` (DEFER implementation to Stage 12)
  - **Stub:** Implement enqueueing in delete endpoint
  - **Payload:** {license_id, workspace_slug}
  - **Full implementation:** Deferred to deletion enhancement

---

## Phase 9: Observability & Logging

**Objective:** Implement structured logging and correlation ID propagation throughout system.

---

### T059: Implement Structured Logging for License Operations

- [ ] T059 Implement structured logging service in `packages/logger/src/license-logger.ts`
  - **Logger methods:**
    - `license_created(license, correlation_id)`
    - `license_edited(license, changed_fields, correlation_id)`
    - `license_soft_locked(license, grace_until, correlation_id)`
    - `license_unlocked(license, correlation_id)`
    - `license_archived(license, snapshot_initiated, correlation_id)`
    - `license_restored(license, correlation_id)`
    - `license_deleted(license, correlation_id)`
    - `provisioning_started(license_id, workspace_slug, attempt, correlation_id)`
    - `provisioning_completed(license_id, workspace_slug, correlation_id)`
    - `provisioning_failed(license_id, workspace_slug, error, attempt, correlation_id)`
  - **Fields per event:**
    - timestamp (ISO8601 UTC)
    - level (INFO, WARN, ERROR)
    - service (api, worker, etc.)
    - message (event name)
    - correlation_id
    - workspace_slug
    - license_id
    - event_type (license_lifecycle, provisioning_job, etc.)
    - additional details (status, error_message, etc.)
  - **Output:** Structured JSON via Pino logger

### T060: [P] Implement Correlation ID Generation & Propagation

- [ ] T060 [P] Implement correlation ID middleware in `apps/api/src/middleware/correlation-id.middleware.ts`
  - **Pattern:**
    1. Extract from request header: X-Correlation-ID or x-request-id
    2. If not present: Generate new UUID
    3. Attach to context: `context.correlation_id = id`
    4. Propagate to all downstream calls (services, logs, jobs)
  - **Header inclusion:** Response includes X-Correlation-ID header
  - **Job context:** Correlation ID passed to job payload for worker tracing

### T061: [P] Implement No Console.log Enforcement

- [ ] T061 [P] Add linter configuration to catch `console.log` usage
  - **Tool:** ESLint rule `no-console` (error severity)
  - **Exception:** Allow `console.error` only in development (catch block safety net)
  - **File:** Update `.eslintrc.json` in monorepo root

### T062: Implement Error Logging with Sanitization

- [ ] T062 Implement error logging in all controllers
  - **Pattern:**
    1. Internal log: Full error details (stack, query, etc.)
    2. API response: Sanitized message (no implementation details)
  - **Examples:**
    - Internal: "Query failed: SELECT \* FROM licenses WHERE id = ?"
    - Public: "Database error occurred"
  - **File:** Implement in `packages/logger/src/error-sanitizer.ts`

### T063: [P] Implement Audit Log Querying

- [ ] T063 [P] Create audit log query service in `packages/domain-core/src/licenses/audit.service.ts`
  - **Methods:**
    - `getByLicenseId(license_id): Promise<AuditEntry[]>`
    - `getRecentTransitions(limit): Promise<AuditEntry[]>`
  - **Usage:** UI can display license history/timeline

---

## Phase 10: Testing — Unit & Integration

**Objective:** Implement comprehensive unit and integration tests for all layers.

---

### T064: Create License Types & Interfaces Tests

- [ ] T064 Create tests in `tests/unit/domain/licenses/types.test.ts`
  - **Test cases:**
    - License type validation (all 21 fields)
    - Status enum validation
    - CreateLicenseRequest validation
    - EditLicenseRequest validation (editable fields only)
    - ProvisioningJobPayload validation
  - **Framework:** Vitest + TypeScript type checks

### T065: Create License Repository Tests

- [ ] T065 Create tests in `tests/integration/domain/licenses/license.repository.test.ts`
  - **Test cases:**
    - create(): Insert and verify all fields
    - create() idempotency: Duplicate slug → unique violation
    - getById(): Fetch existing and non-existing
    - update(): Verify only editable fields updated
    - softLock(): Status transition + soft_lock_until set
    - archive(): Status transition
    - delete(): Terminal state, deleted_at set
    - listByStatus(): Filter accuracy
    - listWithFilters(): Search functionality
  - **Database:** Integration test with test database
  - **Transaction isolation:** Test transaction rollback

### T066: Create License Service Tests

- [ ] T066 Create tests in `tests/integration/domain/licenses/license.service.test.ts`
  - **Test cases:**
    - create(): Full flow with validation and job enqueueing
    - create() validation: Invalid product, slug format, limits
    - create() slug uniqueness: Duplicate check
    - getById(): Fetch and error handling
    - edit(): Editable vs immutable fields
    - edit() validation: Invalid values
    - softLock(): State transition + audit log
    - unlock(): State transition + audit log
    - archive(): State transition
    - restore(): State transition
    - delete(): Terminal state + precondition check
    - retryProvisioning(): Status transitions + backoff
    - retryProvisioning() limits: Retry limit enforcement
  - **Mocking:** Mock queue service, mock repositories where needed
  - **Coverage:** >90% line coverage

### T067: Create License Middleware Tests

- [ ] T067 Create tests in `tests/unit/middleware/license.middleware.test.ts`
  - **Test cases:**
    - License found + ACTIVE → pass through
    - License not found → 404 NOT_FOUND
    - License SOFT_LOCKED → 403 FORBIDDEN
    - License PENDING_PROVISION → 503 SERVICE_UNAVAILABLE
    - License ARCHIVED → 403 FORBIDDEN
    - License PROVISION_FAILED → 503 SERVICE_UNAVAILABLE
    - Soft-lock expiration: Auto-transition to ARCHIVED
    - Soft-lock expiration race condition: Only first request transitions
  - **Mocking:** Mock database queries

### T068: Create Provisioning Job Handler Tests

- [ ] T068 Create tests in `tests/integration/worker/provisioning.handler.test.ts`
  - **Test cases:**
    - Happy path: Database created, migrations run, seeding complete, license → ACTIVE
    - Idempotency: Duplicate job with same license_id → no-op success
    - Validation: License not in PENDING_PROVISION → fail
    - Cleanup: Partial database dropped on error
    - Failure handling: Status → PROVISION_FAILED, error message sanitized
    - Retry: Job retries with exponential backoff
    - Timeout: Job fails after 30 minutes
  - **Database:** Integration test with test database
  - **Job queue:** Mock Bull queue or use in-memory queue for tests

### T069: Create License API Controller Tests

- [ ] T069 Create tests in `tests/integration/api/licenses.controller.test.ts`
  - **Test cases:**
    - POST /licenses: Create successful, response 201
    - POST /licenses validation: Invalid input → 400
    - POST /licenses idempotency: Duplicate slug → 400
    - GET /licenses: List with filters, pagination
    - GET /licenses/:id: Get single, not found → 404
    - PATCH /licenses/:id: Edit limits successful
    - PATCH /licenses/:id validation: Immutable field → 400
    - POST /licenses/:id/soft-lock: State transition + audit log
    - POST /licenses/:id/unlock: State transition
    - POST /licenses/:id/archive: State transition + snapshot job
    - POST /licenses/:id/restore: State transition + restore job
    - DELETE /licenses/:id: Delete only if ARCHIVED
    - POST /licenses/:id/retry-provisioning: Retry from PROVISION_FAILED
  - **HTTP layer:** Full HTTP request/response testing
  - **Coverage:** All error cases

### T070: Create Version Mismatch Edge Case Tests

- [ ] T070 Create tests in `tests/unit/domain/licenses/version.test.ts`
  - **Test cases:**
    - Schema version immutable: Verify no update after creation
    - Product version immutable: Verify no update after creation
    - Version snapshot at creation: Correct versions captured
    - Version compatibility future enforcement (Stage 11): Placeholder test
  - **Mocking:** Mock product repository with version getter

### T071: [P] Create Concurrency Tests

- [ ] T071 [P] Create tests in `tests/edge-cases/licenses/concurrency.test.ts`
  - **Test cases:**
    - Concurrent creates with same slug: Only one succeeds
    - Concurrent soft-lock + unlock: No race condition
    - Concurrent provisioning retries: Idempotent
    - Concurrent database provisioning: Only one creates database
  - **Approach:** Multiple parallel promises, verify consistency

### T072: [P] Create Rate Limiting Tests

- [ ] T072 [P] Create tests in `tests/unit/domain/licenses/rate-limiting.test.ts`
  - **Test cases:**
    - Provisioning retry backoff enforced: Reject too-soon retries
    - Backoff window: Allow retries after delay
  - **Mocking:** Mock time functions

### T073: [P] Create Error Mapping Tests

- [ ] T073 [P] Create tests in `tests/unit/api/error-mapping.test.ts`
  - **Test cases:**
    - All 14+ error codes map to correct HTTP status
    - RFC 7807 format compliance
    - Sensitive data not leaked in public responses
    - Internal logs contain full details

### T074: [P] Create Transaction Rollback Tests

- [ ] T074 [P] Create tests in `tests/integration/domain/licenses/transactions.test.ts`
  - **Test cases:**
    - Create transaction: On error, license not inserted
    - Update transaction: On error, original state preserved
    - Audit log transaction: Audit entry not written if update fails
  - **Database:** Use transaction isolation levels

---

## Phase 11: Frontend UI Implementation

**Objective:** Implement MMC UI components for license management.

---

### T075: Create License List View Component

- [ ] T075 Create `apps/mmc/src/views/licenses/LicenseList.vue`
  - **Features:**
    - Table display: workspace_slug, workspace_name, product_name, status, limits, created_at, actions
    - Status colors: Green (ACTIVE), Orange (SOFT_LOCKED), Gray (ARCHIVED), Blue (PENDING), Red (FAILED)
    - Filters: Status dropdown, Product dropdown, Search input
    - Pagination: Page selector, limit selector (20/50/100)
    - Row actions: View, Edit, Soft Lock, Archive, Delete (conditional)
    - Create button: Top right, navigates to create form
    - Empty state: Icon + CTA to create first license
    - Loading states: Spinner while fetching
    - Error states: Error message with retry
  - **Tech stack:** Vue 3, shadcn-vue, Tailwind v4, TanStack Query
  - **API integration:** GET /v1/mmc/licenses (with filters, pagination)

### T076: Create License Detail View Component

- [ ] T076 Create `apps/mmc/src/views/licenses/LicenseDetail.vue`
  - **Sections:**
    - Header: License ID, Status badge, Created, Updated dates
    - License Info: ID, Workspace, Product, Versions (read-only)
    - Resource Limits: Student/Staff counts and limits (edit button)
    - Commercial: Payment enabled, Commission (edit button)
    - Institutional: Language, Divisions (edit button)
    - Usage Metrics: Current student/staff counts
    - Provisioning Status: (if PROVISION_FAILED) Error message, Retry button
    - Soft Lock Info: (if SOFT_LOCKED) Grace until, Unlock button
    - Archive Info: (if ARCHIVED) Archived at, Restore button
    - Actions: Edit, Soft Lock, Unlock, Archive, Restore, Delete (conditional)
  - **API integration:** GET /v1/mmc/licenses/:id
  - **Error handling:** Not found → navigate to list

### T077: Create License Create Form Component

- [ ] T077 Create `apps/mmc/src/views/licenses/LicenseCreate.vue`
  - **Form fields:**
    - Product selection: Dropdown, real-time validation
    - Workspace slug: Text input, real-time format check, async uniqueness check
    - Workspace name: Text input
    - Resource limits: Student, Staff (optional, number inputs)
    - Commercial settings: Payment toggle, Commission input (conditional)
    - Institutional settings: Language dropdown, Divisions toggle
  - **Validation:**
    - Real-time slug format validation (feedback message)
    - Async slug uniqueness check (loading indicator)
    - Required fields check
    - Form-level error display
  - **API integration:** POST /v1/mmc/licenses
  - **Success:** Redirects to license detail view
  - **Error handling:** Form-level error display, retry button

### T078: Create License Edit Modal Component

- [ ] T078 Create `apps/mmc/src/views/licenses/LicenseEdit.vue`
  - **Form fields (editable only):**
    - Student limit
    - Staff limit
    - Commission per user
    - Use Zidney payment
    - Default language
    - Uses divisions
  - **Display (immutable, grayed out):**
    - Workspace slug
    - Product
    - Schema version
    - Product version
  - **API integration:** PATCH /v1/mmc/licenses/:id
  - **Success:** Close modal, refresh detail view
  - **Error handling:** Field-level error highlighting

### T079: Create License Status Change Modals

- [ ] T079 Create status change modal components
  - **SoftLockModal.vue:**
    - Grace period input (default 90, min 1, max 365)
    - Reason textarea
    - Warning message about blocked access
    - Confirm (red, destructive) + Cancel
    - API: POST /v1/mmc/licenses/:id/soft-lock
  - **ArchiveModal.vue:**
    - Reason textarea
    - Warning about read-only state
    - Snapshot notification
    - Confirm (red, destructive) + Cancel
    - API: POST /v1/mmc/licenses/:id/archive
  - **RestoreModal.vue:**
    - Confirmation message
    - API: POST /v1/mmc/licenses/:id/restore
  - **UnlockModal.vue:**
    - Quick confirmation, blue CTA
    - API: POST /v1/mmc/licenses/:id/unlock
  - **DeleteModal.vue:**
    - Warning: "Permanent deletion. Cannot be undone."
    - Confirmation checkbox
    - Confirm (red, destructive) + Cancel
    - API: DELETE /v1/mmc/licenses/:id

### T080: Create License Status Badge Component

- [ ] T080 Create `apps/mmc/src/components/LicenseStatusBadge.vue`
  - **Display:** Icon + status text
  - **Colors:**
    - ACTIVE: ✅ Green
    - SOFT_LOCKED: ⚠️ Orange
    - ARCHIVED: 📦 Gray
    - PENDING_PROVISION: ⏳ Blue (with spinner)
    - PROVISION_FAILED: ❌ Red
    - DELETED: 🗑️ Dark gray
  - **Tooltip:** Hover shows status explanation

### T081: [P] Create License Table Reusable Component

- [ ] T081 [P] Create `apps/mmc/src/components/LicenseTable.vue`
  - **Purpose:** Reusable table for list view
  - **Props:** licenses array, loading state, pagination
  - **Emits:** row-click, action-click, pagination-change
  - **Features:** Sortable columns, pagination controls

### T082: [P] Create License Form Reusable Component

- [ ] T082 [P] Create `apps/mmc/src/components/LicenseForm.vue`
  - **Purpose:** Reusable form for create and edit
  - **Props:** initialData, mode (create/edit), submitHandler
  - **Features:** Field validation, error display, loading state

### T083: Create API Client for License Endpoints

- [ ] T083 Create `apps/mmc/src/api/licenses.api.ts`
  - **Methods:**
    - `createLicense(data): Promise<License>`
    - `listLicenses(filters, pagination): Promise<PaginatedList>`
    - `getLicense(id): Promise<License>`
    - `editLicense(id, data): Promise<License>`
    - `softLockLicense(id, reason?): Promise<License>`
    - `unlockLicense(id, reason?): Promise<License>`
    - `archiveLicense(id, reason?): Promise<License>`
    - `restoreLicense(id, reason?): Promise<License>`
    - `deleteLicense(id): Promise<void>`
    - `retryProvisioning(id, reason?): Promise<License>`
  - **Error handling:** Parse error responses, throw appropriate errors
  - **HTTP client:** Use configured API client (Axios or fetch)

### T084: [P] Create License State Management (if using Pinia)

- [ ] T084 [P] Create `apps/mmc/src/stores/licenses.store.ts` (optional, if using Pinia)
  - **State:**
    - licenses: License[]
    - currentLicense: License | null
    - loading: boolean
    - error: Error | null
  - **Actions:**
    - fetchLicenses(filters, pagination)
    - fetchLicense(id)
    - createLicense(data)
    - editLicense(id, data)
    - softLockLicense(id, reason?)
    - etc.
  - **Getters:** activeCount, archivedCount, etc.

### T085: [P] Create License Routing

- [ ] T085 [P] Create routes in `apps/mmc/src/router/index.ts` (if using Vue Router)
  - **Routes:**
    - /licenses → LicenseList
    - /licenses/new → LicenseCreate
    - /licenses/:id → LicenseDetail
  - **Guards:** Require authentication, admin role

---

## Phase 12: Validation & Error Handling Excellence

**Objective:** Implement comprehensive input validation and error standardization.

---

### T086: Create Workspace Slug Validation Schema

- [ ] T086 Create slug validation in `packages/validation/src/licenses/slug.validation.ts`
  - **Rules:**
    - Pattern: ^[a-z0-9-]+$
    - Length: 3-64 characters
    - Case: Must be lowercase (enforced on input)
    - Regex: Use `Zod` or similar schema validator
  - **Error messages:**
    - Too short/long: "Slug must be 3-64 characters"
    - Invalid format: "Slug must contain only lowercase letters, numbers, and dashes"
  - **Exported:** Schema usable in API validation

### T087: Create Limit Validation Schema

- [ ] T087 Create limit validation in `packages/validation/src/licenses/limits.validation.ts`
  - **Rules:**
    - Type: Number or null
    - Range: >= 0 or null (for unlimited)
    - Error messages:
      - "Must be 0 or greater"
      - "Must be null for unlimited"
  - **Exported:** Shared schema

### T088: Create Language Code Validation

- [ ] T088 Create language validation in `packages/validation/src/licenses/language.validation.ts`
  - **Supported codes:** en, ar, fr, de, es, etc. (ISO 639-1)
  - **Pattern:** ^[a-z]{2}(-[A-Z]{2})?$
  - **Error:** "Invalid language code"
  - **Exported:** Shared schema

### T089: Create License Request Validation Schemas

- [ ] T089 Create request schemas in `packages/validation/src/licenses/schemas.ts`
  - **Schemas:**
    - `CreateLicenseRequestSchema` (required fields: product_id, workspace_slug, workspace_name, etc.)
    - `EditLicenseRequestSchema` (optional fields: only editable ones)
    - `SoftLockRequestSchema` (optional: grace_period_days, reason)
    - `RetryProvisioningRequestSchema` (optional: reason)
  - **Validation:** Use Zod or similar
  - **Error handling:** Returns ZodError with field-level errors

### T090: Create RFC 7807 Error Response Formatter

- [ ] T090 Create error formatter in `packages/domain-core/src/errors/rfc7807.ts`
  - **Format:**
    ```typescript
    {
      success: false,
      data: null,
      error: {
        type: string,
        title: string,
        status: number,
        detail: string,
        instance?: string,  // correlation_id
        code?: string
      }
    }
    ```
  - **Usage:** Called in all error handlers
  - **Exported:** Error response builder

### T091: Create Error Code to HTTP Status Mapping

- [ ] T091 Create mapping in `packages/domain-core/src/errors/error-codes.ts`
  - **Mapping:** Error code → HTTP status + RFC 7807 response
  - **14+ error codes:** VALIDATION_ERROR, INVALID_STATE_TRANSITION, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, UPGRADE_REQUIRED, SERVICE_UNAVAILABLE, etc.
  - **Usage:** Controller error handlers reference this mapping

---

## Phase 13: Integration Tests — End-to-End Scenarios

**Objective:** Implement high-level integration tests covering complete user journeys.

---

### T092: Create End-to-End License Creation & Provisioning Test

- [ ] T092 Create test in `tests/integration/e2e/license-creation.e2e.test.ts`
  - **Scenario:**
    1. Create license via API
    2. Verify license inserted with status PENDING_PROVISION
    3. Verify provisioning job queued
    4. Simulate provisioning worker execution
    5. Verify database created
    6. Verify license status → ACTIVE
    7. Verify tenants_registry populated
  - **Database:** Full integration with test DB
  - **Queue:** Use in-memory queue for testing

### T093: Create End-to-End Status Lifecycle Test

- [ ] T093 Create test in `tests/integration/e2e/license-lifecycle.e2e.test.ts`
  - **Scenario:**
    1. Create license → PENDING_PROVISION
    2. Simulate provisioning → ACTIVE
    3. Soft lock → SOFT_LOCKED
    4. Verify soft-lock middleware blocks access
    5. Unlock → ACTIVE
    6. Verify access restored
    7. Soft lock → SOFT_LOCKED
    8. Archive → ARCHIVED
    9. Verify archive middleware blocks access
    10. Restore → ACTIVE
    11. Delete → DELETED
  - **Middleware:** Test license middleware at each step
  - **Audit:** Verify audit log entries created

### T094: Create Provisioning Retry Scenario Test

- [ ] T094 Create test in `tests/integration/e2e/provisioning-retry.e2e.test.ts`
  - **Scenario:**
    1. Create license → PENDING_PROVISION
    2. Provisioning job fails (simulated)
    3. License status → PROVISION_FAILED
    4. Retry provisioning job
    5. Provisioning succeeds
    6. License status → ACTIVE
  - **Backoff:** Verify backoff enforcement
  - **Retry limit:** Verify limit enforcement (max 5 retries)

### T095: Create Concurrent Requests Test

- [ ] T095 Create test in `tests/integration/e2e/concurrent-requests.e2e.test.ts`
  - **Scenario:**
    1. Send 10 concurrent license creation requests with same slug
    2. Verify only 1 succeeds
    3. Verify 9 get SLUG_NOT_UNIQUE error
  - **Isolation:** Verify transactions prevent duplicates

### T096: Create Soft-Lock Expiration Test

- [ ] T096 Create test in `tests/integration/e2e/soft-lock-expiration.e2e.test.ts`
  - **Scenario:**
    1. Create license, provision to ACTIVE
    2. Soft lock with 1-second grace period
    3. Wait for expiration
    4. Send request to workspace
    5. Verify middleware auto-transitions to ARCHIVED
    6. Verify subsequent requests blocked
  - **Time handling:** Mock time or use short TTL for testing

### T097: Create Audit Trail Completeness Test

- [ ] T097 Create test in `tests/integration/e2e/audit-trail.e2e.test.ts`
  - **Scenario:**
    1. Perform all license operations (create, edit, soft-lock, etc.)
    2. Query audit_log
    3. Verify all operations logged with correlation_id, user, reason
    4. Verify audit entries match license state changes
  - **Coverage:** All status transitions, all edits

---

## Phase 14: Documentation & Deployment Readiness

**Objective:** Create documentation, deployment guides, and operational playbooks.

---

### T098: [P] Create API Documentation

- [ ] T098 [P] Create API documentation in `docs/api/licenses/README.md`
  - **Content:**
    - Endpoint reference (all 10 endpoints)
    - Request/response schemas (with examples)
    - Error codes and HTTP status mappings
    - Authentication requirements
    - Rate limiting (if applicable)
  - **Format:** OpenAPI 3.0 or Swagger format (optional)

### T099: [P] Create Database Schema Documentation

- [ ] T099 [P] Create schema docs in `docs/db/licenses-schema.md`
  - **Content:**
    - licenses table structure (all 21 fields)
    - Constraints and indexes
    - Relationships (product_id FK)
    - Status enum definition
    - Migration summary

### T100: [P] Create Operational Runbook

- [ ] T100 [P] Create runbook in `docs/operations/licenses-runbook.md`
  - **Content:**
    - Provisioning failure troubleshooting
    - Manual retry procedure
    - Soft-lock/archive/restore procedures
    - Audit log querying
    - Common issues and resolutions
    - Monitoring alerts (future)

### T101: [P] Create Migration Deployment Guide

- [ ] T101 [P] Create migration guide in `docs/deployment/licenses-migration.md`
  - **Content:**
    - Migration execution order
    - Rollback procedures
    - Pre-flight checks
    - Post-deployment validation
    - Downtime estimate

---

## Phase 15: Integration with Existing Systems

**Objective:** Wire license management into existing MMC, API, and worker services.

---

### T102: Register License Routes in Main API Router

- [ ] T102 Register license routes in `apps/api/src/main.ts` or router index
  - **Import:** licensesRouter from `apps/api/src/routes/licenses.ts`
  - **Mount:** app.use('/v1/mmc', licensesRouter)
  - **Middleware:** Ensure auth middleware applied before routes

### T103: Register License Middleware in Request Pipeline

- [ ] T103 Register license middleware in `apps/api/src/main.ts`
  - **Middleware chain order:**
    1. Correlation ID middleware
    2. Auth middleware
    3. Tenant resolver middleware
    4. License middleware (new)
    5. Route handlers
  - **Scope:** Apply to tenant-bound routes (/v1/tenant/\*)

### T104: Register Provisioning Job Handler with Worker

- [ ] T104 Register provisioning job handler in `apps/worker/src/main.ts`
  - **Import:** handleProvisioningJob from `apps/worker/src/jobs/provisioning.handler.ts`
  - **Queue registration:** Bull queue for `provisioning:license`
  - **Error handling:** Attach error listener to queue

### T105: Wire License Service into DI Container

- [ ] T105 Create license service instance in dependency injection container
  - **Location:** `apps/api/src/container.ts` or similar
  - **Injection:** LicenseService injected into controllers
  - **Dependencies:** LicenseRepository, QueueService, Logger

### T106: Add License Domain Package to Monorepo Exports

- [ ] T106 Export license types and services from `packages/domain-core/src/index.ts`
  - **Exports:** License type, LicenseService, LicenseError classes, enums
  - **Consumers:** UI, API, Worker can import from domain package

### T107: Register License UI Routes in MMC Router

- [ ] T107 Register license routes in `apps/mmc/src/router/index.ts`
  - **Routes:** /licenses, /licenses/new, /licenses/:id
  - **Components:** LicenseList, LicenseCreate, LicenseDetail
  - **Guards:** Auth guard + admin role check

### T108: Add License Menu Items to MMC Navigation

- [ ] T108 Add license management link to MMC sidebar/main navigation
  - **Label:** "Licenses"
  - **Icon:** (license or building icon)
  - **Route:** /licenses
  - **Visibility:** Admin/MMC users only

### T109: Add License Migrations to CI/CD Pipeline

- [ ] T109 Update CI/CD to run license migrations
  - **File:** `.github/workflows/deploy.yml` or similar
  - **Step:** Execute migrations before API startup
  - **Validation:** Verify schema_version incremented

---

## Phase 16: Performance & Optimization

**Objective:** Ensure performance targets and optimization opportunities.

---

### T110: [P] Create Database Query Performance Tests

- [ ] T110 [P] Create tests in `tests/performance/licenses-queries.perf.test.ts`
  - **Scenarios:**
    - List 1000 licenses: Should complete < 500ms
    - Search by slug: Should complete < 100ms (indexed)
    - Filter by status: Should complete < 200ms (indexed)
  - **Metrics:** Query execution time, index usage

### T111: [P] Create API Response Time Benchmarks

- [ ] T111 [P] Create benchmarks in `tests/performance/licenses-api.benchmark.ts`
  - **Scenarios:**
    - GET /licenses (list, 100 items): < 300ms
    - GET /licenses/:id (detail): < 100ms
    - POST /licenses (create): < 200ms (excluding provisioning job)
  - **Tools:** Node.js benchmark or Artillery

### T112: [P] Create Caching Strategy (If Needed)

- [ ] T112 [P] Implement optional caching layer in `packages/domain-core/src/licenses/cache.ts`
  - **Candidates:** List endpoint (user rarely changes filters mid-session)
  - **Implementation:** Redis-backed cache with TTL
  - **Invalidation:** Clear on create/edit
  - **Testing:** Cache coherency tests

### T113: [P] Create Index Optimization Review

- [ ] T113 [P] Review and optimize database indexes
  - **Review:** All indexes created in T009-T014
  - **Validation:** Ensure all WHERE clauses have matching indexes
  - **Future:** Monitor query plans in production

---

## Phase 17: Security Hardening

**Objective:** Ensure security best practices and vulnerability mitigation.

---

### T114: [P] Create SQL Injection Prevention Tests

- [ ] T114 [P] Create tests in `tests/security/sql-injection.security.test.ts`
  - **Test cases:**
    - Slug with SQL injection attempt: `acme'; DROP TABLE licenses; --`
    - Reason with injection attempt
    - Verify queries use parameterized statements
    - Verify no string concatenation in SQL

### T115: [P] Create Input Sanitization Tests

- [ ] T115 [P] Create tests in `tests/security/input-sanitization.test.ts`
  - **Test cases:**
    - XSS prevention: Unicode, special characters in workspace_name
    - HTML/script injection: Verify no execution
    - Error message sanitization: No stack traces in responses

### T116: [P] Create Authorization Tests

- [ ] T116 [P] Create tests in `tests/security/authorization.test.ts`
  - **Test cases:**
    - Tenant user cannot create licenses (MMC-only)
    - Non-admin cannot edit licenses
    - Anonymous user cannot access /licenses
    - Token validation on all endpoints

### T117: [P] Create Rate Limiting Implementation (if not done)

- [ ] T117 [P] Implement rate limiting for sensitive endpoints (if needed)
  - **Candidates:** Create license (max 10/minute/IP)
  - **Implementation:** Express rate-limit middleware or custom
  - **Testing:** Verify 429 Too Many Requests on limit exceeded

---

## Summary & Completion Checklist

**Total Tasks:** 117 (with optional [P] parallelizable tasks)  
**Required Tasks:** ~90  
**Optional/Deferred:** ~27

---

### Task Distribution by Layer

| Layer                        | Count | Task Range |
| ---------------------------- | ----- | ---------- |
| Infrastructure               | 15    | T001–T015  |
| Database & Migrations        | 7     | T009–T015  |
| Repository                   | 7     | T016–T022  |
| Domain Services              | 6     | T023–T028  |
| API Controllers              | 6     | T029–T034  |
| Transactions & Idempotency   | 4     | T035–T038  |
| Middleware                   | 3     | T039–T041  |
| Worker & Provisioning        | 12    | T042–T053  |
| Job Enqueueing               | 5     | T054–T058  |
| Observability & Logging      | 5     | T059–T063  |
| Testing — Unit & Integration | 11    | T064–T074  |
| Frontend UI                  | 11    | T075–T085  |
| Validation & Error Handling  | 6     | T086–T091  |
| Integration Tests — E2E      | 6     | T092–T097  |
| Documentation & Deployment   | 4     | T098–T101  |
| System Integration           | 9     | T102–T109  |
| Performance & Optimization   | 4     | T110–T113  |
| Security Hardening           | 4     | T114–T117  |

---

### Dependency Graph

```
Phase 1 (Setup)
    ↓
Phase 2 (Database & Migrations)
    ↓
Phase 3 (Repository & Domain)
    ├─→ Phase 4 (API Controllers)
    ├─→ Phase 5 (Transactions)
    ├─→ Phase 6 (Middleware)
    └─→ Phase 7 (Worker & Jobs)
    ↓
Phase 8 (Job Enqueueing)
Phase 9 (Observability)
Phase 10 (Testing)
Phase 11 (Frontend UI)
Phase 12 (Validation)
Phase 13 (E2E Tests)
Phase 14 (Documentation)
Phase 15 (System Integration)
Phase 16 (Performance)
Phase 17 (Security)
```

---

### Parallel Execution Opportunities

**These task groups can execute in parallel (no inter-dependencies):**

1. **T002, T003, T004** — Type definitions, constants, errors (independent)
2. **T005, T006, T007, T008** — Route, controller, service, repository stubs (independent)
3. **T009, T010, T011, T012, T013, T014** — Migrations (sequential order required, but can run once dependencies clear)
4. **T016–T022** — Repository methods (independent, can parallelize)
5. **T023–T028** — Service methods (independent, can parallelize)
6. **T029–T034** — Controller methods (independent, can parallelize)
7. **T064–T074** — Unit/integration tests (independent, can parallelize)
8. **T075–T085** — UI components (independent, can parallelize)
9. **T086–T091** — Validation schemas (independent, can parallelize)

---

### Implementation Strategy (Recommended Order)

**MVP (Phase 1–4 only):**

- Core schema, repository, service, and 3 basic endpoints (create, list, get)
- Target: 40–50 tasks
- Estimated time: 1 week

**Phase 1–8 (Full API):**

- All endpoints, middleware, worker jobs
- Target: 60–75 tasks
- Estimated time: 2.5–3 weeks

**Phase 1–17 (Complete):**

- All layers including UI, tests, documentation
- Target: 90–117 tasks
- Estimated time: 4–5 weeks

---

### Non-Goals & Deferrals

Tasks **NOT** in scope (defer to future stages):

- [ ] Usage analytics & reporting (Stage 15)
- [ ] Bulk license operations (future enhancement)
- [ ] Product A/B testing per license (future enhancement)
- [ ] Advanced billing cycle management (future enhancement)
- [ ] Provisioning customization (future enhancement)
- [ ] Snapshot/restore full implementation (Stage 12+)
- [ ] Version upgrade workflows (Stage 11)
- [ ] Advanced monitoring & alerting (Stage 15+)

---

### Definition of Done (Per Task)

Each task is complete when:

- ✅ Code written and committed
- ✅ All imports/dependencies resolved
- ✅ No linting errors (`npm run lint`)
- ✅ Type checks pass (`npm run type-check`)
- ✅ Tests written and passing (if applicable)
- ✅ Code review approved
- ✅ Documented (inline comments + external docs if needed)

---

### Success Criteria for Stage Completion

Stage STAGE_10_LICENSES is PRODUCTION READY when:

1. ✅ All 10 API endpoints implemented and tested
2. ✅ License middleware enforces status lifecycle
3. ✅ Provisioning jobs complete asynchronously with retry strategy
4. ✅ All status transitions tested and audit-logged
5. ✅ MMC UI functional for license CRUD operations
6. ✅ Database-per-tenant isolation enforced (no row-based sharing)
7. ✅ Version integrity (schema_version, product_version) immutable
8. ✅ Soft-lock auto-expiration working (lazy evaluation)
9. ✅ All error codes properly mapped to HTTP status codes
10. ✅ Structured logging with correlation IDs throughout
11. ✅ Integration tests passing (end-to-end scenarios)
12. ✅ Performance targets met (queries < 500ms, API < 300ms)
13. ✅ Security tests passing (SQL injection, authorization, etc.)
14. ✅ Documentation complete and deployment guide validated
15. ✅ No console.log statements remaining

---

**Generated by:** SpecKit Tasks Generator  
**Date:** 2026-02-22  
**Stage Status:** IN PROGRESS
