# Validation Specification: STAGE_TEST_01_PLATFORM_FOUNDATION

**Feature Branch**: `test-001-platform-foundation`  
**Created**: 2026-02-26  
**Status**: Draft  
**Type**: Validation Test Stage (NOT a feature stage)  
**Purpose**: Verify architectural guarantees of Phase 01 PLATFORM_FOUNDATION

---

## Executive Summary

This validation stage establishes that the foundational Phase 01 platform architecture meets
non-negotiable integrity requirements before promotion to PRODUCTION READY.

The stage validates:

- **Tenant Isolation**: No cross-tenant data leakage possible
- **Provisioning**: Deterministic, transactional, race-condition-safe
- **License Engine**: Correctly enforces access control and limits
- **Migration Discipline**: Forward-only, immutable, versioned
- **Rate Limiting**: Enforces thresholds and returns proper headers
- **Observability**: Structured logging with correlation tracking
- **Attempt Engine**: Immutable snapshots, worker-only grading
- **Performance**: Middleware overhead acceptable for production

**Passing this stage is mandatory before Phase 01 moves to VALIDATED status.**

---

## Validation Test Scenarios

### Area 1: Tenant Isolation Validation

#### Test 1.1: Cross-Tenant Data Access Rejection (CRITICAL)

**Objective**: Verify that a user from Tenant A cannot access Tenant B's data, regardless of HTTP
path manipulation.

**Validation Steps**:

1. Create two workspaces: Workspace A and Workspace B, each with its own tenant database
2. Authenticate user A (from Workspace A)
3. Obtain valid JWT token for user A
4. Attempt to access a Workspace B resource using user A's token:
   - Example: GET `/api/workspaces/workspace-b/students` while authenticated as Workspace A user
5. Verify response code: **403 Forbidden** or **404 Not Found** (resolver rejection)
6. Verify response does NOT contain Workspace B data
7. Verify no data mutation occurred in either database

**Pass Criteria**:

- ✅ Response code is 403 or 404 (not 200)
- ✅ No Workspace B data returned in response body
- ✅ Request log shows workspace context as Workspace A (never B)
- ✅ Audit log records attempted unauthorized access attempt

**Fail Criteria**:

- ❌ Response code is 200 with Workspace B data
- ❌ Response contains partially visible Workspace B data
- ❌ No audit trail of access attempt
- ❌ Resolver context shows Workspace B for Workspace A token

---

#### Test 1.2: Master Database Boundary Enforcement (CRITICAL)

**Objective**: Verify that tenant runtime code never directly accesses master_db. All tenant
operations route through resolver context.

**Validation Steps**:

1. Scan API codebase for direct master_db imports in tenant-bound routes
2. For each tenant-context route handler:
   - Verify tenant resolver middleware executes first
   - Verify resolver provides tenant DB connection context
   - Verify route uses tenant context (not master context)
3. Trace a sample request through middleware stack:
   - Middleware 1: Correlation ID injection
   - Middleware 2: Tenant resolver (extracts tenantId from request)
   - Middleware 3: License validation (uses tenant context)
   - Middleware 4: Schema version check (uses tenant context)
   - Handler: All DB operations use tenant context provided by resolver
4. Verify master_db is only accessed for:
   - License lookups (acceptable, read-only on master)
   - Workspace metadata (acceptable, read-only on master)
   - Never for student/attempt/submission data

**Pass Criteria**:

- ✅ No tenant-bound route bypasses resolver middleware
- ✅ All DB connections within route handler use tenant context
- ✅ Master DB only accessed for license/metadata queries
- ✅ Request middleware order matches specification
- ✅ Resolver context propagates through entire request lifecycle

**Fail Criteria**:

- ❌ Any tenant route directly instantiates master connection
- ❌ Middleware order changes (license check before resolver)
- ❌ Resolver returns indefinite or null context
- ❌ Master DB accessed for student/attempt data

---

#### Test 1.3: Resolver Middleware Enforcement (CRITICAL)

**Objective**: Verify that application refuses to start or fails safely if resolver middleware is
removed/disabled.

**Validation Steps**:

1. Create a test configuration with resolver middleware disabled
2. Attempt to start the API service with this configuration
3. Expected behaviors:
   - Service startup **fails** with clear error message, OR
   - Service starts but first request to any workspace route returns 500 with message: "Tenant
     context unavailable", OR
   - Service starts but health check returns degraded state
4. Verify error log contains message indicating resolver failure
5. Verify no tenant routes are accessible without resolver active

**Pass Criteria**:

- ✅ Service refuses to boot with resolver disabled, OR
- ✅ Service boots but first workspace route returns 500 or 503
- ✅ Error messages clearly indicate resolver unavailability
- ✅ Graceful failure state (not silent bypass)

**Fail Criteria**:

- ❌ Service boots and workspace routes respond normally
- ❌ Routes silently use default/hardcoded workspace ID
- ❌ No error logging when resolver is absent

---

#### Test 1.4: Workspace Slug Immutability in Context

**Objective**: Verify that tenant workspace slug cannot be overridden from request body or URL
manipulation.

**Validation Steps**:

1. Authenticate as user in Workspace A
2. Attempt to modify workspace context via request body:
   ```json
   {
     "action": "create_student",
     "workspace_slug": "workspace-b-evil-override"
   }
   ```
3. Attempt to modify via subdomain manipulation (if subdomain-based routing):
   - Authenticated to A, try accessing A with Workspace B subdomain header
4. Verify resolver extracts workspace from:
   - Path parameter only (if path-based), OR
   - Subdomain only (if subdomain-based), OR
   - Authenticated user token (immutable source)
5. Verify request body workspace_slug is **ignored** by resolver
6. Verify final resolver context uses only authenticated source, not request body

**Pass Criteria**:

- ✅ Request body workspace_slug ignored by resolver
- ✅ Resolver context always matches authenticated user's workspace
- ✅ No HTTP header can override resolved workspace
- ✅ Audit log shows resolved workspace, not requested one

**Fail Criteria**:

- ❌ Request body workspace_slug changes resolver context
- ❌ HTTP header overrides authenticated workspace
- ❌ URL parameter allows workspace override

---

### Area 2: Provisioning Validation

#### Test 2.1: Deterministic Database Creation (Idempotency)

**Objective**: Verify that provisioning the same workspace twice results in exactly one database,
with no duplicates or partial schemas.

**Validation Steps**:

1. Create License L1 for Workspace W1
2. Trigger provisioning for W1 → should create database `w1_tenant_db`
3. List all databases: verify `w1_tenant_db` exists with complete baseline schema
4. Trigger provisioning for W1 again (same workspace)
5. List all databases: verify still only ONE `w1_tenant_db` exists
6. Verify schema_version matches between provisions
7. Verify all baseline tables exist in both provisions:
   - users
   - roles
   - permissions
   - students
   - staff
   - attempts
   - submissions
   - questions (snapshot)
   - etc.
8. Compare count of tables, indexes, constraints between two supplies → must be identical

**Pass Criteria**:

- ✅ Second provision request returns "already provisioned" response (idempotent)
- ✅ Only one database created across two provision requests
- ✅ Schema_version consistent across provisions
- ✅ All baseline tables present and identical
- ✅ No orphaned databases created
- ✅ No partial schemas

**Fail Criteria**:

- ❌ Second provision creates `w1_tenant_db_2` or similar duplicate
- ❌ Schema differs between first and second provision
- ❌ Second provision fails with error (not idempotent)
- ❌ Partial schema in second provision

---

#### Test 2.2: Distributed Lock Enforcement Under Concurrency

**Objective**: Verify that concurrent provisioning requests for the same workspace are serialized,
preventing race conditions.

**Validation Steps**:

1. Create License L2 for Workspace W2 (not yet provisioned)
2. Simulate 5 concurrent provisioning requests to W2:
   - Submit 5 HTTP requests simultaneously (or within 100ms window)
   - Each request: POST `/api/internal/provision` with workspace_id=W2
3. Expected behavior:
   - Exactly ONE request acquires exclusive lock and completes provisioning
   - Remaining 4 requests wait for lock (blocking), then return "already provisioned"
4. Verify database created exactly once
5. Verify lock_acquired_at timestamp shows single lock winner
6. Verify all 5 requests eventually succeed (not one fails)
7. Verify no database corruption or partial schema

**Lock Validation Specifics**:

- Lock key: `provision:workspace_id:{W2}` (in Redis or equivalent distributed lock system)
- Lock TTL: Must be long enough to cover provisioning time (e.g., 60 seconds)
- Lock release: After provisioning complete, lock must be released
- Lock timeout: If lock holder crashes, lock must expire and allow other requests to retry

**Pass Criteria**:

- ✅ Only one database created despite 5 concurrent requests
- ✅ All 5 requests eventually succeed (either provision or "already provisioned")
- ✅ Schema is complete and uncorrupted
- ✅ Lock acquisition timing shows serialization
- ✅ Worker logs show only one provisioning event

**Fail Criteria**:

- ❌ Multiple databases created
- ❌ Some requests fail while others succeed
- ❌ Partial or corrupted schema
- ❌ Race condition causes duplicate tables

---

#### Test 2.3: Baseline Schema Integrity

**Objective**: Verify that newly provisioned tenant database contains all required baseline tables
and schema_version is correctly set.

**Validation Steps**:

1. Provision new workspace W3
2. Connect directly to tenant database `w3_tenant_db`
3. Verify each required table exists with correct columns:

   | Table              | Critical Columns                                    | Indexes                                      |
   | ------------------ | --------------------------------------------------- | -------------------------------------------- |
   | users              | id, workspace_id, email, created_at                 | PK(id), UK(workspace_id, email)              |
   | roles              | id, workspace_id, name                              | PK(id), UK(workspace_id, name)               |
   | permissions        | id, role_id, resource, action                       | PK(id), FK(role_id)                          |
   | students           | id, workspace_id, email, enrollment_id              | PK(id), UK(workspace_id, email)              |
   | staff              | id, workspace_id, email, role_id                    | PK(id), UK(workspace_id, email), FK(role_id) |
   | attempts           | id, workspace_id, student_id, exam_id, status       | PK(id), FK(student_id), IX(status)           |
   | submissions        | id, attempt_id, question_id, answer_data            | PK(id), FK(attempt_id, question_id)          |
   | questions_snapshot | id, attempt_id, question_id_original, question_data | PK(id), FK(attempt_id)                       |
   | schema_version     | version, applied_at                                 | PK(version)                                  |

4. Verify constraints:
   - All foreign keys present and point to correct tables
   - Unique constraints on workspace_id + identifier pairs
   - NOT NULL constraints on required fields
5. Verify schema_version:
   - Check `schema_version` table has exactly one row
   - Version number matches Phase 01 specification
   - Applied_at timestamp is recent (within provisioning window)
6. Verify triggers (if any exist):
   - updated_at auto-update triggers present
   - Any workspace isolation triggers present

**Pass Criteria**:

- ✅ All critical tables present
- ✅ All expected columns present with correct types
- ✅ Foreign keys properly configured
- ✅ Unique constraints enforce workspace isolation
- ✅ schema_version set to correct value
- ✅ Baseline data (if any) present and correct

**Fail Criteria**:

- ❌ Missing any critical table
- ❌ Missing columns in critical tables
- ❌ Foreign keys incomplete or pointing to wrong tables
- ❌ schema_version missing or incorrect
- ❌ Constraints missing or misconfigured

---

### Area 3: License Engine Validation

#### Test 3.1: License State Machine Integrity

**Objective**: Verify license transitions follow the defined state machine; invalid transitions are
rejected with 409 Conflict.

**State Machine Diagram**:

```
ACTIVE → SOFT_LOCKED → ARCHIVED
  ↓
 (valid end state)

SOFT_LOCKED → ACTIVE (optional reactivation)
ARCHIVED → (terminal, no exit)
DELETED → (terminal, no exit)
```

**Validation Steps**:

**Subtest 3.1a: Valid transition ACTIVE → SOFT_LOCKED**

1. Create license L3 in ACTIVE state
2. Call PATCH `/api/licenses/{L3}` with `status: SOFT_LOCKED`
3. Verify response code: 200 OK
4. Verify database state: license.status = SOFT_LOCKED
5. Verify access to workspace affected by L3 returns 423 (Locked)

**Subtest 3.1b: Valid transition SOFT_LOCKED → ARCHIVED**

1. Workspace already SOFT_LOCKED from 3.1a
2. Call PATCH `/api/licenses/{L3}` with `status: ARCHIVED`
3. Verify response code: 200 OK
4. Verify database state: license.status = ARCHIVED
5. Verify access to workspace returns 403 (Forbidden, requires snapshot restore)

**Subtest 3.1c: Valid transition SOFT_LOCKED → ACTIVE (reactivation)**

1. Create new license L4 in SOFT_LOCKED state
2. Call PATCH `/api/licenses/{L4}` with `status: ACTIVE`
3. Verify response code: 200 OK
4. Verify workspace is now accessible (no 423)

**Subtest 3.1d: Invalid transition ARCHIVED → ACTIVE (rejected)**

1. Create license L5 in ARCHIVED state
2. Attempt PATCH `/api/licenses/{L5}` with `status: ACTIVE`
3. Verify response code: **409 Conflict**
4. Verify error response includes message: "Cannot transition from ARCHIVED to ACTIVE"
5. Verify database state unchanged: still ARCHIVED

**Subtest 3.1e: Invalid transition DELETED → anything (rejected)**

1. Create license L6 in DELETED state
2. Attempt PATCH `/api/licenses/{L6}` with `status: ACTIVE` or SOFT_LOCKED
3. Verify response code: **409 Conflict** or **410 Gone**
4. Verify no state change

**Pass Criteria**:

- ✅ Valid transitions (ACTIVE→SOFT_LOCKED, SOFT_LOCKED→ARCHIVED, SOFT_LOCKED→ACTIVE) succeed with
  200
- ✅ Invalid transitions rejected with 409
- ✅ State machine transitions reflected immediately in database
- ✅ Workspace access permissions change correctly with license state
- ✅ No orphaned state transitions possible

**Fail Criteria**:

- ❌ Invalid transition succeeds (e.g., ARCHIVED→ACTIVE returns 200)
- ❌ Valid transition fails
- ❌ State change not reflected in database
- ❌ Workspace access permissions do not change with license state

---

#### Test 3.2: Version Enforcement (Schema Compatibility)

**Objective**: Verify that if tenant schema_version does not match license product_version, requests
return 426 Upgrade Required.

**Validation Steps**:

1. Create workspace W4 with license pointing to Product v2.0.0
2. Provision W4 with schema_version = 2.0.0
3. Verify: any request to W4 returns 200 OK (versions match)
4. **Simulate schema drift**: In test only, manually update tenant schema_version to 1.9.0 (old
   version)
5. Make request to W4: GET `/api/workspaces/{W4}/students`
6. Verify response code: **426 Upgrade Required** (not 200)
7. Verify response body includes:
   ```json
   {
     "error": {
       "code": "SCHEMA_MISMATCH",
       "message": "Tenant schema v1.9.0 requires upgrade to v2.0.0"
     }
   }
   ```
8. **Reverse drift**: Update schema_version back to 2.0.0
9. Verify request now returns 200 OK

**Pass Criteria**:

- ✅ Version mismatch detected before route handler executes
- ✅ 426 response code returned (not 200 error)
- ✅ Error message includes version information
- ✅ Mismatch check is middleware-level (early validation)

**Fail Criteria**:

- ❌ Request succeeds despite version mismatch
- ❌ Wrong status code returned (not 426)
- ❌ Version check happens too late (after route handler)

---

#### Test 3.3: License Limit Enforcement

**Objective**: Verify that exceeding license limits returns 409 Limit Exceeded error, not 500.

**Validation Steps**:

**Subtest 3.3a: Student Limit Enforcement**

1. Create license L7 with `max_students: 100`
2. Create workspace W5 using L7
3. Provision W5, create 100 students
4. Verify 100th student created successfully
5. Attempt to create 101st student via POST `/api/workspace/{W5}/students`
6. Verify response code: **409 Conflict** (not 200, not 500)
7. Verify error response:
   ```json
   {
     "error": {
       "code": "LIMIT_EXCEEDED",
       "message": "Student limit (100) reached for license",
       "limit": 100,
       "current": 100
     }
   }
   ```
8. Verify no 101st student created in database

**Subtest 3.3b: Staff Limit Enforcement**

1. Create license L8 with `max_staff: 50`
2. Create workspace W6 using L8
3. Create 50 staff members
4. Attempt to create 51st staff member
5. Verify response code: **409 Conflict**
6. Verify error includes staff-specific limit message
7. Verify 51st staff not created

**Subtest 3.3c: Limit Check is Transactional**

1. Use license L9 with `max_students: 10`
2. Within single transaction, attempt to:
   - Create 10 new students (bulk operation)
   - Except one student creation fails (simulated constraint violation)
3. Verify entire transaction rolls back
4. Verify database has 0 new students (all-or-nothing)
5. Verify no partial limit violation

**Pass Criteria**:

- ✅ Limit enforcement returns 409 (not 200 or 500)
- ✅ Error message includes limit and current count
- ✅ No resource created if limit exceeded
- ✅ Limit check is transactional (all-or-nothing)
- ✅ Limit enforcement happens in middleware (before handler)

**Fail Criteria**:

- ❌ Limit exceeded but resource created (returns 200)
- ❌ Wrong status code (500, 400, etc.)
- ❌ Partial limit enforcement (some resources created, some not)
- ❌ No error message with limit info

---

### Area 4: Migration Discipline Validation

#### Test 4.1: Forward-Only Migration Check

**Objective**: Verify no destructive SQL operations (DROP, DELETE, TRUNCATE) exist in migration
files.

**Validation Steps**:

1. Scan all migration files in:
   - `apps/api/src/db/master/migrations/**/*.sql`
   - `apps/api/src/db/tenant/migrations/**/*.sql`
2. For each migration file:
   - Extract SQL statements
   - Check for forbidden patterns:
     - `DROP` (DROP TABLE, DROP COLUMN, DROP INDEX)
     - `DELETE` (DELETE FROM) — except in controlled down() migrations
     - `TRUNCATE`
     - `ALTER TABLE ... DROP`
   - If detected, flag as violation
3. If violations found, verify they only appear in down() section (rollback):
   - Migrations should have up() for forward and down() for rollback
   - DOWN section may contain destructive SQL
   - UP section must never contain destructive SQL
4. Run lint/validation tool: `scripts/validate-migrations.sh`
5. Verify zero destructive SQL in UP sections

**Pass Criteria**:

- ✅ No DROP/DELETE/TRUNCATE in any migration UP section
- ✅ Destructive SQL only in DOWN sections (if present)
- ✅ Migration validation script passes
- ✅ All migrations are forward-compatible

**Fail Criteria**:

- ❌ DROP found in migration UP section
- ❌ DELETE FROM found in migration UP (not in rollback)
- ❌ TRUNCATE found anywhere
- ❌ Migration validation script fails

---

#### Test 4.2: Migration Hash Immutability

**Objective**: Verify that modifying a historical migration file breaks CI/validation (hash check
fails).

**Validation Steps**:

1. Identify an existing migration file: `002_create_users_table.sql`
2. Record its hash (if migration system tracks it), or note its current content
3. Commit it to git (baseline)
4. **In test environment only**: Modify the migration file:
   - Change a column definition
   - Add a comment
   - Change SQL formatting
5. Run migration validation: `scripts/validate-migrations.sh` or equivalent CI check
6. Verify validation **FAILS** with message indicating:
   - "Migration hash mismatch" or
   - "Migration file cannot be modified after applied" or
   - Similar immutability violation
7. Verify pipeline/CI rejects the change
8. **Revert** the modification
9. Verify validation passes again

**Pass Criteria**:

- ✅ Hash mismatch detected when migration modified
- ✅ CI/validation fails on hash mismatch
- ✅ Error message clearly indicates immutability violation
- ✅ Original migration still valid after revert

**Fail Criteria**:

- ❌ Modified migration passes validation (no hash checking)
- ❌ No error when migration altered
- ❌ CI does not reject modified migration

---

#### Test 4.3: Duplicate Migration ID Detection

**Objective**: Verify that attempting to create two migrations with the same ID/number is rejected.

**Validation Steps**:

1. Identify the highest migration number: e.g., `015_create_submissions_table.sql`
2. Attempt to create a new migration file: `016_my_new_migration.sql` (valid)
3. In same batch, also attempt to create: `016_another_migration.sql` (duplicate number)
4. Run migration validation: `scripts/validate-migrations.sh`
5. Verify validation **FAILS** with message: "Duplicate migration ID 016 found" or similar
6. Verify only ONE of the 016 migrations can proceed
7. Rename one to 017, verify validation passes

**Pass Criteria**:

- ✅ Duplicate migration ID detected
- ✅ Validation fails with clear error message
- ✅ No ambiguity about which migration to apply
- ✅ After renaming, validation passes

**Fail Criteria**:

- ❌ Duplicate migration ID not detected
- ❌ Validation passes with two identical IDs
- ❌ Migration system unclear which to apply

---

### Area 5: Rate Limiting Validation

#### Test 5.1: Threshold Enforcement

**Objective**: Verify that exceeding rate limit thresholds returns HTTP 429 Too Many Requests.

**Validation Steps**:

**Subtest 5.1a: Login Endpoint Rate Limit (5 attempts/minute per IP)**

1. Configure rate limit: 5 login attempts per minute per IP
2. From Test IP A, submit 5 login requests (valid or invalid credentials)
3. All 5 should succeed (responses: 200, 401, or 403 depending on auth result)
4. From same IP A, submit 6th login request within same minute
5. Verify response code: **429 Too Many Requests**
6. Verify response includes `Retry-After: {seconds}` header
7. Wait for 1 minute (or until Retry-After expires)
8. Submit 7th login request
9. Verify response code: 200 or 401 (rate limit reset)

**Subtest 5.1b: API Endpoint Rate Limit (per authenticated user)**

1. Configure rate limit: 1000 requests per hour per authenticated user
2. Authenticate as User U1
3. Submit 1000 requests within 1 hour from User U1
4. Verify response codes are 200 (or appropriate success codes)
5. Submit 1001st request within same hour from U1
6. Verify response code: **429 Too Many Requests**
7. Verify different user U2 is NOT rate limited (separate limit bucket)

**Subtest 5.1c: Submission Endpoint Idempotency + Rate Limit**

1. Submission endpoint is idempotent (one per attempt)
2. User submits answer to attempt A1
3. User re-submits same answer (same attempt A1, same question Q1, same answer data)
4. Second submission should succeed with 200 (idempotent, no state change)
5. If rate limit is also enforced on submissions, verify third distinct submission attempt within
   minute is rate-limited
6. Verify submission endpoint honors idempotency first (same submission never rate-limited)

**Pass Criteria**:

- ✅ 429 returned when threshold exceeded
- ✅ Retry-After header present
- ✅ Separate rate limit buckets per IP (login) and per user (API)
- ✅ Rate limit resets after time window expires
- ✅ Idempotent requests bypass rate limiting

**Fail Criteria**:

- ❌ Request succeeds (200) after limit threshold (not rate-limited)
- ❌ Wrong status code (500, 400, etc.)
- ❌ No Retry-After header
- ❌ Rate limits not separated by IP/user

---

#### Test 5.2: Rate Limit Header Verification

**Objective**: Verify that rate limit headers (X-RateLimit-\*) are present in all responses.

**Validation Steps**:

1. Make any API request (authenticated)
2. Verify response headers include:
   - `X-RateLimit-Limit: {limit_value}` (e.g., `X-RateLimit-Limit: 1000`)
   - `X-RateLimit-Remaining: {remaining_value}` (e.g., `X-RateLimit-Remaining: 997`)
   - `X-RateLimit-Reset: {unix_timestamp}` (e.g., `X-RateLimit-Reset: 1709021400`)
3. Verify header values:
   - Limit is constant (e.g., always 1000)
   - Remaining decreases with each request
   - Reset time is a future Unix timestamp
4. Make another request
5. Verify Remaining decreased by 1
6. Continue until Remaining reaches 0
7. Next request returns 429, Remaining should show 0, Reset unchanged
8. Wait for Reset time to pass
9. Verify Reset time updated and Remaining reset to Limit value

**Pass Criteria**:

- ✅ All three headers present on every response
- ✅ Remaining decreases with requests
- ✅ Reset time is valid Unix timestamp in future
- ✅ After reset time passes, Remaining resets

**Fail Criteria**:

- ❌ Headers missing from responses
- ❌ Remaining does not decrease
- ❌ Reset time is in past or invalid
- ❌ Headers not present even after rate limit reached

---

### Area 6: Observability Validation

#### Test 6.1: Structured Logging Compliance

**Objective**: Verify that all logged events include required fields and follow structured format.

**Validation Steps**:

1. Configure logging to capture a file (e.g., `/tmp/zidney.log`)
2. Make a request to API:
   - GET `/api/workspaces/{W1}/students`
3. Examine logged output for this request
4. Verify each log line is valid JSON (parseable)
5. Verify each log entry contains required fields:
   - `timestamp` (ISO 8601 format)
   - `level` (INFO, WARN, ERROR, DEBUG, etc.)
   - `service` (e.g., "api", "worker")
   - `workspace_slug` (e.g., "workspace-1")
   - `workspace_id` (UUID or ID)
   - `user_id` (if authenticated request)
   - `correlation_id` (UUID matching request correlation ID)
   - `message` (human-readable log message)
6. Optional fields (add if applicable):
   - `attempt_id` (if request is attempt-related)
   - `request_id` (if different from correlation_id)
   - `duration_ms` (for performance tracking)
7. Make error request (e.g., 404):
   - GET `/api/workspaces/{W1}/students/nonexistent`
8. Verify error log includes:
   - `level: ERROR`
   - `error.code` (e.g., "NOT_FOUND")
   - `error.message`
   - `status_code` (404)
   - All required fields above

**Log Entry Examples**:

**Success log**:

```json
{
  "timestamp": "2026-02-26T10:30:45.123Z",
  "level": "INFO",
  "service": "api",
  "workspace_slug": "workspace-1",
  "workspace_id": "uuid-123",
  "user_id": "user-456",
  "correlation_id": "corr-789",
  "message": "GET /api/workspaces/workspace-1/students",
  "method": "GET",
  "path": "/api/workspaces/workspace-1/students",
  "status_code": 200,
  "duration_ms": 45
}
```

**Error log**:

```json
{
  "timestamp": "2026-02-26T10:30:46.200Z",
  "level": "ERROR",
  "service": "api",
  "workspace_slug": "workspace-1",
  "workspace_id": "uuid-123",
  "user_id": "user-456",
  "correlation_id": "corr-789",
  "message": "Student not found",
  "error": {
    "code": "NOT_FOUND",
    "message": "Student with ID student-999 not found"
  },
  "status_code": 404
}
```

**Pass Criteria**:

- ✅ All logs are valid JSON
- ✅ All required fields present in every log entry
- ✅ Correlation ID matches request correlation ID
- ✅ Workspace context included for all workspace requests
- ✅ Error logs include error code and message
- ✅ No console.log statements (structured logging only)

**Fail Criteria**:

- ❌ Logs not valid JSON
- ❌ Missing required fields
- ❌ Correlation ID missing or invalid
- ❌ console.log found in logs
- ❌ Sensitive data (passwords, tokens) logged

---

#### Test 6.2: Error Response Contract (RFC 7807)

**Objective**: Verify all error responses follow RFC 7807 JSON Problem format.

**Validation Steps**:

1. Trigger various error conditions:
   - 400 Bad Request (invalid input)
   - 401 Unauthorized (missing auth)
   - 403 Forbidden (insufficient permissions)
   - 404 Not Found (resource not found)
   - 409 Conflict (state machine violation)
   - 426 Upgrade Required (schema mismatch)
   - 429 Too Many Requests (rate limit)
   - 500 Internal Server Error (unhandled exception)
2. For each error, verify response body includes:
   ```json
   {
     "type": "about:blank | https://example.com/errors/[error-type]",
     "title": "[Short error title]",
     "status": [HTTP status code],
     "detail": "[Detailed error explanation]",
     "instance": "[Request identifier or path]"
   }
   ```
3. Verify examples:

   **400 Bad Request** (invalid email format):

   ```json
   {
     "type": "https://api.zidney.io/errors/validation_error",
     "title": "Validation Error",
     "status": 400,
     "detail": "Invalid email format: 'not-an-email'",
     "instance": "/api/workspaces/w1/students"
   }
   ```

   **409 Conflict** (limit exceeded):

   ```json
   {
     "type": "https://api.zidney.io/errors/limit_exceeded",
     "title": "License Limit Exceeded",
     "status": 409,
     "detail": "Student limit (100) reached for this workspace",
     "instance": "/api/workspaces/w1/students"
   }
   ```

   **426 Upgrade Required** (schema mismatch):

   ```json
   {
     "type": "https://api.zidney.io/errors/schema_mismatch",
     "title": "Schema Version Mismatch",
     "status": 426,
     "detail": "Tenant schema v1.9.0 requires upgrade to v2.0.0",
     "instance": "/api/workspaces/w1/students"
   }
   ```

**Pass Criteria**:

- ✅ All error responses follow RFC 7807 format
- ✅ `type` field includes error category
- ✅ `status` matches HTTP status code
- ✅ `detail` provides actionable error message
- ✅ `instance` identifies the request
- ✅ No unstructured error responses

**Fail Criteria**:

- ❌ Error responses not in RFC 7807 format
- ❌ Missing required fields (type, title, status, detail)
- ❌ Custom error format outside RFC 7807
- ❌ Inconsistent error structure across endpoints

---

### Area 7: Attempt Engine Validation

#### Test 7.1: Snapshot Immutability

**Objective**: Verify that once an attempt is started, its configuration snapshot cannot be
modified.

**Validation Steps**:

1. Create exam E1 with:
   - 5 questions
   - Total points: 100
   - Pass threshold: 60%
   - Passing grade: D
2. Student S1 starts attempt A1 on exam E1
3. At attempt start, snapshot is created and stored:
   - Snapshot includes: exam configuration, question list, grading rules
   - Snapshot is immutable
4. **Modify exam E1** (outside of attempt):
   - Change pass threshold to 70%
   - Add 2 new questions
   - Change passing grade to C
5. Verify attempt A1's snapshot remains unchanged:
   - A1 still has original 5 questions (not 7)
   - A1 still uses 60% pass threshold (not 70%)
   - A1 still uses D passing grade (not C)
6. Student S1 completes attempt A1
7. Verify grading uses A1's snapshot, not current exam E1
8. Verify result is same if graded with E1's updated config (should differ if E1 truly modified)

**Snapshot Content to Verify**:

```json
{
  "attempt_id": "A1",
  "exam_id": "E1",
  "snapshot_at": "2026-02-26T10:00:00Z",
  "exam_snapshot": {
    "title": "Algebra Midterm",
    "total_points": 100,
    "pass_threshold": 60,
    "passing_grade": "D",
    "time_limit_minutes": 90
  },
  "questions_snapshot": [
    {
      "question_id": "Q1",
      "order": 1,
      "content": "...",
      "points": 20
    },
    // ... 4 more questions (not 7)
  ],
  "grading_rules_snapshot": {
    "rule_1": { ... },
    ...
  }
}
```

**Pass Criteria**:

- ✅ Snapshot created at attempt start
- ✅ Snapshot contains all exam configuration
- ✅ Modifying exam after start does not affect attempt snapshot
- ✅ Grading uses snapshot rules, not current exam config
- ✅ Grading results consistent with snapshot at attempt time

**Fail Criteria**:

- ❌ Attempt grading uses current exam config (not snapshot)
- ❌ Exam changes affect already-started attempts
- ❌ Snapshot modified after attempt start
- ❌ Question list changes during attempt

---

#### Test 7.2: Worker-Only Grading Authority

**Objective**: Verify that grading logic only executes in Worker process, never in API.

**Validation Steps**:

1. Scan API codebase for any grading logic:
   - Search for functions containing: "grade", "score", "pass", "fail", "evaluate"
   - Verify these do NOT exist in `/apps/api/src/routes/**`
   - Verify grading is only referenced as "delegate to worker" in API
2. Trace a submission endpoint (POST `/api/workspaces/{W}/attempts/{A}/submissions`):
   - API receives submission data
   - API validates submission format
   - API stores submission in database
   - API enqueues task: `grade_submission` → Redis queue
   - API returns 202 Accepted (not 200)
   - API does NOT grade (does not calculate score)
3. Verify Worker process:
   - Receives task from queue
   - Loads attempt snapshot
   - Loads submission data
   - Executes grading logic
   - Updates `submissions.score` field
   - Updates `attempts.status` and `attempts.final_score` if attempt complete
4. Make submission and verify:
   - Submission stored but score is NULL
   - API returns 202 Accepted
   - Score calculated and populated after worker processes

**Pass Criteria**:

- ✅ No grading logic in API codebase
- ✅ Submission endpoint returns 202 (not 200)
- ✅ Score is NULL until worker processes
- ✅ Worker log shows grading execution
- ✅ Score populated after worker completes

**Fail Criteria**:

- ❌ API calculates score (grading in API)
- ❌ Submission returns 200 (not 202)
- ❌ Score populated immediately in response
- ❌ Grading logic exists in API routes

---

#### Test 7.3: Server-Authoritative Time Only

**Objective**: Verify that timing and deadlines use server time, never client time.

**Validation Steps**:

1. Create exam E2 with time limit: 60 minutes
2. Student S2 starts attempt A2:
   - Server time: 2026-02-26 10:00:00 UTC
   - Attempt records: `started_at: 2026-02-26 10:00:00 UTC`
   - Deadline calculated: 10:00 + 60 min = 11:00 UTC
3. Client receives response with deadline time
4. **Client manipulation attempt**: Client's local clock is set 55 minutes ahead:
   - Client clock: 2026-02-26 10:55:00 LOCAL (fake)
   - Client sends submission with `client_timestamp: 2026-02-26 10:55:00`
5. API receives submission:
   - Ignores `client_timestamp` field
   - Uses server time: 2026-02-26 10:00:30 UTC (only 30 seconds elapsed)
   - Verifies deadline using server time
   - Submission accepted (not due yet)
6. Verify database reflects server time:
   - `submissions.created_at: 2026-02-26 10:00:30 UTC` (server time, not client time)
7. Repeat at deadline:
   - Server time: 2026-02-26 11:00:05 UTC (5 seconds past deadline)
   - Client maliciously sends: `client_timestamp: 2026-02-26 10:59:55` (fake early)
   - API uses server time, rejects submission (past deadline)
   - Response: 409 Conflict or 403 Forbidden (attempt closed)

**Pass Criteria**:

- ✅ Server time used for all deadline calculations
- ✅ Client timestamps ignored or validated against server time
- ✅ Submissions accepted up to server deadline
- ✅ Submissions rejected after server deadline
- ✅ Time in database always matches server time
- ✅ No client clock manipulation possible

**Fail Criteria**:

- ❌ Client timestamp used for deadline validation
- ❌ Client can submit past deadline by lying about time
- ❌ Database contains client-provided timestamps

---

### Area 8: Performance Baseline

#### Test 8.1: Middleware Overhead < 1ms

**Objective**: Verify that middleware chain (correlation ID, tenant resolver, license, schema
version) adds < 1ms latency.

**Validation Steps**:

1. Create a minimal test endpoint that does no work:
   ```typescript
   app.get("/api/test/echo", (c) => {
     return c.json({ message: "ok" });
   });
   ```
2. Include all middlewares in this route:
   - Correlation ID middleware
   - Tenant resolver middleware
   - License validation middleware
   - Schema version middleware
3. Measure endpoint latency:
   - Use load testing tool (e.g., `ab`, `wrk`, `k6`)
   - Send 1000 requests
   - Record response times
4. Calculate percentile latencies:
   - Mean (average)
   - P50 (median)
   - P95 (95th percentile)
   - P99 (99th percentile)
5. Verify middleware overhead alone:
   - Subtract baseline echo latency (no middleware) from full middleware latency
   - Middleware overhead = Full latency - Baseline latency
6. Verify overhead < 1ms for all percentiles

**Expected Results**:

- Baseline echo (no middleware): ~0.1-0.3ms
- Full middleware chain: ~0.5-0.8ms
- Middleware overhead: ~0.2-0.5ms (well under 1ms)

**Pass Criteria**:

- ✅ Middleware overhead < 1ms (P95)
- ✅ P99 latency < 1.5ms
- ✅ No outliers > 2ms (except rare GC pauses)

**Fail Criteria**:

- ❌ Middleware overhead > 1ms
- ❌ P99 latency > 2ms consistently
- ❌ Middleware adds more latency than necessary

---

#### Test 8.2: License Check Query < 5ms

**Objective**: Verify that license validation query completes in < 5ms.

**Validation Steps**:

1. Create 10,000 license records in database
2. Create a query that fetches license and validates:
   ```sql
   SELECT * FROM licenses WHERE id = $1 AND status = 'ACTIVE'
   ```
3. Measure query execution time:
   - Run query 1000 times with different license IDs
   - Record execution times
4. Calculate percentiles (P95, P99)
5. Verify < 5ms for all percentiles

**Pass Criteria**:

- ✅ License query P95 < 5ms
- ✅ P99 < 7ms
- ✅ Query uses indexed lookup (license ID primary key)

**Fail Criteria**:

- ❌ Query > 5ms consistently
- ❌ Query uses full table scan (not indexed)

---

#### Test 8.3: Provisioning Lock Resolution < 50ms

**Objective**: Verify that distributed lock acquisition/release for provisioning completes in <
50ms.

**Validation Steps**:

1. Measure time for lock acquisition:
   ```
   START: Lock request
   ...
   END: Lock acquired or timeout
   ```
2. Measure time for lock release:
   ```
   START: Lock release initiated
   ...
   END: Lock released
   ```
3. Run 100 lock cycles
4. Calculate percentiles
5. Verify acquisition and release both < 50ms

**Pass Criteria**:

- ✅ Lock acquisition < 50ms (P95)
- ✅ Lock release < 50ms (P95)
- ✅ No lock timeouts or deadlocks

**Fail Criteria**:

- ❌ Lock acquisition > 50ms
- ❌ Lock timeouts occurring
- ❌ Lock release delayed

---

## Architecture Constraints (Mandatory Pass Conditions)

These constraints are non-negotiable for Stage PASS:

1. **No cross-tenant data access** — Tests 1.1, 1.2, 1.3, 1.4 must all pass
2. **No row-based multi-tenancy** — Tenant isolation tests verify database-per-tenant
3. **License middleware required** — Tests 3.1, 3.2, 3.3 and middleware overhead validate this
4. **Server-authoritative time** — Test 7.3 validates no client time usage
5. **Worker-only grading** — Test 7.2 validates grading never in API
6. **Attempt snapshots immutable** — Test 7.1 validates snapshot integrity
7. **All writes transactional** — Tests 2.2, 3.3 validate transaction semantics
8. **Idempotency for submissions** — Test 5.1c validates idempotent submissions
9. **Migration immutability** — Tests 4.1, 4.2, 4.3 validate migration discipline
10. **Structured logging** — Tests 6.1, 6.2 validate observability

---

## Passing Criteria

**This validation stage is PASSED when:**

- ✅ All 8 validation areas (1.1-8.3) tests PASS
- ✅ No cross-tenant data access detected
- ✅ No migration violations detected
- ✅ No license bypass possible
- ✅ Rate limiting enforced correctly
- ✅ Observability fields complete and correct
- ✅ Attempt engine isolation validated
- ✅ Performance baselines met

**This stage BLOCKS promotion if ANY test FAILS.**

---

## Key Entities

**Test Entities**:

- **Workspace**: Application tenant, owns one database
- **License**: Authorization token, tied to Workspace, enforces limits
- **Attempt**: Student's exam attempt, has immutable snapshot
- **Submission**: Answer to an exam question, stored before grading

---

## Success Criteria (Stage-Level)

| Metric                         | Target               | Verification               |
| ------------------------------ | -------------------- | -------------------------- |
| All validation tests pass      | 100%                 | Required for PASS          |
| Cross-tenant test (1.1-1.4)    | PASS                 | Foundational requirement   |
| Provisioning tests (2.1-2.3)   | PASS                 | Data integrity requirement |
| License tests (3.1-3.3)        | PASS                 | Enforcement requirement    |
| Migration tests (4.1-4.3)      | PASS                 | Versioning requirement     |
| Rate limit tests (5.1-5.2)     | PASS                 | Security requirement       |
| Observability tests (6.1-6.2)  | PASS                 | Operational requirement    |
| Attempt engine tests (7.1-7.3) | PASS                 | Exam integrity requirement |
| Performance tests (8.1-8.3)    | All under thresholds | Operational requirement    |
| Zero test regressions          | 0 failures           | Required for PASS          |

---

## Assumptions

- Test environment has PostgreSQL database accessible
- Redis/equivalent distributed lock system available
- All Phase 01 stages (02-08) are IMPLEMENTED and available for testing
- Test data can be created/destroyed without affecting production
- Load testing tools available (wrk, ab, k6, or equivalent)
- Logging system configured and accessible for validation

---

## Stage Completion Signals

When all tests pass and checklist items verified:

1. Create audit report: `audits/VALIDATION_REPORT.md`
2. Update stage status: `STAGE_STATUS: PASSED`
3. Mark stage for promotion: Ready for `PRODUCTION_READY` phase
4. Archive test data

---

## Clarifications

### Session 2026-02-26

#### Clarification C1: Test Data Isolation Strategy

**Resolved**: Each test creates its own prerequisites (workspaces, licenses, exams, students) and
runs independently.

**Rationale**: Isolation ensures:

- Tests can execute in any order without cascading failures
- Parallel execution capability for validation team
- Test failures are isolated (no cross-test pollution)
- Debugging is simplified

**Implementation**:

- Test setup phase creates all required entities (workspace, license, etc.)
- Test teardown deletes entities (or marks test-specific flag for cleanup)
- No shared state across tests

---

#### Clarification C2: Test 2.2 Concurrency Behavior — Mandatory Requirement

**Resolved**: When concurrent provisioning requests are made on the same workspace within
race-condition window, the service MUST fail fast with a clear error message.

**Mandatory Behavior**: The second request is rejected at the distributed lock layer before any
database modification occurs.

**Rationale**:

- Prevents race conditions and partial state updates
- Lock failure is explicit and immediate
- No silent failures or degraded-mode acceptance

**Implementation**:

- Lock must be acquired transactionally
- Lock timeout: ≤100ms (p95)
- Error code: 409 Conflict with message: "Workspace provisioning already in progress"

---

#### Clarification C3: Cross-Tenant Access Response Code

**Resolved**: Return **403 Forbidden** for cross-tenant access attempts.

**Rationale**:

- User IS authenticated (valid token)
- User lacks PERMISSION to access the workspace
- 403 is the correct HTTP status for insufficient permission
- Resolver middleware rejects the cross-tenant JWT before route handler executes

**Implementation**:

- All Tests 1.1, 1.2, 1.3, 1.4 expect 403 (not 404)
- Consistent across all cross-tenant rejection points

---

#### Clarification C4: License State Creation Mechanics

**Resolved**: Licenses cannot be directly created in non-ACTIVE states. All licenses start in ACTIVE
state.

**License State Transitions (Mandatory Flow)**:

1. New license → ACTIVE (initial state)
2. ACTIVE → SOFT_LOCKED (manual soft-lock operation)
3. SOFT_LOCKED → ARCHIVED (manual archive operation)
4. No direct creation in non-ACTIVE states

**Implementation**:

- Tests 3.1c, 3.1d, 3.1e must:
  - Create license L4, L5, L6 in ACTIVE state
  - Then trigger state transitions (soft-lock, archive) via admin API
  - Verify final state matches expected state
- Prevents bypass of state machine validation

---

#### Clarification C5: Test Count Clarification

**Resolved**: Specification contains **31 distinct atomic test scenarios** (not 23):

- Area 1 (Tenant Isolation): 4 tests
- Area 2 (Provisioning): 3 tests
- Area 3 (License Engine): 9 distinct sub-tests (3.1a-e, 3.2, 3.3a-c)
- Area 4 (Migrations): 3 tests
- Area 5 (Rate Limiting): 4 tests (5.1a-c, 5.2)
- Area 6 (Observability): 2 tests
- Area 7 (Attempt Engine): 3 tests
- Area 8 (Performance): 3 tests

**Rationale**: Each sub-test (e.g., 3.1a, 3.1b, 3.1c) is independently executable and verifiable.
Granularity enables targeted debugging and partial test execution.

**Updated Pass Criteria**: All 31 tests must PASS. Partial pass is not acceptable.

---

**All clarifications resolved: 2026-02-26**  
**Ready for Step 3 — Plan**
