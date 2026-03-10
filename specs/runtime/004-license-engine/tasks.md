# Tasks: License Engine Core

**Stage**: STAGE_04_LICENSE_ENGINE  
**Phase**: 01 – Platform Foundation  
**Branch**: `004-license-engine`  
**Created**: February 17, 2026

**Related**:

- Spec: [spec.md](spec.md)
- Plan: [plan.md](plan.md)
- Clarifications: [clarify.md](clarify.md)

---

## Task Organization & Dependencies

**MVP Scope**: US1 (License creation) + US3 (Limit enforcement) complete  
**Full Scope**: All user stories (US1-US6) complete

**Dependency Graph**:

```
SETUP (T001-T003)
  ↓
FOUNDATIONAL (T004-T010)
  ├→ US1 License Creation (T011-T015)
  ├→ US2 Soft-Lock (T016-T020)
  ├→ US3 Limit Enforcement (T021-T025)
  ├→ US4 Archive Snapshot (T026-T032)
  ├→ US5 Version Enforcement (T033-T036)
  └→ US6 Manual Deletion (T037-T039)
OBSERVABILITY (T040-T045)
TESTING (T046-T070)
```

**Parallel Execution**: Tasks T004-T010 can run in parallel (independent layers)

---

## Phase 1: Setup & Infrastructure

### T001: Create Master Database Migration

- [x] **Layer**: Infrastructure (database)
- [x] **File**: `apps/api/src/db/master/migrations/[timestamp]_create_licenses_table.ts`
- [x] **Transactions**: N/A (DDL)
- [x] **Idempotency**: N/A (DDL)
- [x] **Version Enforcement**: YES (schema_version 1.0.0 → 1.1.0)
- [x] **Middleware Required**: NO

**Description**: Create master database migration file. Includes:

- `licenses` table with all columns, constraints, indexes
- `archive_snapshots` table with deduplication logic
- Update schema_version to 1.1.0
- Rollback function (drop tables, revert version)

**Acceptance Criteria**:

- ✓ Migration file created at correct path
- ✓ Up/down functions both present
- ✓ Licenses table has CHECK constraint for valid state transitions
- ✓ UNIQUE(workspace_slug) enforces immutability
- ✓ archive_snapshots has dedup index
- ✓ Migration can run without errors
- ✓ Rollback function restores prior state

**Dependencies**: None

---

### T002: Initialize License Domain Package

- [x] **Layer**: Domain-Core (packages/domain-core)
- [x] **File**: `packages/domain-core/src/license/index.ts` (new directory)
- [x] **Transactions**: N/A (module setup)
- [x] **Idempotency**: N/A
- [x] **Version Enforcement**: NO
- [x] **Middleware Required**: NO

**Description**: Create license domain-core module structure. Includes:

- `resolver.ts` - LicenseResolver class (query master_db, cache 5min)
- `validator.ts` - VersionValidator (schema + product compatibility)
- `state-machine.ts` - StateTransition (valid transitions, idempotency keys)
- `limit-enforcer.ts` - StudentStaffCounter (COUNT queries)
- `index.ts` - Main exports
- `types.ts` - TypeScript interfaces

**File Structure**:

```
packages/domain-core/src/license/
├── index.ts (exports)
├── types.ts (interfaces)
├── resolver.ts (DB querying)
├── validator.ts (version checks)
├── state-machine.ts (transitions)
└── limit-enforcer.ts (counting)
```

**Acceptance Criteria**:

- ✓ All 5 modules created
- ✓ TypeScript strict mode passes
- ✓ All interfaces properly exported
- ✓ No circular dependencies
- ✓ Resolver has 5min cache wrapper
- ✓ StateTransition validates all allowed transitions

**Dependencies**: T001 (schema exists)

---

### T003: Create Domain-Core Tests Setup

- [x] **Layer**: Testing (domain-core)
- [x] **File**: `packages/domain-core/tests/license/` (new directory)
- [x] **Transactions**: N/A
- [x] **Idempotency**: N/A
- [x] **Version Enforcement**: NO
- [x] **Middleware Required**: NO

**Description**: Create test fixture and helper setup for license domain package.

**File Structure**:

```
packages/domain-core/tests/license/
├── fixtures.ts (mock data generators)
├── resolver.test.ts (placeholder)
├── validator.test.ts (placeholder)
├── state-machine.test.ts (placeholder)
└── limit-enforcer.test.ts (placeholder)
```

**Acceptance Criteria**:

- ✓ Fixtures.ts exports: makeLicense(), makeWorkspace(), etc.
- ✓ All test files exist (even if empty stubs)
- ✓ vitest config includes license tests

**Dependencies**: T002

---

## Phase 2: Foundational Components

### T004: Create License Resolver (Domain-Core)

- [x] **Layer**: Domain-Core
- [x] **File**: `packages/domain-core/src/license/resolver.ts`
- [x] **Transactions**: NO (read-only)
- [x] **Idempotency**: N/A
- [x] **Version Enforcement**: NO
- [x] **Middleware Required**: NO

**Description**: Implement LicenseResolver class. Queries master_db licenses, caches 5 minutes.

```typescript
class LicenseResolver {
  async getLicense(workspace_id: UUID): Promise<License | null>;
  async getLicenseBySlug(workspace_slug: string): Promise<License | null>;
  async validateLicenseStatus(workspace_id: UUID): Promise<ValidationResult>;
  async validateVersions(workspace_id: UUID, schema_version: string): Promise<Boolean>;
}
```

**Logic**:

- Query: `SELECT * FROM licenses WHERE workspace_id = $1 LIMIT 1`
- Cache key: `license:{workspace_id}:{timestamp % 300000}` (5min bucket)
- Fallback: If cache miss, query DB
- Return: License object or null

**Acceptance Criteria**:

- ✓ Resolver class created with 4 async methods
- ✓ Redis cache configured (5min TTL)
- ✓ Queries use parameterized statements (no SQL injection)
- ✓ TypeScript strict mode passes
- ✓ Unit tests for cache hit/miss

**Dependencies**: T002

---

### T005: Create Version Validator (Domain-Core)

- [x] **Layer**: Domain-Core
- [x] **File**: `packages/domain-core/src/license/validator.ts`
- [x] **Transactions**: NO (read-only)
- [x] **Idempotency**: N/A
- [x] **Version Enforcement**: YES (logic)
- [x] **Middleware Required**: NO

**Description**: Implement VersionValidator class. Validates schema + product version compatibility
(per ADR-0008).

```typescript
class VersionValidator {
  validateSchemaVersion(tenant_version: string, license_expected: string): Boolean;
  validateProductVersion(license_version: string, runtime_version: string): Boolean;
}
```

**Logic**:

- Schema: `IF tenant_version >= license_expected THEN true ELSE false`
- Product: Parse SemVer; compare MAJOR.MINOR (per ADR-0008)
  - License 1.x + Runtime 1.y → COMPATIBLE
  - License 2.x + Runtime 1.y → INCOMPATIBLE

**Acceptance Criteria**:

- ✓ Both methods implemented
- ✓ Forward-compatible schema logic (>= not ==)
- ✓ SemVer parsing uses npm semver or equivalent
- ✓ Unit tests for all scenarios (match, forward, backward, mismatch)

**Dependencies**: T002

---

### T006: Create State Machine (Domain-Core)

- [x] **Layer**: Domain-Core
- [x] **File**: `packages/domain-core/src/license/state-machine.ts`
- [x] **Transactions**: NO (validation only)
- [x] **Idempotency**: NO (transitions are stateful)
- [x] **Version Enforcement**: NO
- [x] **Middleware Required**: NO

**Description**: Implement StateTransition class. Validates allowed state transitions.

```typescript
class StateTransition {
  isValidTransition(from: LicenseStatus, to: LicenseStatus): Boolean;
  getIdempotencyKey(license_id: UUID, target_state: string): string;
}
```

**Allowed Transitions**:

```
ACTIVE → SOFT_LOCKED (payment failure)
ACTIVE → ARCHIVED (manual, should not happen)
SOFT_LOCKED → ACTIVE (renewal)
SOFT_LOCKED → ARCHIVED (auto-expiry OR manual)
ARCHIVED → ACTIVE (manual restore)
ARCHIVED → DELETED (manual confirmation)
DELETED → (terminal; no transitions)

INVALID: ACTIVE→ACTIVE, ACTIVE→DELETED, etc.
```

**Idempotency Key Format**: `{license_id}_{target_state}`

**Acceptance Criteria**:

- ✓ isValidTransition() returns correct Boolean for all 6 allowed transitions
- ✓ isValidTransition() returns false for 10+ invalid transitions
- ✓ getIdempotencyKey() generates consistent keys
- ✓ All edge cases tested

**Dependencies**: T002

---

### T007: Create Limit Enforcer (Domain-Core)

- [x] **Layer**: Domain-Core
- [x] **File**: `packages/domain-core/src/license/limit-enforcer.ts`
- [x] **Transactions**: NO (counts only; transaction at API layer)
- [x] **Idempotency**: N/A
- [x] **Version Enforcement**: NO
- [x] **Middleware Required**: NO

**Description**: Implement StudentStaffCounter class. Counts active users, respects soft-delete
flag.

```typescript
class StudentStaffCounter {
  async countStudents(tenant_db: Database, workspace_id: UUID): Promise<number>;
  async countStaff(tenant_db: Database, workspace_id: UUID): Promise<number>;
  canAddStudent(count: number, limit: number | null): Boolean;
  canAddStaff(count: number, limit: number | null): Boolean;
}
```

**Query** (no FOR UPDATE here; that's at API layer):

```sql
SELECT COUNT(*) FROM users
  WHERE workspace_id = $1 AND status = 'ENABLED' AND role = 'STUDENT'
```

**Limit Logic**:

- If limit = NULL → unlimited (always true)
- If count >= limit → false (cannot add)
- If count < limit → true (can add)

**Acceptance Criteria**:

- ✓ Both count methods query tenant_db via connection pool
- ✓ Only count ENABLED users (ignore soft-deleted)
- ✓ Boolean methods handle NULL limits correctly
- ✓ No FOR UPDATE here (API layer responsibility)

**Dependencies**: T002

---

### T008: Create License Middleware

- [x] **Layer**: API (middleware)
- [x] **File**: `apps/api/src/middleware/license-enforcement.ts`
- [x] **Transactions**: NO (read-only check)
- [x] **Idempotency**: N/A
- [x] **Version Enforcement**: YES (calls validator)
- [x] **Middleware Required**: N/A (this IS the middleware)

**Description**: Implement license enforcement middleware. Executes on every workspace-bound request
(3rd in stack).

**Logic**:

1. Extract workspace_id from path or tenant context
2. Query license via resolver (LicenseResolver.getLicense)
3. Validate status:
   - ACTIVE → proceed (200)
   - SOFT_LOCKED with expired soft_lock_until → auto-transition to ARCHIVED; return 403
   - SOFT_LOCKED (not expired) → return 423 (Locked)
   - ARCHIVED → return 403 (Forbidden)
   - DELETED → return 404 (Not Found)
4. Validate schema version (VersionValidator.validateSchemaVersion)
   - If mismatch → return 426 (Upgrade Required)
5. Attach to ctx: license_id, student_limit, staff_limit, status
6. Log: action=middleware_check, status, error_code (if fail)
7. Call next()

**Acceptance Criteria**:

- ✓ Middleware function exported
- ✓ Calls LicenseResolver for license fetch
- ✓ Status validation returns correct HTTP codes (423/403/404)
- ✓ Version validation returns 426
- ✓ Auto-transition SOFT_LOCKED→ARCHIVED on expiry (SELECT FOR UPDATE)
- ✓ Attaches context to request
- ✓ Structured log emitted
- ✓ Unit test for each status scenario

**Dependencies**: T004, T005

---

### T009: Create Error Mapping Utility

- [x] **Layer**: API (shared)
- [x] **File**: `apps/api/src/responses/license-error-handler.ts`
- [x] **Transactions**: N/A
- [x] **Idempotency**: N/A
- [x] **Version Enforcement**: NO
- [x] **Middleware Required**: NO

**Description**: Create error mapping function. Converts license errors to standard response
contract.

**Error Code Mapping** (from clarification Q5):

```
423 → LICENSE_SOFT_LOCKED
403 → LICENSE_ARCHIVED (or LICENSE_DELETED)
404 → LICENSE_DELETED (or LICENSE_NOT_FOUND)
402 → LIMIT_EXCEEDED
426 → SCHEMA_VERSION_MISMATCH (or UPGRADE_REQUIRED)
409 → INVALID_STATE_TRANSITION (or WORKSPACE_ALREADY_EXISTS)
```

**Function**:

```typescript
function toLicenseError(scenario: string, httpStatus: number): StandardErrorResponse {
  return {
    success: false,
    data: null,
    error: { code: errorCodeMap[scenario], message: messageMap[scenario] },
  };
}
```

**Acceptance Criteria**:

- ✓ 10 error codes mapped (from plan.md)
- ✓ All HTTP statuses correct
- ✓ Messages are user-friendly (no technical jargon)
- ✓ Unit tests for each mapping

**Dependencies**: None

---

### T010: Wire License Middleware into Router

- [x] **Layer**: API (routing)
- [x] **File**: `apps/api/src/routes/protected-routes.ts` (or equivalent)
- [x] **Transactions**: N/A
- [x] **Idempotency**: N/A
- [x] **Version Enforcement**: NO
- [x] **Middleware Required**: YES (this task IS wiring it)

**Description**: Register license middleware on router. Middleware stack (order matters):

1. Correlation ID middleware
2. Tenant resolver middleware
3. **License enforcement middleware** ← THIS TASK
4. Schema version enforcement middleware
5. Route handler

**Implementation**:

```typescript
const protectedRouter = new Hono()
  .use(correlationIdMiddleware())
  .use(tenantResolverMiddleware())
  .use(licenseEnforcementMiddleware()) // ← ADD THIS
  .use(schemaVersionMiddleware());
// All routes added to protectedRouter inherit full stack
```

**Acceptance Criteria**:

- ✓ Middleware registered 3rd in stack
- ✓ Applied to ALL workspace-bound routes
- ✓ NOT bypassed by any route (composition enforced)
- ✓ Route test confirms middleware executed

**Dependencies**: T008

---

## Phase 3: User Story 1 (US1) - License Creation

### T011: Create License Service Function

- [x] **[US1]** [P] License service function in `packages/domain-core/src/license/service.ts`
- **Layer**: Domain-Core
- **Transactions**: YES (INSERT license)
- **Idempotency**: UNIQUE(workspace_slug) constraint
- **Version Enforcement**: NO
- **Middleware Required**: NO

**Description**: Implement createLicense() service function. Validates product, workspace, creates
license record.

```typescript
async function createLicense(
  masterDb: Database,
  product_id: UUID,
  workspace_id: UUID,
  workspace_slug: string,
): Promise<{ license_id: UUID; status: "ACTIVE"; created_at: Date }>;
```

**Logic**:

```
BEGIN TRANSACTION (SERIALIZABLE)
  1. Verify product_id exists (SELECT FROM products)
  2. Verify workspace_id unique in licenses
  3. Fetch product limits (student_limit, staff_limit)
  4. Get product version info (expected_schema_version, expected_product_version)
  5. INSERT INTO licenses (...)
  6. Return license_id
COMMIT
```

**Acceptance Criteria**:

- ✓ Service function created with correct signature
- ✓ Creates license with ACTIVE status
- ✓ Soft_lock_until starts NULL
- ✓ Archived_at starts NULL
- ✓ Uses SERIALIZABLE isolation
- ✓ Returns license_id and metadata
- ✓ Unique constraint enforced (duplicate workspace_slug → 409)
- ✓ Transactional test included

**Dependencies**: T001, T002

---

### T012: Create License MMC Endpoint (POST)

- [x] **[US1]** [P] License creation endpoint in `apps/api/src/handlers/mmc/licenses.ts`
- **Layer**: API (handler)
- **Transactions**: YES (calls T011)
- **Idempotency**: YES (UNIQUE constraint on workspace_slug)
- **Version Enforcement**: NO
- **Middleware Required**: YES (requires MMC auth role)

**Description**: Implement POST /api/mmc/licenses handler. Validates input, calls createLicense,
returns license.

**Route**: `POST /api/mmc/licenses`

**Input**:

```json
{
  "product_id": "uuid",
  "workspace_id": "uuid",
  "workspace_slug": "acme.edu"
}
```

**Output** (200):

```json
{
  "success": true,
  "data": {
    "license_id": "uuid",
    "product_id": "uuid",
    "workspace_id": "uuid",
    "workspace_slug": "acme.edu",
    "status": "ACTIVE",
    "student_limit": 300,
    "staff_limit": 50,
    "created_at": "2026-02-17T10:30:45Z"
  },
  "error": null
}
```

**Error Cases**:

- 400: Invalid input (missing fields)
- 409: workspace_slug already exists (UNIQUE constraint violation)
- 404: product_id not found
- 500: DB error

**Acceptance Criteria**:

- ✓ Handler created and wired to route
- ✓ Validates input via @zidney/validation
- ✓ Calls createLicense() from service
- ✓ Returns correct HTTP codes
- ✓ Structured log emitted (action=create, workspace_slug, result=pass/fail)
- ✓ Correlation ID propagated
- ✓ Unit test for each error case

**Dependencies**: T011, T004, T009

---

### T013: Create License MMC Endpoint (GET)

- [x] **[US1]** [P] License retrieval endpoint in `apps/api/src/handlers/mmc/licenses.ts`
- **Layer**: API (handler)
- **Transactions**: NO (read-only)
- **Idempotency**: N/A
- **Version Enforcement**: NO
- **Middleware Required**: YES (MMC auth)

**Description**: Implement GET /api/mmc/licenses/{license_id} handler. Returns full license object.

**Route**: `GET /api/mmc/licenses/{license_id}`

**Output** (200): Full license object (same as POST output)

**Error Cases**:

- 404: license_id not found
- 500: DB error

**Acceptance Criteria**:

- ✓ Handler created and wired
- ✓ Queries license via resolver (LicenseResolver.getLicense)
- ✓ Returns 404 if not found
- ✓ Structured log with correlation_id
- ✓ No sensitive fields exposed

**Dependencies**: T004, T009

---

### T014: Create Idempotency Key Generator

- [x] **[US1]** [P] Idempotency utility in `apps/api/src/utils/idempotency.ts`
- **Layer**: API (utility)
- **Transactions**: N/A
- **Idempotency**: N/A
- **Version Enforcement**: NO
- **Middleware Required**: NO

**Description**: Implement idempotency key generation and Redis cache wrapper.

**Functions**:

```typescript
function generateIdempotencyKey(license_id: UUID, target_state: string, request_id: string): string;
async function checkIdempotency(redis: Redis, key: string): Promise<CachedResponse | null>;
async function storeIdempotency(
  redis: Redis,
  key: string,
  response: any,
  ttl: 86400,
): Promise<void>;
```

**Logic**:

- Key format: `idempotency:{license_id}:{target_state}:{hash(request_id)}`
- TTL: 86400 seconds (24 hours)
- Storage: Redis
- Collision: First submission wins; second gets cached response

**Acceptance Criteria**:

- ✓ Key generator creates consistent keys
- ✓ Redis cache operations work (check, store)
- ✓ TTL set to 24 hours
- ✓ Fallback if Redis unavailable (optional; log warning)
- ✓ Unit tests for all operations

**Dependencies**: None (utility)

---

### T015: Create License Retrieval Endpoint (Workspace Admin)

- [x] **[US1]** [P] Workspace license endpoint in `apps/api/src/handlers/admin/licenses.ts`
- **Layer**: API (handler)
- **Transactions**: NO
- **Idempotency**: N/A
- **Version Enforcement**: NO
- **Middleware Required**: YES (license middleware; workspace admin auth)

**Description**: Implement GET /api/admin/workspace/{workspace_id}/license handler. Returns license
(without sensitive fields).

**Route**: `GET /api/admin/workspace/{workspace_id}/license`

**Output** (200):

```json
{
  "success": true,
  "data": {
    "license_id": "uuid",
    "status": "ACTIVE",
    "student_limit": 300,
    "staff_limit": 50,
    "expected_schema_version": "1.0.0"
  },
  "error": null
}
```

**Authorization**: Workspace admin or MMC admin

**Acceptance Criteria**:

- ✓ Handler wired behind license middleware
- ✓ Returns license via resolver
- ✓ Only read; no sensitive data exposed
- ✓ Structured log with workspace_id, correlation_id
- ✓ Authorization check (admin role)

**Dependencies**: T004, T008

---

## Phase 4: User Story 2 (US2) - Soft-Lock State Transition

### T016: Create State Transition Service

- [x] **[US2]** [P] Transition function in `packages/domain-core/src/license/service.ts`
- **Layer**: Domain-Core
- **Transactions**: YES (UPDATE license)
- **Idempotency**: YES (idempotency key validates transition already done)
- **Version Enforcement**: NO
- **Middleware Required**: NO

**Description**: Implement transitionLicenseState() service function. Validates transition, updates
license.

```typescript
async function transitionLicenseState(
  masterDb: Database,
  license_id: UUID,
  target_state: LicenseStatus,
  reason?: string,
): Promise<License>;
```

**Logic**:

```
BEGIN TRANSACTION (SERIALIZABLE)
  1. SELECT * FROM licenses WHERE license_id = $1 FOR UPDATE
  2. Validate transition (StateTransition.isValidTransition)
  3. If ACTIVE → SOFT_LOCKED:
       UPDATE licenses SET status='SOFT_LOCKED', soft_lock_until=NOW()+90 days, updated_at=NOW()
  4. If SOFT_LOCKED → ACTIVE:
       UPDATE licenses SET status='ACTIVE', soft_lock_until=NULL, updated_at=NOW()
  5. If SOFT_LOCKED → ARCHIVED:
       UPDATE licenses SET status='ARCHIVED', archived_at=NOW(), updated_at=NOW()
       ENQUEUE worker_job('ARCHIVE_SNAPSHOT', license_id)
  6. Return updated license
COMMIT
```

**Acceptance Criteria**:

- ✓ Service function with correct signature
- ✓ Uses SELECT FOR UPDATE to prevent race
- ✓ Validates transition before UPDATE
- ✓ Sets soft_lock_until for SOFT_LOCKED (90 days)
- ✓ Sets soft_lock_until=NULL for ACTIVE renewal
- ✓ Enqueues snapshot job for ARCHIVED transition
- ✓ Returns updated license object
- ✓ Transactional test (rollback on invalid transition)

**Dependencies**: T001, T002, T006

---

### T017: Create State Transition MMC Endpoint

- [x] **[US2]** [P] Transition endpoint in `apps/api/src/handlers/mmc/licenses.ts`
- **Layer**: API (handler)
- **Transactions**: YES (calls T016)
- **Idempotency**: YES (Redis idempotency key)
- **Version Enforcement**: NO
- **Middleware Required**: YES (MMC auth)

**Description**: Implement PATCH /api/mmc/licenses/{id}/state handler. Transitions license state.

**Route**: `PATCH /api/mmc/licenses/{id}/state`

**Input**:

```json
{
  "target_state": "SOFT_LOCKED",
  "reason": "payment_failed"
}
```

**Header** (for idempotency):

```
Idempotency-Key: uuid-here
```

**Output** (200): Updated license object

**Error Cases**:

- 400: Invalid target_state
- 409: Invalid transition (ACTIVE→ACTIVE)
- 409: Idempotency key mismatch (if request body differs from cached request)
- 404: license_id not found
- 500: DB error

**Idempotency Logic**:

1. Extract Idempotency-Key header
2. Generate idempotency key (license_id + target_state + request_id_hash)
3. Check Redis cache (T014)
4. If cached → return cached response (200)
5. If not cached → execute transition, store result in Redis

**Acceptance Criteria**:

- ✓ Handler wired to route
- ✓ Validates input (target_state in allowed set)
- ✓ Calls transitionLicenseState() from service
- ✓ Idempotency-Key header parsed and checked
- ✓ Redis cache checked before execution
- ✓ Cache stored with 24hr TTL
- ✓ Returns correct error codes
- ✓ Structured log: action=state_transition, from, to, reason
- ✓ Idempotency unit test (double-submit)

**Dependencies**: T016, T009, T014

---

### T018: Create Soft-Lock Expiry Auto-Transition

- [x] **[US2]** [P] Expiry logic in license middleware
      `apps/api/src/middleware/license-enforcement.ts`
- **Layer**: API (middleware)
- **Transactions**: YES (UPDATE if transitioning)
- **Idempotency**: YES (SELECT FOR UPDATE prevents dups)
- **Version Enforcement**: NO
- **Middleware Required**: N/A (this IS middleware)

**Description**: Enhance license middleware to auto-transition SOFT_LOCKED→ARCHIVED on expiry.

**Logic** (in middleware after status validation):

```
IF license.status = 'SOFT_LOCKED' AND NOW() > license.soft_lock_until:
  BEGIN TRANSACTION (SERIALIZABLE)
    SELECT * FROM licenses WHERE license_id = $1 FOR UPDATE
    IF NOW() > soft_lock_until AND status='SOFT_LOCKED':
      UPDATE licenses SET status='ARCHIVED', archived_at=NOW(), updated_at=NOW()
      WHERE license_id = $1
      ENQUEUE worker_job('ARCHIVE_SNAPSHOT', license_id)
    COMMIT
  RETURN 403 (Forbidden) -- or 200 if internal
```

**Race Condition Prevention**: SELECT FOR UPDATE ensures first request updates; second sees ARCHIVED

**Acceptance Criteria**:

- ✓ Expiry check added to middleware
- ✓ SELECT FOR UPDATE used (prevents race)
- ✓ Auto-transition updates license.status
- ✓ Snapshot job enqueued
- ✓ Both concurrent requests see ARCHIVED (safe)
- ✓ Structured log: action=soft_lock_expiry, old_status, new_status
- ✓ Concurrency unit test (2 simultaneous requests)

**Dependencies**: T008, T016

---

## Phase 5: User Story 3 (US3) - Student Limit Enforcement

### T019: Create Limit Enforcement Transaction Wrapper

- [x] **[US3]** [P] Transaction wrapper in `apps/api/src/transactions/limit-check-transaction.ts`
- **Layer**: API (transaction)
- **Transactions**: YES (COUNT + INSERT)
- **Idempotency**: NO (endpoint not idempotent; caller handles dedup)
- **Version Enforcement**: NO
- **Middleware Required**: NO

**Description**: Implement transactional limit check wrapper. Atomic: SELECT FOR UPDATE COUNT +
INSERT.

```typescript
async function enforceStudentLimitTransaction(
  tenantDb: Database,
  workspace_id: UUID,
  studentLimit: number | null,
  newStudentData: any,
): Promise<{ success: true; user_id: UUID } | { success: false; error_code: "LIMIT_EXCEEDED" }>;
```

**Logic**:

```
BEGIN TRANSACTION (SERIALIZABLE)
  1. SELECT COUNT(*) FROM users
       WHERE status='ENABLED' AND role='STUDENT'
       FOR UPDATE
  2. If limit != NULL AND count >= limit:
       ROLLBACK
       RETURN { success: false, error_code: 'LIMIT_EXCEEDED' }
  3. INSERT INTO users (...)
  4. COMMIT
  5. RETURN { success: true, user_id }
COMMIT
```

**Concurrency Guard: SELECT FOR UPDATE**

- First request: Acquires lock; counts; blocks second request if limit reached
- Second request: Waits for lock; recounts; sees count+1; fails with LIMIT_EXCEEDED

**Acceptance Criteria**:

- ✓ Transaction wrapper created with correct signature
- ✓ Uses SELECT FOR UPDATE (not just SELECT)
- ✓ SERIALIZABLE isolation level
- ✓ Atomic: count and insert both succeed or both fail
- ✓ Returns correct success/failure tuple
- ✓ Timeout handling (30 sec max; return 503)
- ✓ Concurrency unit test (2 simultaneous requests, limit=1)

**Dependencies**: T007

---

### T020: Create User Creation Endpoint with Limit Check

- [x] **[US3]** [P] User creation endpoint in `apps/api/src/handlers/backoffice/users.ts`
- **Layer**: API (handler)
- **Transactions**: YES (calls T019)
- **Idempotency**: NO
- **Version Enforcement**: NO
- **Middleware Required**: YES (license middleware; backoffice auth)

**Description**: Implement POST /api/backoffice/users endpoint. Creates user with transactional
limit check.

**Route**: `POST /api/backoffice/users`

**Input**:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role": "STUDENT"
}
```

**Output** (200): Created user object

**Error Cases**:

- 402: Student limit exceeded (LIMIT_EXCEEDED error_code)
- 402: Staff limit exceeded
- 400: Invalid role
- 400: Missing required fields
- 409: Email already exists
- 500: DB error

**Limit Check Logic**:

1. Fetch license from tenant context (attached by middleware)
2. If role='STUDENT': Call enforceStudentLimitTransaction() with license.student_limit
3. If role='STAFF': Call enforceStaffLimitTransaction() with license.staff_limit
4. If limit check fails → return 402 (Payment Required)
5. User created successfully → return 200

**Acceptance Criteria**:

- ✓ Handler wired behind license middleware
- ✓ Validates role (STUDENT, STAFF, ADMIN)
- ✓ Calls limit check transaction
- ✓ Returns 402 if limit exceeded
- ✓ Structured log: action=user_creation, role, limit_check_result
- ✓ Concurrency test (2 users created; one rejected at limit)

**Dependencies**: T019, T008, T009

---

### T021: Create Soft-Delete User Function

- [x] **[US3]** [P] Soft-delete function in `apps/api/src/handlers/backoffice/users.ts`
- **Layer**: API (handler)
- **Transactions**: YES (UPDATE user)
- **Idempotency**: YES (unique constraint on user_id)
- **Version Enforcement**: NO
- **Middleware Required**: YES (license middleware)

**Description**: Implement PATCH /api/backoffice/users/{user_id}/soft-delete. Marks user as
soft-deleted (status='DISABLED').

**Route**: `PATCH /api/backoffice/users/{user_id}/soft-delete`

**Logic**:

```
BEGIN TRANSACTION (SERIALIZABLE)
  UPDATE users SET status='DISABLED', updated_at=NOW()
  WHERE user_id=$1 AND workspace_id=$2
COMMIT
```

**Behavior**: Soft-deleted users not counted in limit checks (confirmed in T020)

**Acceptance Criteria**:

- ✓ User marked as DISABLED (soft-delete)
- ✓ Limit checks exclude DISABLED users
- ✓ User still exists in DB (not deleted)
- ✓ Structured log: action=soft_delete_user, user_id

**Dependencies**: T019

---

## Phase 6: User Story 4 (US4) - Archive Snapshot

### T022: Create Archive Snapshot Worker Job

- [x] **[US4]** [P] Worker job in `apps/worker/src/jobs/archive-snapshot.ts`
- **Layer**: Worker
- **Transactions**: YES (INSERT + UPDATE license)
- **Idempotency**: YES (dedup within 1 hour)
- **Version Enforcement**: NO
- **Middleware Required**: NO

**Description**: Implement ARCHIVE_SNAPSHOT worker job. Executes pg_dump, uploads snapshot, updates
license.

**Job Payload**:

```json
{
  "type": "ARCHIVE_SNAPSHOT",
  "license_id": "uuid",
  "workspace_id": "uuid",
  "snapshot_timestamp": "2026-02-17T10:30:45Z"
}
```

**Logic**:

```
1. Verify license.status = ARCHIVED (if not, retry)
2. Check idempotency (recent snapshot within 1 hour?)
   SELECT snapshot_id FROM archive_snapshots
   WHERE license_id=$1 AND created_at > NOW()-INTERVAL '1 hour'
3. If exists → skip dump; return success
4. If not exists:
   a. Query tenant DB details from tenants_registry
   b. Execute: pg_dump --format=plain tenant_db > snapshot.sql
   c. Upload to S3: s3://archive-snapshots/{license_id}/{timestamp}.sql
   d. BEGIN TRANSACTION
        INSERT INTO archive_snapshots (license_id, snapshot_location, snapshot_timestamp)
        VALUES ($1, $s3_path, $timestamp)
        UPDATE licenses SET snapshot_id=$snapshot_id WHERE license_id=$1
      COMMIT
5. Log: action=archive_snapshot, license_id, snapshot_location, duration_ms
```

**Retry Policy**:

- Retry count: 3
- Backoff: 1s, 5s, 30s
- On final failure → DLQ (ops alerted)

**DLQ Handling**:

- Record job in dead-letter queue
- Alert ops team (Slack/PagerDuty)
- Manual intervention required

**Acceptance Criteria**:

- ✓ Worker job function created
- ✓ Idempotency dedup implemented (query existing snapshots)
- ✓ pg_dump executed with correct flags
- ✓ Snapshot uploaded to S3 with correct path
- ✓ License updated atomically (INSERT + UPDATE in transaction)
- ✓ Retry logic (3x exponential backoff)
- ✓ DLQ on final failure
- ✓ Structured log: action, license_id, snapshot_location, duration_ms
- ✓ Worker unit test (mock pg_dump, S3)

**Dependencies**: T001

---

### T023: Create Archive Snapshot Enqueue Logic

- [x] **[US4]** [P] Enqueue logic in `apps/api/src/handlers/mmc/licenses.ts`
- **Layer**: API (handler)
- **Transactions**: YES (transactional enqueue)
- **Idempotency**: YES (enqueued within state transition)
- **Version Enforcement**: NO
- **Middleware Required**: NO

**Description**: Add snapshot job enqueue to license state transition handler
(SOFT_LOCKED→ARCHIVED).

**Logic** (in transitionLicenseState service):

```typescript
if (target_state === "ARCHIVED") {
  // Within same transaction as UPDATE:
  await enqueueJob("zidney-archive-jobs", {
    type: "ARCHIVE_SNAPSHOT",
    license_id: license_id,
    workspace_id: license.workspace_id,
    snapshot_timestamp: new Date().toISOString(),
  });
}
```

**Enqueue Safety**:

- If COMMIT succeeds → job enqueued (safe)
- If COMMIT fails → job not enqueued; transaction rolled back (safe)

**Acceptance Criteria**:

- ✓ Enqueue logic integrated into transition handler
- ✓ Job enqueued ONLY if UPDATE succeeds
- ✓ Job payload includes all required fields
- ✓ Queue name: 'zidney-archive-jobs'
- ✓ Structured log: action=archive_job_enqueued, license_id

**Dependencies**: T017

---

### T024: Create Worker Queue Configuration

- [x] **[US4]** [P] Queue setup in `apps/worker/src/config/queues.ts`
- **Layer**: Worker (configuration)
- **Transactions**: N/A
- **Idempotency**: N/A
- **Version Enforcement**: NO
- **Middleware Required**: NO

**Description**: Configure 'zidney-archive-jobs' queue. Set concurrency, retry policy, DLQ.

**Configuration**:

```typescript
{
  name: 'zidney-archive-jobs',
  concurrency: 5,
  retryPolicy: {
    maxRetries: 3,
    backoff: [1000, 5000, 30000]  // ms
  },
  dlq: 'zidney-archive-jobs-dlq',
  timeout: 300000  // 5 minutes
}
```

**Acceptance Criteria**:

- ✓ Queue created with correct name
- ✓ Concurrency: 5 (parallel snapshots)
- ✓ Retry: 3x with exponential backoff
- ✓ DLQ configured (jobs that fail 3x go here)
- ✓ Timeout: 5 minutes (enough for pg_dump)
- ✓ Queue config file: apps/worker/src/config/queues.ts

**Dependencies**: None

---

### T025: Create Worker Job Handler Registration

- [x] **[US4]** [P] Handler registration in `apps/worker/src/index.ts`
- **Layer**: Worker (setup)
- **Transactions**: N/A
- **Idempotency**: N/A
- **Version Enforcement**: NO
- **Middleware Required**: NO

**Description**: Register ARCHIVE_SNAPSHOT handler with worker processor.

**Logic**:

```typescript
worker.on("zidney-archive-jobs", async (job) => {
  if (job.payload.type === "ARCHIVE_SNAPSHOT") {
    await archiveSnapshotJob(job);
  }
});
```

**Acceptance Criteria**:

- ✓ Handler registered to correct queue
- ✓ Job type routed to correct function (T022)
- ✓ Worker can start and process jobs

**Dependencies**: T022, T024

---

## Phase 7: User Story 5 (US5) - Version Enforcement

### T026: Add Version Checking to Middleware

- [x] **[US5]** [P] Version checks in `apps/api/src/middleware/license-enforcement.ts`
- **Layer**: API (middleware)
- **Transactions**: NO
- **Idempotency**: N/A
- **Version Enforcement**: YES
- **Middleware Required**: N/A (this IS middleware)

**Description**: Enhance license middleware to validate schema + product versions.

**Logic** (after license status check):

```
1. Get tenant.current_schema_version from tenants table
2. Call VersionValidator.validateSchemaVersion(tenant_version, license.expected_schema_version)
3. If false → return 426 (Upgrade Required)
4. Call VersionValidator.validateProductVersion(license.expected_product_version, runtime_version)
5. If false → return 426 (Upgrade Required)
6. If both pass → proceed to next middleware
```

**Error Response** (426):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SCHEMA_VERSION_MISMATCH" or "UPGRADE_REQUIRED",
    "message": "Workspace requires schema/product upgrade."
  }
}
```

**Acceptance Criteria**:

- ✓ Version validation calls VersionValidator (T005)
- ✓ Returns 426 on schema version mismatch
- ✓ Returns 426 on product version incompatibility
- ✓ Structured log: action=version_check, expected, actual, result
- ✓ Unit test for matching versions (pass)
- ✓ Unit test for schema mismatch (fail with 426)
- ✓ Unit test for product mismatch (fail with 426)
- ✓ Unit test for forward-compatible versions (pass)

**Dependencies**: T005, T008

---

### T027: Create Version Mismatch Error Cases

- [x] **[US5]** [P] Error mapping in `apps/api/src/responses/license-error-handler.ts`
- **Layer**: API (error handling)
- **Transactions**: N/A
- **Idempotency**: N/A
- **Version Enforcement**: NO
- **Middleware Required**: NO

**Description**: Add 426 error mappings for schema + product version mismatches.

**Error Codes**:

- SCHEMA_VERSION_MISMATCH: "Workspace requires schema upgrade. Contact administrator."
- UPGRADE_REQUIRED: "Workspace requires product upgrade."

**HTTP Mapping**: Both → 426

**Acceptance Criteria**:

- ✓ Both error codes added to mapping
- ✓ Messages are clear (tell users what to do)
- ✓ HTTP status is 426
- ✓ Unit test for each mapping

**Dependencies**: T009

---

## Phase 8: User Story 6 (US6) - Manual License Deletion

### T028: Create License Deletion Service

- [x] **[US6]** [P] Deletion function in `packages/domain-core/src/license/service.ts`
- **Layer**: Domain-Core
- **Transactions**: YES (UPDATE + DROP tenant DB)
- **Idempotency**: NO (deletion is destructive; requires confirmation)
- **Version Enforcement**: NO
- **Middleware Required**: NO

**Description**: Implement deleteLicense() service function. Marks license as DELETED; optionally
drops tenant DB.

```typescript
async function deleteLicense(
  masterDb: Database,
  license_id: UUID,
  confirm_deletion: boolean,
): Promise<{ success: true; deleted_at: Date }>;
```

**Logic**:

```
PRE-CHECKS:
  1. Verify license.status = ARCHIVED
  2. Verify archive_snapshots exist (snapshot_id set)
  3. Require confirm_deletion = true (explicit confirmation)

BEGIN TRANSACTION (SERIALIZABLE)
  1. UPDATE licenses SET status='DELETED', deleted_at=NOW() WHERE license_id=$1
  2. If DROP_DB flag set:
     - Get tenant DB name from tenants_registry
     - DROP DATABASE tenant_db (DANGEROUS; irreversible)
  3. Log: action=license_deleted, license_id, deleted_at, tenant_db_dropped=true|false
COMMIT
```

**Risk Mitigation**:

- Requires ARCHIVED state (snapshot taken)
- Requires explicit confirm_deletion flag
- Requires snapshot_id to be set
- Logs all deletion details (audit trail)
- Tenant DB drop is optional (can do separately)

**Acceptance Criteria**:

- ✓ Service function with correct signature
- ✓ Pre-checks: archived, snapshot exists, confirmation required
- ✓ Uses SERIALIZABLE isolation
- ✓ Updates license status to DELETED
- ✓ Sets deleted_at = NOW()
- ✓ Optional tenant DB drop (separate from license update)
- ✓ Structured audit log: action=license_deleted, all details
- ✓ Destructive operation unit test (with mock DB)

**Dependencies**: T001

---

### T029: Create License Deletion MMC Endpoint

- [x] **[US6]** [P] Deletion endpoint in `apps/api/src/handlers/mmc/licenses.ts`
- **Layer**: API (handler)
- **Transactions**: YES (calls T028)
- **Idempotency**: NO
- **Version Enforcement**: NO
- **Middleware Required**: YES (MMC auth; super-admin only)

**Description**: Implement DELETE /api/mmc/licenses/{id} handler. Deletes license with confirmation.

**Route**: `DELETE /api/mmc/licenses/{id}`

**Input**:

```json
{
  "confirm_deletion": true,
  "reason": "customer_request"
}
```

**Output** (200):

```json
{
  "success": true,
  "data": {
    "license_id": "uuid",
    "status": "DELETED",
    "deleted_at": "2026-02-17T10:30:45Z"
  },
  "error": null
}
```

**Error Cases**:

- 400: confirm_deletion not true
- 409: License not ARCHIVED (cannot delete active license)
- 409: No snapshot found (cannot safely delete without backup)
- 404: license_id not found
- 500: DB error

**Authorization**: Super-admin MMC role only

**Acceptance Criteria**:

- ✓ Handler wired to route
- ✓ Validates confirm_deletion = true
- ✓ Calls deleteLicense() from service
- ✓ Returns 409 if license not ARCHIVED or no snapshot
- ✓ Structured log: action=license_deleted, license_id, reason, confirmed
- ✓ Authorization check (super-admin)
- ✓ Destructive operation; confirm before allowing

**Dependencies**: T028, T009

---

## Phase 9: Observability & Logging

### T030: Create Structured Logging Middleware

- [x] [P] Logging middleware in `apps/api/src/middleware/license-logging.ts`
- **Layer**: API (middleware)
- **Transactions**: NO
- **Idempotency**: N/A
- **Version Enforcement**: NO
- **Middleware Required**: NO

**Description**: Implement license logging middleware. Emits structured JSON for all license
operations.

**Log Fields** (from plan.md):

- timestamp (ISO 8601)
- level (info, warn, error)
- service (license-engine)
- correlation_id (from header)
- workspace_slug (from context)
- workspace_id (from context)
- user_id (if available)
- action (create, state_transition, limit_enforce, middleware_check, etc.)
- status (success, failure)
- result (pass, fail)
- error_code (if error)
- details (operation-specific)

**Example Log**:

```json
{
  "timestamp": "2026-02-17T10:30:45.123Z",
  "level": "info",
  "service": "license-engine",
  "correlation_id": "uuid-here",
  "workspace_slug": "acme.edu",
  "workspace_id": "workspace-uuid",
  "user_id": "user-uuid",
  "action": "state_transition",
  "status": "success",
  "result": "pass",
  "details": {
    "from_status": "ACTIVE",
    "to_status": "SOFT_LOCKED",
    "soft_lock_until": "2026-05-19T10:30:45Z"
  }
}
```

**Acceptance Criteria**:

- ✓ Middleware created
- ✓ All 12 log fields included
- ✓ Uses Pino structured logger
- ✓ No console.log (production logs only)
- ✓ Correlation ID propagated from header
- ✓ Workspace info attached from context
- ✓ Error code included on failure

**Dependencies**: None

---

### T031: Create License Metrics Collector

- [x] [P] Metrics in `apps/api/src/observability/license-metrics.ts`
- **Layer**: API (observability)
- **Transactions**: N/A
- **Idempotency**: N/A
- **Version Enforcement**: NO
- **Middleware Required**: NO

**Description**: Implement metrics collection for license operations.

**Metrics**:

- `license_middleware_duration_ms` (histogram): How long license validation takes
- `license_state_transition_duration_ms` (histogram): Transition operation latency
- `license_limit_enforcement_duration_ms` (histogram): Limit check latency
- `license_archive_snapshot_duration_ms` (histogram): Worker snapshot duration
- `license_version_check_duration_ms` (histogram): Version validation latency

**Instrumentation Points**:

1. Middleware (T008): Measure validation time
2. State transition handler (T017): Measure operation time
3. User creation handler (T020): Measure limit check time
4. Worker job (T022): Measure snapshot time

**Acceptance Criteria**:

- ✓ Metrics defined (histograms for timing)
- ✓ Collectors created for each metric
- ✓ Instrumentation points integrated
- ✓ Exported to metrics system (Prometheus or similar)

**Dependencies**: None (but integrated into other tasks)

---

### T032: Create License Error Code Registry

- [x] [P] Error codes in `apps/api/src/responses/license-error-codes.ts`
- **Layer**: API (error handling)
- **Transactions**: N/A
- **Idempotency**: N/A
- **Version Enforcement**: NO
- **Middleware Required**: NO

**Description**: Create centralized error code registry. All license errors mapped consistently.

**Error Codes** (from clarification Q5):

```typescript
const LICENSE_ERRORS = {
  LICENSE_SOFT_LOCKED: { code: 'LICENSE_SOFT_LOCKED', status: 423, message: 'Workspace temporarily locked...' },
  LICENSE_ARCHIVED: { code: 'LICENSE_ARCHIVED', status: 403, message: 'Workspace archived...' },
  LICENSE_DELETED: { code: 'LICENSE_DELETED', status: 404, message: 'Workspace no longer exists...' },
  LIMIT_EXCEEDED: { code: 'LIMIT_EXCEEDED', status: 402, message: 'Limit reached...' },
  SCHEMA_VERSION_MISMATCH: { code: 'SCHEMA_VERSION_MISMATCH', status: 426, message: 'Schema upgrade required...' },
  UPGRADE_REQUIRED: { code: 'UPGRADE_REQUIRED', status: 426, message: 'Product upgrade required...' },
  INVALID_STATE_TRANSITION: { code: 'INVALID_STATE_TRANSITION', status: 409, message: 'Cannot transition...' },
  ...
}
```

**Acceptance Criteria**:

- ✓ 10 error codes defined
- ✓ Each has: code, HTTP status, message
- ✓ Messages are user-friendly
- ✓ No technical jargon
- ✓ Exported for use in error handlers

**Dependencies**: None

---

## Phase 10: Testing

### T033-T050: Comprehensive Test Suite

**Test Files**:

#### T033: License Domain Unit Tests

- [ ] File: `packages/domain-core/tests/license/resolver.test.ts`
- Test: License resolver (queries, caching)
- Tests: 5 (cache hit, cache miss, query error, 5min TTL, fallback)

#### T034: Version Validator Unit Tests

- [ ] File: `packages/domain-core/tests/license/validator.test.ts`
- Test: Version validation (schema + product)
- Tests: 8 (match, forward-compatible, backward, mismatch, semver parsing)

#### T035: State Machine Unit Tests

- [ ] File: `packages/domain-core/tests/license/state-machine.test.ts`
- Test: State transitions validation
- Tests: 16 (6 valid, 10 invalid transitions)

#### T036: Limit Enforcer Unit Tests

- [ ] File: `packages/domain-core/tests/license/limit-enforcer.test.ts`
- Test: Student/staff counting, soft-delete exclusion
- Tests: 6 (count students, count staff, NULL limit, soft-deleted exclusion)

#### T037: License Middleware Unit Tests

- [ ] File: `apps/api/tests/unit/license-engine/middleware.test.ts`
- Test: Status validation, version checks, auto-expiry
- Tests: 12 (ACTIVE/SOFT_LOCKED/ARCHIVED/DELETED, version mismatch, expiry)

#### T038: State Transition Service Unit Tests

- [ ] File: `apps/api/tests/unit/license-engine/state-transitions.test.ts`
- Test: Transactional updates, idempotency
- Tests: 8 (valid transitions, invalid transitions, SELECT FOR UPDATE, rollback)

#### T039: Limit Enforcement Transaction Unit Tests

- [ ] File: `apps/api/tests/unit/license-engine/limit-enforcement.test.ts`
- Test: COUNT + INSERT atomicity, SELECT FOR UPDATE
- Tests: 6 (at limit, over limit, NULL limit, lock behavior)

#### T040: API Handler Unit Tests

- [ ] File: `apps/api/tests/unit/license-engine/handlers.test.ts`
- Test: All 4 endpoints (create, get, transition, delete)
- Tests: 16 (successful, error cases, authorization)

#### T041: Worker Job Unit Tests

- [ ] File: `apps/worker/tests/unit/jobs/archive-snapshot.test.ts`
- Test: Snapshot job (idempotency, retry, DLQ)
- Tests: 8 (successful, failure, dedup, retry count)

#### T042: Integration Test - End-to-End Lifecycle

- [ ] File: `apps/api/tests/integration/license-lifecycle.test.ts`
- Test: Full lifecycle (create→login→user creation)
- Scenarios: 3 (success path, limit exceeded, version mismatch)

#### T043: Integration Test - Soft-Lock Expiry

- [ ] File: `apps/api/tests/integration/soft-lock-expiry.test.ts`
- Test: SOFT_LOCKED→ARCHIVED auto-transition
- Scenarios: 3 (not expired, expired, concurrent expiry checks)

#### T044: Integration Test - Limit Enforcement Concurrency

- [ ] File: `apps/api/tests/integration/limit-enforcement-concurrency.test.ts`
- Test: 2 simultaneous requests against limit
- Scenarios: 3 (limit=1, limit=10, lock timeout)

#### T045: Integration Test - Snapshot Workflow

- [ ] File: `apps/api/tests/integration/archive-snapshot.test.ts`
- Test: ARCHIVED→snapshot enqueue→job execution
- Scenarios: 3 (success, dedup, job failure)

#### T046: Idempotency Test - State Transitions

- [ ] File: `apps/api/tests/idempotency/state-transitions.test.ts`
- Test: Double-submit with idempotency key
- Scenarios: 3 (first submit succeeds, second returns cached, TTL expiry)

#### T047: Idempotency Test - Snapshot Dedup

- [ ] File: `apps/worker/tests/idempotency/snapshot-dedup.test.ts`
- Test: Double-enqueue snapshot job
- Scenarios: 2 (within 1 hour dedup, after 1 hour new dump)

#### T048: Transaction Rollback Test

- [ ] File: `apps/api/tests/transactions/rollback.test.ts`
- Test: Rollback on constraint violation
- Scenarios: 3 (limit exceeded, invalid transition, duplicate email)

#### T049: Version Enforcement Test

- [ ] File: `apps/api/tests/version-enforcement/schema-version.test.ts`
- Test: Schema version validation
- Scenarios: 4 (match, forward-compatible, backward incompatible, exact mismatch)

#### T050: Cross-Tenant Isolation Test

- [ ] File: `apps/api/tests/isolation/cross-tenant.test.ts`
- Test: License A doesn't affect License B
- Scenarios: 2 (separate workspaces, limit in one doesn't affect other)

**Summary**: 50 tests total (minimum)

- 21 unit tests (domain-core + middleware + handlers)
- 5 integration tests (lifecycle paths)
- 3 idempotency tests
- 1 rollback test
- 1 version enforcement test
- 1 isolation test Plus edge cases and error scenarios

**Acceptance Criteria (all tests)**:

- ✓ All tests pass
- ✓ Coverage > 80% for license-engine code
- ✓ No skipped tests
- ✓ Concurrency tests use real PostgreSQL transaction isolation
- ✓ Worker tests mock S3/pg_dump

---

## Phase 11: Final Verification & Documentation

### T051: Constitutional Compliance Checklist

- [x] [P] Final verification document
- **Layer**: Documentation
- **Purpose**: Verify all architectural guarantees preserved

**Checklist**:

- [x] No cross-tenant data access
- [x] No middleware bypass
- [x] No direct DB instantiation
- [x] All writes transactional
- [x] Idempotency enforced (state transitions, snapshots)
- [x] Version compatibility validated (schema + product)
- [x] Server-authoritative time only
- [x] ADR alignment (ADR-0001, 0006, 0008)
- [x] All 5 clarifications integrated (Q1-Q5)

---

## Task Summary

**Total Tasks**: 51

| Category                 | Count | Range     |
| ------------------------ | ----- | --------- |
| Infrastructure           | 3     | T001-T003 |
| Foundational             | 7     | T004-T010 |
| US1: License Creation    | 5     | T011-T015 |
| US2: Soft-Lock           | 3     | T016-T018 |
| US3: Limit Enforcement   | 3     | T019-T021 |
| US4: Archive Snapshot    | 4     | T022-T025 |
| US5: Version Enforcement | 2     | T026-T027 |
| US6: Manual Deletion     | 2     | T028-T029 |
| Observability            | 3     | T030-T032 |
| Testing                  | 18    | T033-T050 |
| Verification             | 1     | T051      |

**MVP Scope** (minimal viable product):

- Tasks: T001-T015, T033-T044
- Covers: License creation, retrieval, user creation with limit enforcement
- Timeline: ~2 weeks for 1-2 engineers

**Full Scope** (complete stage):

- All 51 tasks
- Covers: Full lifecycle, snapshots, version enforcement, manual deletion, comprehensive testing
- Timeline: ~4-5 weeks for 2-3 engineers

**Parallel Execution Opportunities**:

- T004-T010 (foundational): Run in parallel (independent modules)
- T011-T015 (US1): Run in parallel after T004-T010
- T019-T027 (US3, US5): Run in parallel after foundational
- T033-T050 (tests): Run in parallel (independent test files)

---

## Final Compliance Statement

**Constitutional Alignment**: ✅ VERIFIED

- All 6 architectural guarantees preserved
- All 3 ADRs honored
- All 5 clarifications integrated

**Task Quality**: ✅ VERIFIED

- All 51 tasks atomic (single layer, specific file)
- All transactions declared
- All idempotency requirements specified
- All middleware dependencies stated

**Execution Readiness**: ✅ VERIFIED

- Each task has acceptance criteria
- Dependencies documented
- Parallel execution paths identified
- MVP scope clearly defined

**Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.**

---

**Tasks Status**: ✅ **READY FOR IMPLEMENTATION** via `/speckit.implement`
