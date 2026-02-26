# Tasks: STAGE_TEST_01_PLATFORM_FOUNDATION

**Stage**: STAGE_TEST_01_PLATFORM_FOUNDATION  
**Branch**: test-001-platform-foundation  
**Created**: 2026-02-26  
**Total Tests**: 31 atomic test scenarios  
**Total Tasks**: 72 implementation tasks  
**Estimated Duration**: 65 minutes (sequential) / 35 minutes (parallel CI)

---

## Format: `[TaskID] [P?] [Area?] Description with file path`

- **[TaskID]**: Sequential identifier (T001, T002, etc., executable order)
- **[P]**: Task can run in parallel (different files, no dependencies)
- **[Area]**: Which test area this task belongs to (Area 1-8 per spec.md)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Test Infrastructure)

**Purpose**: Test framework initialization, utilities, fixtures, and base infrastructure

**Duration**: ~10 minutes  
**Parallelizable**: Partial (T001-T003 sequential, T004+ parallel)

---

### Foundation Layer

- [ ] T001 Create test directory structure matching test types in `tests/unit/`, `tests/integration/`, `tests/static/`, `tests/performance/`
- [ ] T002 Create shared test helpers file: `tests/test-helpers.ts` with:
  - `InMemoryPool` class for mocked Database connections (unit tests)
  - `InstrumentedRedisClient` class for mocked Redis (unit tests)
  - `createMockTenantPool()` factory for isolated test DB contexts
  - Transaction wrapper utilities
  - JWT generation helpers

- [ ] T003 Create test fixtures seeding module: `tests/fixtures/index.ts` exporting:
  - `seedWorkspace(db, overrides?)` - creates workspace with unique slug
  - `seedLicense(db, overrides?)` - creates license with configurable status/limits
  - `seedUser(db, overrides?)` - creates user in tenant database
  - `seedStudent(db, count?)` - creates student records
  - `seedExam(db, overrides?)` - creates exam with questions (needed for Area 7)
  - `seedAttempt(db, overrides?)` - creates attempt with snapshot
  - `seedSubmission(db, overrides?)` - creates submission record
  - All fixtures return consistent, testable objects

### [P] Parallel: Test Configuration

- [ ] T004 [P] Create Vitest configuration: `vitest.config.ts` with:
  - Test environment setup (node for unit, real DB for integration)
  - Mock configuration (auto-mock dependencies)
  - Coverage thresholds (minimum 80% for test infrastructure)
  - Test reporter configuration (verbose, JSON for CI)
  - Timeout settings: unit 5s, integration 30s, performance 60s

- [ ] T005 [P] Create test HTTP client: `tests/http-client.ts` with:
  - `createHttpClient()` factory for mock HTTP requests
  - `.setJWT(token)` method for authentication
  - `.get() .post() .patch() .delete()` methods
  - Response verification helpers
  - Error response matching utilities

- [ ] T006 [P] Create structured logging test spy: `tests/logger-spy.ts` with:
  - Log capture and inspection interface
  - JSON parsing and field validation
  - Required field checklist (timestamp, level, service, workspace_slug, correlation_id, user_id)
  - Sensitive data detection (password, token patterns)

- [ ] T007 [P] Create Docker Compose configuration: `docker-compose.test.yml` with:
  - PostgreSQL 15 service on 5433 (master and tenant databases)
  - Redis 7 service on 6380 (distributed locks, rate limiting)
  - Health checks for both services
  - Persistent volume for test data retention

### [P] Parallel: Test Data Utilities

- [ ] T008 [P] Create database connection manager: `tests/db-manager.ts` with:
  - `.getMasterDb()` - connection to master database
  - `.getTenantDb(workspaceId)` - connection to tenant-specific database
  - `.createTenantDatabase(workspaceSlug)` - provisioning simulation
  - `.teardown()` - cleanup all test databases and connections
  - Transaction management for atomic test operations

- [ ] T009 [P] Create test data cleanup utilities: `tests/cleanup.ts` with:
  - `cleanupAllWorkspaces()` - delete all test workspaces and databases
  - `cleanupWorkspace(workspaceId)` - delete specific workspace
  - `cleanupAllLicenses()` - reset license table
  - `cleanupAllAttempts()` - reset attempt data
  - Idempotency: cleanup can be called multiple times safely

- [ ] T010 [P] Create audit log verification helpers: `tests/audit-helpers.ts` with:
  - `queryAuditLog(filters)` - retrieve audit entries matching conditions
  - `verifyAuditEvent(action, workspace_id, expected_status)` - assert audit trail
  - Used by Area 1 tests to verify unauthorized access attempts logged

- [ ] T011 [P] Create RFC 7807 error contract matchers: `tests/error-matchers.ts` with:
  - `toMatchRFC7807(expectedStatus, expectedCode)` - Vitest custom matcher
  - Validates: type, title, status, detail, instance, error_code fields
  - Used by all error validation tests (Areas 1, 3, 5, 6)

### [P] Parallel: Test Constants & Types

- [ ] T012 [P] Create test constants file: `tests/test-constants.ts` with:
  - Test workspace slugs: `TEST_WS_A`, `TEST_WS_B`, `TEST_WS_CONCURRENT`
  - Test user IDs and emails
  - License limits for testing: `TEST_STUDENT_LIMIT`, `TEST_STAFF_LIMIT`
  - Rate limit thresholds: `TEST_LOGIN_LIMIT_PER_MIN`, `TEST_API_LIMIT_PER_HOUR`
  - Timeout values: `TEST_LOCK_TIMEOUT_MS`, `TEST_PROVISION_TIMEOUT_MS`
  - Performance baseline thresholds: `MIDDLEWARE_OVERHEAD_MAX_MS`, `LOCK_RESOLUTION_MAX_MS`

- [ ] T013 [P] Create test types file: `tests/types.ts` with:
  - `TestEnvironment` interface (workspaces, databases, connections)
  - `TestFixture` interface (all seedable entities)
  - `PerformanceMetrics` interface (latency percentiles)
  - `AuditLogEntry` interface (audit log schema validation)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Configuration and startup validation that must complete before ANY test can run

**Duration**: ~5 minutes  
**Parallelizable**: Yes

---

### Environment & Dependencies

- [ ] T014 [P] Verify external dependencies available:
  - PostgreSQL running on localhost:5433
  - Redis running on localhost:6380
  - Bun/Node.js runtime >= 20
  - Vitest >= 1.0 installed
  - Create `scripts/verify-test-env.sh` that exits 0 if all present, 1 otherwise

- [ ] T015 [P] Create test database initialization script: `scripts/init-test-db.sh` with:
  - Drop existing master_db, recreate with baseline schema
  - Apply all Phase 01 migrations
  - Apply Phase 02 migrations (exam/question tables needed for Area 7)
  - Verify schema_version set correctly
  - Script idempotent (safe to run multiple times)

- [ ] T016 [P] Create Redis test data cleanup script: `scripts/reset-test-redis.sh` with:
  - Flush all Redis data (safe for test environment only)
  - Recreate rate limit buckets (empty)
  - Verify Redis connection healthy

---

### CI Configuration

- [ ] T017 [P] Create GitHub Actions workflow (or equivalent CI): `.github/workflows/test-stage-001.yml` with:
  - **Job 1**: Unit tests (Vitest --run, ~15 min)
  - **Job 2**: Integration tests (Docker + Vitest, ~30 min, parallel to Job 1)
  - **Job 3**: Static analysis (Vitest, ~5 min, parallel to Jobs 1-2)
  - **Job 4**: Performance tests (real infrastructure, ~15 min, depends on Job 2)
  - Critical path: Job 2 (30 min)
  - Report: Merged coverage + test results

---

## Phase 3: Area 1 — Tenant Isolation Validation

**Goal**: Verify that cross-tenant data access is impossible; users cannot access other workspaces

**Independent Test**: All 4 tests must pass to prove tenant isolation is enforced at both API and database layers

**Duration**: ~20 minutes (unit 8 min + integration 12 min)

---

### Unit Tests (Tests 1.1-1.4 with mocks)

- [ ] T018 Create unit test file: `tests/unit/01-tenant-isolation.test.ts` with describe block "Area 1: Tenant Isolation (Unit)"

- [ ] T019 [P] [Area 1] Test 1.1 unit implementation:
  - Cross-tenant data access rejection test
  - Setup: 2 workspaces (ws-a, ws-b), 1 user per workspace
  - Act: Authenticate as User A, attempt GET `/api/workspaces/{ws-b.slug}/students`
  - Assert: Status 403, response body null, RFC 7807 format
  - In `tests/unit/01-tenant-isolation.test.ts`

- [ ] T020 [P] [Area 1] Test 1.2 unit implementation:
  - Master database boundary enforcement test
  - Codebase scan: Verify no direct master_db imports in tenant-bound routes
  - Pattern: `/apps/api/src/routes/**` should NOT contain `master_db.query()` in tenant context
  - In `tests/unit/01-tenant-isolation.test.ts`

- [ ] T021 [P] [Area 1] Test 1.3 unit implementation:
  - Resolver middleware enforcement test
  - Create minimal Hono app WITH resolver middleware → first request succeeds
  - Create minimal Hono app WITHOUT resolver middleware → first request fails (500 or 503)
  - Verify error message indicates resolver unavailability
  - In `tests/unit/01-tenant-isolation.test.ts`

- [ ] T022 [P] [Area 1] Test 1.4 unit implementation:
  - Workspace slug immutability test
  - Authenticate as User A (workspace-a)
  - Attempt POST with malicious `workspace_slug: workspace-b` in request body
  - Verify: resolver context uses authenticated workspace (workspace-a), not body override
  - In `tests/unit/01-tenant-isolation.test.ts`

### Integration Tests (Tests 1.1-1.4 with real database)

- [ ] T023 Create integration test file: `tests/integration/01-tenant-isolation.test.ts` with describe block "Area 1: Tenant Isolation (Integration)"

- [ ] T024 [Area 1] Create multi-workspace setup helper:
  - Function `setupMultiWorkspaceTest(masterDb, tenantPoolMap)` in test file
  - Creates workspace A + B with real databases
  - Provisions both tenant databases
  - Seeds users in both
  - Returns: `{ wsA, wsB, userA, userB, dbA, dbB }`

- [ ] T025 [Area 1] Test 1.1 integration implementation:
  - Cross-tenant access rejection with real database
  - Setup: Use multi-workspace helper
  - Act: Authenticate as user from workspace A, attempt access to workspace B resource
  - Assert: 403 Forbidden, audit log records attempted unauthorized access
  - Verify: No data from workspace B leaked in response
  - In `tests/integration/01-tenant-isolation.test.ts`

- [ ] T026 [Area 1] Test 1.2 integration implementation (same as unit but with real connections):
  - Verify resolver chain executes in correct order: correlation → resolver → license → schema → handler
  - In `tests/integration/01-tenant-isolation.test.ts`

- [ ] T027 [Area 1] Test 1.3 integration implementation (same as unit):
  - Service startup validation with real environment
  - In `tests/integration/01-tenant-isolation.test.ts`

- [ ] T028 [Area 1] Test 1.4 integration implementation (same as unit but with real HTTP):
  - In `tests/integration/01-tenant-isolation.test.ts`

- [ ] T029 [Area 1] Add teardown hook for multi-workspace tests:
  - Delete workspace A and B databases after all tests
  - Delete master records
  - Clean up audit log entries
  - In `tests/integration/01-tenant-isolation.test.ts` afterAll()

**Checkpoint**: All 8 (4 unit + 4 integration) tenant isolation tests PASS ✅

---

## Phase 4: Area 2 — Provisioning Validation

**Goal**: Verify deterministic, idempotent, race-condition-safe workspace provisioning

**Independent Test**: Provisioning can be triggered 5x concurrently and result is 1 database, complete schema

**Duration**: ~15 minutes (integration only, no unit)

---

### Integration Tests (Tests 2.1-2.3, real database + concurrency)

- [ ] T030 Create provisioning test file: `tests/integration/02-provisioning.test.ts` with describe block "Area 2: Provisioning Validation"

- [ ] T031 [Area 2] Test 2.1 implementation:
  - Deterministic database creation (idempotency)
  - First provision: triggers database creation
  - Check database list: exactly 1 database created
  - Second provision (same workspace): returns "already provisioned"
  - Check database list: still exactly 1 database
  - Assert: schema_version, baseline tables, indexes identical across provisions
  - In `tests/integration/02-provisioning.test.ts`

- [ ] T032 [Area 2] Test 2.2 implementation:
  - Distributed lock enforcement under concurrency
  - Create workspace (not yet provisioned)
  - Submit 5 concurrent provision requests (simultaneous or <100ms window)
  - Expected: 1 succeeds, 4 get "already in progress" (locked)
  - Verify: Exactly 1 database created (no race condition)
  - Verify: All 5 requests eventually succeed
  - Verify: Lock timeout/TTL = ~60 seconds
  - In `tests/integration/02-provisioning.test.ts`

- [ ] T033 [Area 2] Test 2.3 implementation:
  - Baseline schema integrity after provisioning
  - Provision new workspace
  - Connect to tenant database, verify all required tables present:
    - users, roles, permissions, students, staff, attempts, submissions, questions_snapshot, schema_version
  - Verify foreign keys, unique constraints, NOT NULL constraints
  - Verify schema_version row exists with semantic version (X.Y.Z) and recent timestamp
  - In `tests/integration/02-provisioning.test.ts`

- [ ] T034 [Area 2] Create provisioning test helper:
  - `provisioning.provision(workspaceId)` - triggers provisioning
  - Used by all three provisioning tests
  - Returns: `{ success: boolean, message: string }`
  - In `tests/integration/02-provisioning.test.ts` or shared helper

**Checkpoint**: All 3 provisioning tests PASS ✅

---

## Phase 5: Area 3 — License Engine Validation

**Goal**: Verify license state machine, version enforcement, limit enforcement

**Independent Test**: License state transitions, version mismatches, and limit breaches all handled correctly

**Duration**: ~25 minutes (9 unit sub-tests + integration)

---

### Unit Tests (Tests 3.1a-e, 3.2, 3.3a-c)

- [ ] T035 Create license engine unit test file: `tests/unit/03-license-engine.test.ts` with describe block "Area 3: License Engine Validation"

#### Test 3.1: License State Machine (5 sub-tests)

- [ ] T036 [P] [Area 3] Test 3.1a implementation:
  - Valid transition ACTIVE → SOFT_LOCKED
  - Create license in ACTIVE state
  - PATCH to SOFT_LOCKED status
  - Assert: 200 OK, database reflects SOFT_LOCKED, access to workspace returns 423
  - In `tests/unit/03-license-engine.test.ts`

- [ ] T037 [P] [Area 3] Test 3.1b implementation:
  - Valid transition SOFT_LOCKED → ARCHIVED
  - Starting from SOFT_LOCKED state (from 3.1a)
  - PATCH to ARCHIVED
  - Assert: 200 OK, database reflects ARCHIVED, access to workspace returns 403
  - In `tests/unit/03-license-engine.test.ts`

- [ ] T038 [P] [Area 3] Test 3.1c implementation:
  - Valid transition SOFT_LOCKED → ACTIVE (reactivation)
  - Create license, transition to SOFT_LOCKED, then back to ACTIVE
  - Assert: 200 OK, workspace is accessible again
  - In `tests/unit/03-license-engine.test.ts`

- [ ] T039 [P] [Area 3] Test 3.1d implementation:
  - Invalid transition ARCHIVED → ACTIVE (rejected)
  - Create license, transition to ARCHIVED (via SOFT_LOCKED)
  - Attempt to transition ARCHIVED → ACTIVE
  - Assert: 409 Conflict, error_code: INVALID_TRANSITION, detail shows current/requested states
  - In `tests/unit/03-license-engine.test.ts`

- [ ] T040 [P] [Area 3] Test 3.1e implementation:
  - Invalid transition DELETED → \* (rejected)
  - Create license in DELETED state (or manually set for test)
  - Attempt any transition from DELETED
  - Assert: 409 Conflict or 410 Gone, no state change
  - In `tests/unit/03-license-engine.test.ts`

#### Test 3.2: Version Enforcement

- [ ] T041 [Area 3] Test 3.2 implementation:
  - Version enforcement (schema compatibility)
  - Create workspace with license pointing to product v2.0.0
  - Provision with schema_version = 2.0.0
  - Any request returns 200 OK (versions match)
  - Manually update tenant schema_version to 1.9.0
  - Next request should return: 426 Upgrade Required with error code SCHEMA_MISMATCH
  - Verify error detail includes both versions
  - Delete test workspace
  - In `tests/unit/03-license-engine.test.ts`

#### Test 3.3: License Limit Enforcement (3 sub-tests)

- [ ] T042 [P] [Area 3] Test 3.3a implementation:
  - Student limit enforcement
  - Create license with max_students: 100
  - Create workspace using this license
  - Create 100 students
  - Attempt to create 101st student via POST
  - Assert: 409 Conflict, error_code: LIMIT_EXCEEDED
  - Error includes: limit, current, message with details
  - Verify 101st student NOT created in database
  - In `tests/unit/03-license-engine.test.ts`

- [ ] T043 [P] [Area 3] Test 3.3b implementation:
  - Staff limit enforcement
  - Create license with max_staff: 50
  - Create 50 staff members
  - Attempt to create 51st
  - Assert: 409 Conflict, error_code: LIMIT_EXCEEDED (staff-specific message)
  - Verify 51st staff NOT created
  - In `tests/unit/03-license-engine.test.ts`

- [ ] T044 [Area 3] Test 3.3c implementation:
  - Limit check is transactional
  - Create license with max_students: 10
  - Attempt bulk operation: create 11 students within transaction
  - Assert: Transaction rolls back entirely (0 students added, not 10)
  - Verify all-or-nothing behavior
  - In `tests/unit/03-license-engine.test.ts`

### Integration Tests (License enforcement with real database context)

- [ ] T045 Create license engine integration test file: `tests/integration/03-license-engine.test.ts`

- [ ] T046 [Area 3] Integration test:
  - All 3.1a-e state transitions with real database
  - Verify workspace access permissions change with license state
  - In `tests/integration/03-license-engine.test.ts`

- [ ] T047 [Area 3] Integration test:
  - Version enforcement with real tenant database
  - Schema version mismatch detection
  - In `tests/integration/03-license-engine.test.ts`

- [ ] T048 [Area 3] Integration test:
  - Limit enforcement with real database writes
  - Transactional correctness
  - In `tests/integration/03-license-engine.test.ts`

**Checkpoint**: All 9 unit + 3 integration license tests PASS ✅

---

## Phase 6: Area 4 — Migration Discipline Validation

**Goal**: Verify migrations are forward-only, immutable, no duplicates

**Independent Test**: Migration file scanning and validation passes

**Duration**: ~8 minutes (static analysis, no runtime DB)

---

### Static Analysis Tests (Tests 4.1-4.3, file-based)

- [ ] T049 Create migration discipline test file: `tests/static/04-migration-discipline.test.ts` with describe block "Area 4: Migration Discipline Validation"

- [ ] T050 [Area 4] Test 4.1 implementation:
  - Forward-only migration check
  - Scan: `apps/api/src/db/master/migrations/**/*.sql`, `apps/api/src/db/tenant/migrations/**/*.sql`
  - For each migration:
    - Extract UP section (before -- DOWN or EOF)
    - Check UP section does NOT contain: DROP, DELETE FROM, TRUNCATE
    - Verify DOWN section (if exists) CAN contain these (rollback allowed)
  - Assert: Zero destructive SQL in UP sections
  - In `tests/static/04-migration-discipline.test.ts`

- [ ] T051 [Area 4] Test 4.2 implementation:
  - Migration hash immutability
  - Load hashmap from `.migrations.json` (SHA256 per migration)
  - Calculate current SHA256 for each migration file
  - Compare: current hash vs stored hash
  - Assert: All hashes match (no migrations modified after initial recording)
  - If mismatch detected: fail with "Migration {filename} hash changed (immutability violation)"
  - In `tests/static/04-migration-discipline.test.ts`

- [ ] T052 [Area 4] Test 4.3 implementation:
  - Duplicate migration ID detection
  - Extract migration ID (number prefix) from each filename
  - Build set of IDs
  - Assert: Set size = array size (no duplicates)
  - If duplicates found: fail with list of duplicate IDs and filenames
  - In `tests/static/04-migration-discipline.test.ts`

- [ ] T053 Create migration hash recording script:
  - `scripts/record-migration-hashes.sh`
  - Generates `.migrations.json` with SHA256 hashes of all migration files
  - Used during deployment to lock migration hashes
  - Idempotent (safe to run multiple times)

**Checkpoint**: All 3 migration tests PASS ✅

---

## Phase 7: Area 5 — Rate Limiting Validation

**Goal**: Verify rate limits enforced, headers present, idempotency respected

**Independent Test**: Rate limit thresholds, per-IP/per-user bucketing, headers

**Duration**: ~12 minutes (unit + integration)

---

### Unit Tests (Tests 5.1a-c, 5.2 with mocks)

- [ ] T054 Create rate limiting unit test file: `tests/unit/05-rate-limiting.test.ts` with describe block "Area 5: Rate Limiting Validation"

#### Test 5.1: Threshold Enforcement

- [ ] T055 [P] [Area 5] Test 5.1a implementation:
  - Login endpoint rate limit (5/min per IP)
  - Mock HTTP client from IP A
  - Submit 5 login requests (any credentials)
  - Assert: All 5 succeed (200, 401, or 403)
  - Submit 6th request
  - Assert: 429 Too Many Requests, Retry-After header present
  - Wait (simulated), submit 7th
  - Assert: 200 or 401 (limit reset)
  - In `tests/unit/05-rate-limiting.test.ts`

- [ ] T056 [P] [Area 5] Test 5.1b implementation:
  - API endpoint rate limit (per authenticated user)
  - Create 2 users (User1, User2)
  - Authenticate as User1, make 1000 requests within 1 hour
  - Assert: All 1000 succeed
  - Submit 1001st request
  - Assert: 429 Too Many Requests
  - Switch to User2, make request
  - Assert: User2 is NOT rate limited (separate bucket)
  - In `tests/unit/05-rate-limiting.test.ts`

- [ ] T057 [P] [Area 5] Test 5.1c implementation:
  - Submission idempotency bypasses rate limiting
  - Create attempt A1, question Q1
  - Submit answer (status: 202 Accepted)
  - Re-submit identical answer (same attempt, question, answer data)
  - Assert: 202 (idempotent, not rate limited)
  - Submit different question Q2
  - Assert: 202 (distinct operation, not rate limited if within threshold)
  - In `tests/unit/05-rate-limiting.test.ts`

#### Test 5.2: Rate Limit Headers

- [ ] T058 [Area 5] Test 5.2 implementation:
  - Rate limit header verification
  - Make any authenticated API request
  - Assert headers present:
    - `X-RateLimit-Limit: {value}` (e.g., 1000)
    - `X-RateLimit-Remaining: {value}` (decreases with requests)
    - `X-RateLimit-Reset: {unix_timestamp}` (future date)
  - Make 10 more requests, track Remaining values
  - Assert: Remaining decreases by 1 per request
  - Continue until Remaining = 0
  - Assert: Next request returns 429, headers still present
  - Wait for Reset time, verify Remaining resets to Limit
  - In `tests/unit/05-rate-limiting.test.ts`

### Integration Tests (Rate limiting with real Redis)

- [ ] T059 Create rate limiting integration test file: `tests/integration/05-rate-limiting.test.ts`

- [ ] T060 [Area 5] Integration test:
  - Rate limit threshold enforcement with real Redis backend
  - In `tests/integration/05-rate-limiting.test.ts`

- [ ] T061 [Area 5] Integration test:
  - Rate limit headers with real rate limit counters
  - In `tests/integration/05-rate-limiting.test.ts`

**Checkpoint**: All 4 unit + 2 integration rate limiting tests PASS ✅

---

## Phase 8: Area 6 — Observability Validation

**Goal**: Verify structured logging with required fields, RFC 7807 error contract

**Independent Test**: All logs JSON, all fields present, no sensitive data

**Duration**: ~10 minutes (integration, logging capture)

---

### Integration Tests (Tests 6.1-6.2 with real logging)

- [ ] T062 Create observability test file: `tests/integration/06-observability.test.ts` with describe block "Area 6: Observability Validation"

#### Test 6.1: Structured Logging Compliance

- [ ] T063 [Area 6] Test 6.1 implementation:
  - Structured logging compliance
  - Make authenticated request: GET `/api/workspaces/{ws}/students`
  - Capture all log entries for this request (correlation_id matching)
  - For each log entry:
    - Assert: Valid JSON (parseable)
    - Assert: All required fields present:
      - timestamp (ISO 8601)
      - level (INFO, WARN, ERROR, etc.)
      - service (e.g., "api")
      - workspace_slug (e.g., "workspace-1")
      - workspace_id (UUID)
      - correlation_id (matches request)
      - user_id (if authenticated)
      - message (human-readable)
    - Assert: No console.log found (only structured logging)
  - Make error request: 404 Not Found
  - Assert: Error log includes: level: ERROR, error.code, error.message, status_code
  - In `tests/integration/06-observability.test.ts`

#### Test 6.2: RFC 7807 Error Response Contract

- [ ] T064 [Area 6] Test 6.2 implementation:
  - Error response contract (RFC 7807)
  - Trigger various errors:
    - 400: Invalid email format
    - 401: Missing authorization
    - 403: Cross-tenant access
    - 404: Nonexistent resource
    - 409: Limit exceeded
    - 426: Schema mismatch
    - 429: Rate limited
    - 500: Server error
  - For each error, assert RFC 7807 format:
    - `type: https://api.zidney.io/errors/[category]`
    - `title: [short error title]`
    - `status: [http code]`
    - `detail: [actionable message]`
    - `instance: [request path]`
    - `error_code: [custom code]`
  - Assert: All error responses consistent format
  - Assert: No unstructured error responses (no "message" or "code" at root without RFC 7807 wrapper)
  - In `tests/integration/06-observability.test.ts`

**Checkpoint**: All 2 observability tests PASS ✅

---

## Phase 9: Area 7 — Attempt Engine Validation

**Goal**: Verify snapshot immutability, worker-only grading, server-authoritative time

**Independent Test**: Snapshots locked, grading only in worker, client time ignored

**Duration**: ~15 minutes (integration, worker verification)

---

### Integration Tests (Tests 7.1-7.3 with real attempt lifecycle)

- [ ] T065 Create attempt engine test file: `tests/integration/07-attempt-engine.test.ts` with describe block "Area 7: Attempt Engine Validation"

#### Test 7.1: Snapshot Immutability

- [ ] T066 [Area 7] Test 7.1 implementation:
  - Snapshot immutability
  - Create exam E1: 5 questions, 100 points, 60% pass threshold, D passing grade
  - Student S1 starts attempt A1 (snapshot created)
  - Modify exam E1: 70% threshold, C passing grade, add 2 new questions (total 7)
  - Verify attempt A1 snapshot:
    - Still has 5 questions (not 7)
    - Still has 60% threshold (not 70%)
    - Still has D passing grade (not C)
  - Student submits and attempt is graded (by worker)
  - Assert: Grading uses A1's snapshot, not current E1 config
  - In `tests/integration/07-attempt-engine.test.ts`

#### Test 7.2: Worker-Only Grading Authority

- [ ] T067 [Area 7] Test 7.2 implementation:
  - Worker-only grading authority
  - Codebase scan: `/apps/api/src/routes/**` does NOT contain grading logic
  - Pattern: No calculateScore, gradeSubmission, evaluateAnswer in routes
  - Create attempt A2 and make submission
  - Assert: Response status 202 (not 200)
  - Assert: Submission.score is NULL in response
  - Assert: Task queued for worker (verify in job queue)
  - In `tests/integration/07-attempt-engine.test.ts`

#### Test 7.3: Server-Authoritative Time

- [ ] T068 [Area 7] Test 7.3 implementation:
  - Server-authoritative time (client time ignored)
  - Create attempt A3 with 60-minute deadline
  - Server time: 2026-02-26 10:00:00 UTC
  - Malicious client attempts: submit with client_timestamp = 10:55:00 (55 min elapsed, fake)
  - API ignores client_timestamp, uses server time
  - Assert: submission.submitted_at = server time (not client time)
  - Assert: Submission accepted (within deadline per server time)
  - Wait until server time = 11:00:05 (past deadline)
  - Client attempts: submit with fake early time = 10:59:55
  - API rejects (past deadline per server time)
  - Assert: 409 or 403, deadline enforcement used server time
  - In `tests/integration/07-attempt-engine.test.ts`

**Checkpoint**: All 3 attempt engine tests PASS ✅

---

## Phase 10: Area 8 — Performance Baseline Validation

**Goal**: Verify middleware overhead <1ms, license check <5ms, lock resolution <50ms

**Independent Test**: Latency percentiles meet thresholds under load

**Duration**: ~15 minutes (performance load testing)

---

### Performance Tests (Tests 8.1-8.3 with load tools)

- [ ] T069 Create performance test file: `tests/performance/08-performance-baseline.test.ts` with describe block "Area 8: Performance Baseline"

#### Test 8.1: Middleware Overhead

- [ ] T070 [Area 8] Test 8.1 implementation:
  - Middleware overhead < 1ms
  - Create minimal endpoint: GET `/api/test/echo` returns `{ ok: true }`
  - Version 1: WITH all middleware (correlation, resolver, license, schema version)
  - Version 2: WITHOUT middleware (baseline)
  - Load test both endpoints with 1000 requests
  - Calculate latency: full - baseline = middleware overhead
  - Assert: P95 overhead < 1ms
  - Assert: P99 overhead < 1.5ms
  - Assert: No outliers > 2ms
  - In `tests/performance/08-performance-baseline.test.ts`

#### Test 8.2: License Query Performance

- [ ] T071 [Area 8] Test 8.2 implementation:
  - License check query < 5ms
  - Create 10,000 license records in master database
  - Execute query 1000 times: SELECT \* FROM licenses WHERE id = $1 AND status = 'ACTIVE'
  - Calculate percentiles
  - Assert: P95 < 5ms
  - Assert: P99 < 7ms
  - Assert: Query uses indexed lookup (verify query plan)
  - In `tests/performance/08-performance-baseline.test.ts`

#### Test 8.3: Provisioning Lock Performance

- [ ] T072 [Area 8] Test 8.3 implementation:
  - Provisioning lock resolution < 50ms
  - Measure 100 lock cycles: acquire + release
  - Calculate percentiles
  - Assert: P95 acquisition < 50ms
  - Assert: P95 release < 50ms
  - Assert: No lock timeouts or deadlocks
  - In `tests/performance/08-performance-baseline.test.ts`

**Checkpoint**: All 3 performance tests PASS ✅

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, and cleanup

**Duration**: ~10 minutes

---

### Final Validation

- [ ] T073 Create comprehensive test runner script: `scripts/run-all-tests.sh` with:
  - Sequential execution: Static → Unit → Integration → Performance
  - Parallel CI mode: All jobs in parallel
  - Summary report at end
  - Exit code 0 if all pass, 1 if any fail

- [ ] T074 Create test coverage report:
  - Generate coverage report: `npm run test:coverage`
  - Minimum 80% coverage for test infrastructure
  - Generate HTML report: `coverage/index.html`

- [ ] T075 Create validation report template: `audits/VALIDATION_REPORT.md` with:
  - Section: Test Results (31/31 passed)
  - Section: Architecture Validation (8/8 areas passed)
  - Section: Performance Metrics (all thresholds met)
  - Section: Audit Trail (cross-tenant attempts detected: 0)
  - Section: Promotion Decision (ready for PRODUCTION_READY)

### Documentation

- [ ] T076 Create test execution guide: `docs/TESTING.md` with:
  - Prerequisites (PostgreSQL, Redis, Node.js)
  - Running all tests (sequential and parallel)
  - Running specific test areas (e.g., `npm run test:area-1`)
  - Interpreting test results
  - Debugging failed tests
  - Adding new tests

- [ ] T077 Update README: `specs/runtime/test-001-platform-foundation/README.md` with:
  - Quick start commands
  - Test organization overview
  - Expected runtime (~65 min sequential, ~35 min CI)
  - Stage completion checklist

### Cleanup

- [ ] T078 Create post-test cleanup script: `scripts/cleanup-test-env.sh` with:
  - Delete all test databases
  - Clear test data from Redis
  - Clean log files
  - Reset to clean state

---

## Task Dependencies & Execution Order

### Critical Path

```
T001 (Setup structure)
  ├─ T002-T003 (Helpers, fixtures)
  ├─ T004-T013 (Test config, utilities, constants) [All parallel after T001]
  ├─ T014-T017 (Environment, CI setup) [Parallel, required before running tests]
  ├─ T018-T034 (Areas 1-2 unit + integration) [Parallel after T014]
  ├─ T035-T048 (Area 3 license tests) [Parallel after T014]
  ├─ T049-T053 (Area 4 migration static tests) [Parallel after T014]
  ├─ T054-T061 (Area 5 rate limiting tests) [Parallel after T014]
  ├─ T062-T064 (Area 6 observability tests) [Parallel after T014]
  ├─ T065-T068 (Area 7 attempt engine tests) [Parallel after T014]
  ├─ T069-T072 (Area 8 performance tests) [After all integration tests]
  └─ T073-T078 (Polish & validation) [After all test areas complete]
```

### Phase Completion Gates

- **Phase 1 (Setup) DONE**: T001-T017 complete
- **Phase 2 (Foundational) BLOCKED ONLY IF**: T014 or T015 fail (missing env)
- **Phase 3-10 (Test Areas) READY**: After Phase 1 + 2
- **All Tests Executable**: After T015 (DB init) complete
- **All Tests PASS**: Required for Phase 11 (Polish)
- **Stage PASSED**: After T075-T077 complete with all 31 tests passing

### Parallel Opportunities

- **Setup Phase**: T004-T013 all parallel (no dependencies)
- **Environment**: T014-T017 all parallel (no dependencies)
- **All Test Areas**: T018-T072 fully parallelizable by area:
  - Area 1 unit tests (T019-T022) parallel
  - Area 1 integration tests (T025-T028) sequential (share setup)
  - Area 3 unit tests (T036-T044) parallel
  - Area 5 unit tests (T055-T058) parallel
  - **Different areas**: Can run simultaneously (different workspaces)
- **Polish Phase**: T073-T078 sequential (each builds on previous)

---

## Parallel Execution Example (CI Job Distribution)

```bash
# Job 1: Static Analysis (Area 4) — ~5 minutes
npm run test:static --> T049-T053

# Job 2: Unit Tests (Areas 1,3,5) — ~15 minutes
npm run test:unit --> T019-T022, T036-T044, T055-T058 (parallel)

# Job 3: Integration Tests (Areas 1,2,6,7) — ~30 minutes
docker-compose -f docker-compose.test.yml up -d
npm run test:integration --> T023-T034, T046-T048, T062-T064, T065-T068
docker-compose -f docker-compose.test.yml down

# Job 4: Performance Tests (Area 8) — ~15 minutes [DEPENDS: Job 3]
npm run test:performance --> T069-T072

# Critical path: Job 3 (30 min)
# Total CI time: max(5, 15, 30, 15) + overhead = ~35 minutes
```

---

## Test Execution Commands

```bash
# Run everything (sequential)
npm run test:all

# Run by area
npm run test:area-1    # Tenant isolation (unit + integration)
npm run test:area-2    # Provisioning (integration)
npm run test:area-3    # License engine (unit + integration)
npm run test:area-4    # Migrations (static)
npm run test:area-5    # Rate limiting (unit + integration)
npm run test:area-6    # Observability (integration)
npm run test:area-7    # Attempt engine (integration)
npm run test:area-8    # Performance (performance)

# Run by test type
npm run test:unit        # Areas 1,3,5 unit tests
npm run test:integration # Areas 1,2,6,7 integration tests
npm run test:static      # Area 4 migration tests
npm run test:performance # Area 8 performance tests

# Run with coverage
npm run test:coverage

# Run single test area with verbose output
npm run test -- tests/unit/01-tenant-isolation.test.ts --reporter=verbose
```

---

## Success Criteria (All-or-Nothing)

**Stage PASSES when:**

✅ T001-T017 complete (setup + environment ready)  
✅ T018-T034 PASS (Area 1-2: 7 tests)  
✅ T035-T048 PASS (Area 3: 9 tests)  
✅ T049-T053 PASS (Area 4: 3 tests)  
✅ T054-T061 PASS (Area 5: 4 tests)  
✅ T062-T064 PASS (Area 6: 2 tests)  
✅ T065-T068 PASS (Area 7: 3 tests)  
✅ T069-T072 PASS (Area 8: 3 tests)  
✅ **Total: 31 tests passing**  
✅ T073-T075 complete (validation report generated)

**Stage FAILS if ANY test fails or prerequisites incomplete**

---

## Post-Completion

After all tasks complete and all 31 tests PASS:

1. Generate audit report: `audits/VALIDATION_REPORT.md` (T075)
2. Create summary: 31/31 tests passed, 8/8 areas validated
3. Merge branch: `test-001-platform-foundation` → `main`
4. Update stage status: `STAGE_TEST_01_PLATFORM_FOUNDATION: PASSED`
5. Promote Phase 01 to: `PRODUCTION_READY`

---

## Test Summary Statistics

| Dimension                 | Value                      |
| ------------------------- | -------------------------- |
| Total Tasks               | 78                         |
| Setup Tasks               | 17                         |
| Test Implementation Tasks | 61                         |
| Total Test Scenarios      | 31                         |
| Test Areas                | 8                          |
| Unit Tests                | 12 (Areas 1,3,5)           |
| Integration Tests         | 12 (Areas 1,2,6,7)         |
| Static Tests              | 3 (Area 4)                 |
| Performance Tests         | 3 (Area 8)                 |
| Sequential Runtime        | ~65 minutes                |
| Parallel (CI) Runtime     | ~35 minutes                |
| Parallelizable Tasks      | 45+                        |
| Bottleneck                | Integration tests (30 min) |
