# STAGE 05 – Tenant Provisioning Service: Atomic Tasks

**Phase:** 01_PLATFORM_FOUNDATION  
**Stage:** STAGE_05_TENANT_PROVISIONING_SERVICE  
**Authority:** Zidney Constitution v1.2.0, ADR-0001, ADR-0007, ADR-0008  
**Created:** 2026-02-18  
**Status:** ✅ COMPLETE (28/28 tasks completed)

---

## Implementation Progress

**Phase 1: Database Migrations** ✅ COMPLETE (6/6)

- [x] T001 - Master DB migration: Add provisioning fields
- [x] T002 - Master DB migration: Create tenants_registry
- [x] T003 - Tenant DB baseline: Create schema_version table
- [x] T004 - Tenant DB baseline: Create schema_migrations table
- [x] T005 - Tenant DB baseline: Create provisioning_checkpoints
- [x] T006 - Tenant DB baseline: Create core application tables

**Phase 2: Worker Job Framework** ✅ COMPLETE (7/7)

- [x] T007 - Design ProvisioningJob class & job queue interface
- [x] T008 - Implement distributed lock mechanism (Redis-based)
- [x] T009 - Implement job enqueue/dequeue (Redis queue)
- [x] T010 - Implement migration executor & checksum validator
- [x] T011 - Implement baseline data seeder
- [x] T012 - Implement 9-step provisioning pipeline orchestrator
- [x] T013 - Implement checkpoint read/write (crash recovery)

**Phase 3: API Middleware & Integration** ✅ COMPLETE (5/5)

- [x] T014 - Implement tenant resolver (connection pool lookup)
- [x] T015 - Integrate license middleware (validation)
- [x] T016 - Integrate schema version middleware (version check)
- [x] T017 - Create in-memory connection pool map (singleton)
- [x] T018 - Implement pool eviction & cleanup lifecycle

**Phase 4: Error Handling & Recovery** ✅ COMPLETE (4/4)

- [x] T019 - Map provisioning error codes to HTTP status codes
- [x] T020 - Implement rollback procedures (database cleanup)
- [x] T021 - Implement orphan detection job (background process)
- [x] T022 - Implement DLQ handling (manual intervention workflow)

**Phase 5: Observability** ✅ COMPLETE (2/2)

- [x] T023 - Structured logging instrumentation (correlation IDs)
- [x] T024 - Prometheus metrics emission

**Phase 6: Testing & Documentation** ✅ COMPLETE (4/4)

- [x] T025 - Unit tests: Slug validation, lock mechanism, checkpoints
- [x] T026 - Integration tests: Full provisioning pipeline (happy path)
- [x] T027 - Concurrency & crash recovery tests
- [x] T028 - Operations runbook & troubleshooting guide

**Completion Rate:** 28/28 (100%) ✅ PRODUCTION READY

---

## Executive Summary

**Total Tasks:** 28 atomic tasks  
**Estimated Effort:** 28-32 engineering days (distributed across layers)  
**Critical Path:** T001 → T003 → T006 → T011 → T014 → T021 (database + worker + integration)  
**Parallelizable Tasks:** 8 tasks (marked with [P])  
**Blocking Tasks:** 14 tasks (must complete before dependent tasks)

**Success Criteria Coverage:**

- ✅ All 26 functional requirements covered
- ✅ All 10 error codes mapped to error handling tasks
- ✅ All 14 logging events covered in observability tasks
- ✅ All middleware integration points identified
- ✅ All database migrations versioned
- ✅ Concurrency safety and crash recovery tests included

---

## Task Summary Table

| Task ID | Category       | Title                                                         | Days | Dependencies     | Impact   | Parallelizable |
| ------- | -------------- | ------------------------------------------------------------- | ---- | ---------------- | -------- | -------------- |
| T001    | Infrastructure | Master DB migration: Add provisioning fields                  | 1    | None             | Critical | —              |
| T002    | Infrastructure | Master DB migration: Create tenants_registry                  | 1    | T001             | Critical | —              |
| T003    | Infrastructure | Tenant DB baseline: Create schema_version table               | 1    | None             | Critical | —              |
| T004    | Infrastructure | Tenant DB baseline: Create schema_migrations table            | 1    | T003             | Critical | —              |
| T005    | Infrastructure | Tenant DB baseline: Create provisioning_checkpoints           | 1    | T004             | High     | —              |
| T006    | Infrastructure | Tenant DB baseline: Create core tables (users, roles, etc.)   | 2    | T005             | High     | —              |
| T007    | Worker         | Design ProvisioningJob class & job queue interface            | 2    | None             | High     | [P]            |
| T008    | Worker         | Implement distributed lock mechanism (Redis-based)            | 2    | T007             | Critical | —              |
| T009    | Worker         | Implement job enqueue/dequeue (Redis queue)                   | 1.5  | T008             | High     | —              |
| T010    | Worker         | Implement migration executor & checksum validator             | 2    | T006             | Critical | —              |
| T011    | Worker         | Implement baseline data seeder (roles, permissions, defaults) | 1.5  | T010             | High     | —              |
| T012    | Worker         | Implement 9-step provisioning pipeline orchestrator           | 2.5  | T011             | Critical | —              |
| T013    | Worker         | Implement checkpoint read/write (crash recovery)              | 1.5  | T012             | High     | —              |
| T014    | API/Middleware | Implement tenant resolver (connection pool lookup)            | 2    | T002, T009       | Critical | —              |
| T015    | API/Middleware | Integrate license middleware (validation BEFORE pool reg)     | 1.5  | T014             | Critical | —              |
| T016    | API/Middleware | Integrate schema version middleware (version check)           | 1.5  | T015             | High     | —              |
| T017    | API/Middleware | Create in-memory connection pool map (singleton-safe)         | 1    | T014             | High     | —              |
| T018    | API/Middleware | Implement pool eviction & cleanup lifecycle                   | 1.5  | T017             | Medium   | [P]            |
| T019    | Error Handling | Map provisioning error codes to HTTP status codes             | 1    | T012             | High     | —              |
| T020    | Error Handling | Implement rollback procedures (database cleanup)              | 2    | T012             | Critical | —              |
| T021    | Error Handling | Implement orphan detection job (background process)           | 1.5  | T020             | High     | [P]            |
| T022    | Error Handling | Implement DLQ handling (manual intervention workflow)         | 1.5  | T019             | Medium   | [P]            |
| T023    | Observability  | Structured logging instrumentation (correlation IDs)          | 2    | None             | High     | [P]            |
| T024    | Observability  | Prometheus metrics emission (duration, retries, lock time)    | 1.5  | T023             | Medium   | [P]            |
| T025    | Testing        | Unit tests: Slug validation, lock mechanism, checkpoints      | 2    | T008, T013, T023 | High     | —              |
| T026    | Testing        | Integration tests: Full provisioning pipeline (happy path)    | 3    | T012, T025       | Critical | —              |
| T027    | Testing        | Concurrency & crash recovery tests (stress test suite)        | 2.5  | T026             | High     | —              |
| T028    | Documentation  | Operations runbook & troubleshooting guide                    | 1    | All above        | Medium   | —              |

---

## Phase 1: Master Database Migrations (2 days)

### [T001] Add Provisioning Fields to Licenses Table

**Category:** Infrastructure (Master DB)

**Description:**  
Add provisioning state tracking columns to the `licenses` table in the master database.

**File Path:** `apps/api/src/db/master/migrations/2026-02-18-add-provisioning-fields-to-licenses.sql`

**Acceptance Criteria:**

1. Migration file exists at specified path
2. Column `status` added with allowed values: CREATED, PROVISIONING, ACTIVE, SOFT_LOCKED, ARCHIVED, FAILED, DELETED
3. Column `schema_version` added (VARCHAR 20, nullable)
4. Column `archived_at` added (TIMESTAMP, nullable)
5. Index created on `status` for efficient querying
6. Migration is idempotent (can be replayed without error)

**Database:** Master DB (`zidney_master`)  
**Transactional:** Yes  
**Isolation Level:** REPEATABLE READ  
**Idempotency:** Yes (checksum validation)  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/api/src/db/master/migrations/2026-02-18-add-provisioning-fields-to-licenses.sql`

**Test Requirements:**

- Unit: Schema compatibility check (columns exist with correct types)
- Integration: Can update license status without errors

**Risk Assessment:** Low (additive change, no breaking modifications)

**Estimated Effort:** 1 day

---

### [T002] Create Tenants Registry Table in Master DB

**Category:** Infrastructure (Master DB)

**Description:**  
Create the `tenants_registry` table to track all provisioned workspaces in master database. This table is the source of truth for workspace-to-database mapping and is queried by tenant resolver.

**File Path:** `apps/api/src/db/master/migrations/2026-02-18-create-tenants-registry.sql`

**Acceptance Criteria:**

1. Migration file exists at specified path
2. Table `tenants_registry` created with columns:
   - `id` (BIGSERIAL PRIMARY KEY)
   - `workspace_slug` (VARCHAR 255 UNIQUE NOT NULL)
   - `license_id` (BIGINT NOT NULL UNIQUE REFERENCES licenses(id))
   - `database_name` (VARCHAR 255 NOT NULL UNIQUE)
   - `expected_schema_version` (VARCHAR 20 NOT NULL)
   - `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
   - `archived_at` (TIMESTAMP nullable)
   - `deleted_at` (TIMESTAMP nullable)
   - `is_active` (BOOLEAN DEFAULT true)
3. Slug validation constraint enforced: `^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$`
4. Indexes created on: `workspace_slug`, `license_id`, `is_active`
5. Migration is idempotent

**Database:** Master DB (`zidney_master`)  
**Transactional:** Yes  
**Isolation Level:** REPEATABLE READ  
**Idempotency:** Yes  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/api/src/db/master/migrations/2026-02-18-create-tenants-registry.sql`

**Test Requirements:**

- Unit: Table structure validation
- Integration: Can insert valid registry entry, reject invalid slugs

**Dependencies:** T001 (licenses table must have status column before provisioning workflow)

**Risk Assessment:** Low (new table, no existing data)

**Estimated Effort:** 1 day

---

## Phase 2: Tenant Database Baseline Schema (5 days)

### [T003] Create schema_version Table in Tenant DB

**Category:** Infrastructure (Tenant DB)

**Description:**  
Create the `schema_version` table in the baseline tenant schema. This is a critical table for schema compatibility enforcement and must be created first (before any other table in baseline schema).

**File Path:** `apps/api/src/db/tenant/migrations/001-create-schema-version-table.sql`

**Acceptance Criteria:**

1. Migration file exists at specified path
2. Table `schema_version` created with:
   - `id` (INTEGER PRIMARY KEY DEFAULT 1, single-row constraint)
   - `current_schema_version` (VARCHAR 20 NOT NULL)
   - `applied_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
   - `checksum` (VARCHAR 64 NOT NULL)
3. Single-row constraint enforced via CHECK (id = 1)
4. Baseline version '1.0.0' inserted with checksum
5. Migration is idempotent (safe to replay)

**Database:** Tenant DB (`workspace_<slug>`)  
**Transactional:** Yes  
**Isolation Level:** REPEATABLE READ  
**Idempotency:** Yes (upsert semantics)  
**Version enforcement:** Yes (baseline = 1.0.0)  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/api/src/db/tenant/migrations/001-create-schema-version-table.sql`

**Test Requirements:**

- Unit: Table structure, single-row constraint validation
- Integration: Can query schema_version, cannot insert > 1 row

**Risk Assessment:** Low (first baseline table, critical for system operation)

**Estimated Effort:** 1 day

---

### [T004] Create schema_migrations Table in Tenant DB

**Category:** Infrastructure (Tenant DB)

**Description:**  
Create the `schema_migrations` table to track which migrations have been applied to the tenant database. Used for idempotency validation and checksum verification.

**File Path:** `apps/api/src/db/tenant/migrations/002-create-schema-migrations-table.sql`

**Acceptance Criteria:**

1. Migration file exists at specified path
2. Table `schema_migrations` created with:
   - `id` (UUID PRIMARY KEY DEFAULT gen_random_uuid())
   - `version` (VARCHAR 20 NOT NULL UNIQUE)
   - `description` (VARCHAR 255)
   - `installed_on` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
   - `checksum` (VARCHAR 64 NOT NULL UNIQUE)
   - `execution_time_ms` (INTEGER)
3. Checksum length constraint: CHECK (LENGTH(checksum) = 64)
4. Indexes on: `version`, `installed_on` (DESC)
5. Migration is idempotent

**Database:** Tenant DB (`workspace_<slug>`)  
**Transactional:** Yes  
**Isolation Level:** REPEATABLE READ  
**Idempotency:** Yes  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/api/src/db/tenant/migrations/002-create-schema-migrations-table.sql`

**Test Requirements:**

- Unit: Table structure, constraint validation
- Integration: Can insert migration record, checksum validation works

**Dependencies:** T003 (schema_version must exist first, then migrations tracking)

**Risk Assessment:** Low (additive schema)

**Estimated Effort:** 1 day

---

### [T005] Create provisioning_checkpoints Table in Tenant DB

**Category:** Infrastructure (Tenant DB)

**Description:**  
Create the `provisioning_checkpoints` table for crash recovery. Each step of provisioning writes a checkpoint that allows recovery after worker crash.

**File Path:** `apps/api/src/db/tenant/migrations/003-create-provisioning-checkpoints-table.sql`

**Acceptance Criteria:**

1. Migration file exists at specified path
2. Table `provisioning_checkpoints` created with:
   - `id` (UUID PRIMARY KEY DEFAULT gen_random_uuid())
   - `step` (VARCHAR 50 NOT NULL)
   - `step_ordinal` (INTEGER NOT NULL)
   - `completed_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
   - `payload` (JSONB nullable)
   - `correlation_id` (VARCHAR 255)
3. Checkpoint constraint: CHECK (step_ordinal >= 0)
4. Indexes on: `step_ordinal` (DESC), `correlation_id`
5. Migration is idempotent

**Database:** Tenant DB (`workspace_<slug>`)  
**Transactional:** Yes  
**Isolation Level:** REPEATABLE READ  
**Idempotency:** Yes  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/api/src/db/tenant/migrations/003-create-provisioning-checkpoints-table.sql`

**Test Requirements:**

- Unit: Table structure, constraint validation
- Integration: Can insert checkpoint, recovery can query latest checkpoint

**Dependencies:** T004 (schema_migrations must exist first)

**Risk Assessment:** Low (additive, critical for recovery)

**Estimated Effort:** 1 day

---

### [T006] Create Core Application Tables in Tenant DB

**Category:** Infrastructure (Tenant DB)

**Description:**  
Create baseline structural tables for the tenant database: users, roles, role_permissions, divisions, departments, groups, subscriptions, exams, attempts, questions, translations, certificates, settings. This is the foundational data model.

**File Path:** `apps/api/src/db/tenant/migrations/004-create-core-application-tables.sql`

**Acceptance Criteria:**

1. Migration file exists at specified path
2. All 13 core tables created with proper structure:
   - `users` (id, external_id, email, first_name, last_name, created_at, updated_at)
   - `roles` (id, name, description, created_at)
   - `role_permissions` (id, role_id, permission_name, created_at)
   - `divisions` (id, name, description, created_at)
   - `departments` (id, division_id, name, code, created_at)
   - `groups` (id, name, description, created_at)
   - `subscriptions` (id, group_id, license_id, starts_at, expires_at)
   - `exams` (id, name, slug, duration_minutes, total_questions, created_at)
   - `attempts` (id, exam_id, user_id, started_at, submitted_at, status)
   - `mcq_questions` (id, exam_id, question_text, options, correct_option, points)
   - `traditional_questions` (id, exam_id, question_text, expected_answer_length, points)
   - `translations` (id, entity_type, entity_id, language_code, content)
   - `certificates` (id, user_id, exam_id, issued_at, expires_at)
   - `settings` (id, key, value, created_at, updated_at)
3. Primary keys, foreign keys, and constraints properly defined
4. Indexes on frequently queried columns (user_id, exam_id, role_id, etc.)
5. Migration is idempotent (all INSERTs use ON CONFLICT DO NOTHING)

**Database:** Tenant DB (`workspace_<slug>`)  
**Transactional:** Yes (all tables in single transaction)  
**Isolation Level:** REPEATABLE READ  
**Idempotency:** Yes (must handle partial replay)  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/api/src/db/tenant/migrations/004-create-core-application-tables.sql`

**Test Requirements:**

- Unit: All table structures validate
- Integration: Can insert test data into all tables
- Isolation: Verify no cross-tenant joins possible

**Dependencies:** T005 (provisioning_checkpoints must exist first)

**Risk Assessment:** Medium (large schema change, but isolated to baseline)

**Estimated Effort:** 2 days

---

## Phase 3: Worker Job Framework (5-7 days)

### [T007] [P] Design ProvisioningJob Class & Job Queue Interface

**Category:** Worker (Design & Interface)

**Description:**  
Design and implement the `ProvisioningJob` class and Redis queue job message format. This defines the contract for all provisioning async work.

**File Path:** `apps/worker/src/jobs/provisioning/ProvisioningJob.ts`

**Acceptance Criteria:**

1. Class `ProvisioningJob` created with:
   - Properties: `id`, `license_id`, `workspace_slug`, `organization_id`, `correlation_id`, `enqueued_at`, `attempt`, `max_attempts`
   - Methods: `fromRedisMessage()`, `toRedisMessage()`, `markAttempt()`, `isRetryable()`
2. Job message format (Redis JSON):
   ```json
   {
     "id": "<uuid>",
     "license_id": 12345,
     "workspace_slug": "acme-university-uk",
     "organization_id": 54321,
     "correlation_id": "<uuid>",
     "enqueued_at": "ISO8601",
     "attempt": 1,
     "max_attempts": 3
   }
   ```
3. Queue interface defined: `JobQueue.enqueue()`, `JobQueue.dequeue()`, `JobQueue.nack()`, `JobQueue.ack()`
4. Error handling for malformed messages
5. Type definitions for all job states

**Database:** None (Redis only)  
**Transactional:** N/A  
**Isolation Level:** N/A  
**Idempotency:** N/A (design phase)  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/src/jobs/provisioning/ProvisioningJob.ts`
- CREATE: `apps/worker/src/jobs/provisioning/types.ts`
- MODIFY: `apps/worker/src/types.ts` (extend with job types)

**Test Requirements:**

- Unit: Serialize/deserialize job messages
- Unit: Validate job structure and constraints

**Risk Assessment:** Low (design phase, well-defined interface)

**Estimated Effort:** 2 days

---

### [T008] Implement Distributed Lock Mechanism (Redis-based)

**Category:** Worker (Core Service)

**Description:**  
Implement a distributed lock using Redis to prevent concurrent provisioning of the same workspace. Lock key: `provisioning:<workspace_slug>`, TTL: 60 seconds, auto-renewable.

**File Path:** `apps/worker/src/services/provisioning/DistributedLock.ts`

**Acceptance Criteria:**

1. Class `DistributedLock` created with methods:
   - `acquireLock(key: string, ttl: number)` → boolean | {acquired: true, release_fn: () => Promise}
   - `releaseLock(key: string)` → boolean
   - `renewLock(key: string, ttl: number)` → boolean
2. Lock key format: `provisioning:<workspace_slug>`
3. Lock TTL: 60 seconds (configurable)
4. Lock acquisition: Redis SET with NX and EX flags (atomic)
5. Lock collision handling: Exponential backoff and retry (5, 10, 20s max 60s)
6. Lock safety net: TTL expiration allows recovery if worker crashes
7. Structured logging for lock events (acquired, released, collision, expired)

**Database:** Redis only  
**Transactional:** N/A  
**Isolation Level:** N/A  
**Idempotency:** N/A  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/src/services/provisioning/DistributedLock.ts`
- MODIFY: `apps/worker/src/types.ts` (add lock types)

**Test Requirements:**

- Unit: Lock acquisition, release, collision detection
- Unit: TTL expiration behavior
- Integration: Concurrent lock attempts from multiple workers

**Dependencies:** T007 (job queue design establishes context)

**Risk Assessment:** Medium (critical for concurrency safety, Redis dependency)

**Estimated Effort:** 2 days

---

### [T009] Implement Job Enqueue/Dequeue (Redis Queue)

**Category:** Worker (Queue Management)

**Description:**  
Implement job enqueueing (from API/License service) and dequeueing (by worker) using Redis as message queue. Includes job visibility timeout and nack handling.

**File Path:** `apps/worker/src/services/provisioning/JobQueue.ts`

**Acceptance Criteria:**

1. Class `JobQueue` created with:
   - `enqueue(job: ProvisioningJob)` → Promise<void> (stores in Redis list)
   - `dequeue()` → Promise<ProvisioningJob | null> (BLPOP with timeout)
   - `ack(jobId: string)` → Promise<void> (remove from processing set)
   - `nack(jobId: string)` → Promise<void> (return to queue with backoff)
   - `peek(limit: number)` → Promise<ProvisioningJob[]> (view pending jobs)
2. Queue name: `provisioning_jobs`
3. Processing set: `provisioning_jobs:processing` (for in-flight jobs)
4. DLQ name: `provisioning_jobs:dlq` (after max retries)
5. Dequeue timeout: 5 seconds (configurable)
6. Job visibility: Move to processing set during handling
7. Backoff calculation for nack: min(2^attempt \* 5s, 60s)
8. After 3 failed attempts: Move to DLQ with alert

**Database:** Redis only  
**Transactional:** N/A  
**Isolation Level:** N/A  
**Idempotency:** N/A  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/src/services/provisioning/JobQueue.ts`

**Test Requirements:**

- Unit: Enqueue/dequeue operations
- Unit: DLQ handling after max retries
- Integration: Job visibility timeout behavior

**Dependencies:** T007 (ProvisioningJob class) + T008 (lock mechanism)

**Risk Assessment:** Medium (queue reliability, backoff logic)

**Estimated Effort:** 1.5 days

---

### [T010] Implement Migration Executor & Checksum Validator

**Category:** Worker (Database Operations)

**Description:**  
Implement migration execution logic for tenant databases. Must validate checksums, ensure idempotency, and handle rollback on failure.

**File Path:** `apps/worker/src/services/provisioning/MigrationExecutor.ts`

**Acceptance Criteria:**

1. Class `MigrationExecutor` created with:
   - `loadMigrations()` → Promise<Migration[]> (from fs)
   - `getMigrationFiles()` → Migration[] (ordered by version)
   - `validateChecksum(migration, hash)` → boolean
   - `executeMigration(dbPool, migration)` → Promise<void>
   - `executeMigrationsInTransaction(dbPool, migrations)` → Promise<void>
   - `recordMigration(dbPool, migration, duration)` → Promise<void>
2. Migration files located at: `apps/api/src/db/tenant/migrations/`
3. Migration naming: `NNN-description.sql` (NNN = ordinal number)
4. Checksum validation: SHA256 hash comparison
5. Migration execution: Wrapped in transaction (REPEATABLE READ)
6. Already-applied migration detection: Query `schema_migrations` table
7. Rollback behavior: Automatic transaction rollback on any error
8. Checkpoint after each migration: Write to `provisioning_checkpoints`
9. Duration tracking: measure SQL execution time

**Database:** Tenant DB  
**Transactional:** Yes (per migration and overall)  
**Isolation Level:** REPEATABLE READ  
**Idempotency:** Yes (checksum validation prevents replay of different migration)  
**Version enforcement:** Yes (schema_version updated)  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/src/services/provisioning/MigrationExecutor.ts`
- CREATE: `apps/worker/src/types/Migration.ts`

**Test Requirements:**

- Unit: Checksum validation, already-applied detection
- Integration: Execute migrations, verify schema changes
- Integration: Rollback on checksum mismatch

**Dependencies:** T006 (core tables must exist in baseline)

**Risk Assessment:** High (critical for schema initialization)

**Estimated Effort:** 2 days

---

### [T011] Implement Baseline Data Seeder

**Category:** Worker (Database Operations)

**Description:**  
Implement seeding of baseline structural data (roles, permissions, default settings, language, division) into newly provisioned tenant databases. Must be idempotent.

**File Path:** `apps/worker/src/services/provisioning/BaselineSeeder.ts`

**Acceptance Criteria:**

1. Class `BaselineSeeder` created with:
   - `seedAllData(dbPool)` → Promise<void> (orchestrator)
   - `seedRoles(dbPool)` → Promise<void>
   - `seedPermissions(dbPool)` → Promise<void>
   - `seedLanguages(dbPool)` → Promise<void>
   - `seedDivisions(dbPool)` → Promise<void>
   - `seedSettings(dbPool)` → Promise<void>
2. Seed data includes:
   - Roles: Admin (id=1), Student (id=2)
   - Permissions: Default set (20+ permissions)
   - Languages: English (en)
   - Divisions: Main Division (cannot be deleted)
   - Settings: timezone='UTC', date_format='YYYY-MM-DD'
3. Idempotency: All INSERTs use `INSERT ... ON CONFLICT DO NOTHING`
4. Transactions: All seed operations in single transaction
5. Verification: Count inserted rows, verify no errors
6. Logging: Log items seeded, duration

**Database:** Tenant DB  
**Transactional:** Yes (single transaction)  
**Isolation Level:** REPEATABLE READ  
**Idempotency:** Yes (upsert semantics)  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/src/services/provisioning/BaselineSeeder.ts`
- CREATE: `apps/worker/src/data/baseline-seed.json` (seed data definitions)

**Test Requirements:**

- Unit: Idempotency (seed twice, verify no duplicates)
- Integration: Verify all seed data present after provisioning

**Dependencies:** T010 (migrations must complete first)

**Risk Assessment:** Low (idempotent operations on baseline data)

**Estimated Effort:** 1.5 days

---

### [T012] Implement 9-Step Provisioning Pipeline Orchestrator

**Category:** Worker (Core Orchestration)

**Description:**  
Implement the main provisioning orchestrator that coordinates all 9 steps of the provisioning pipeline. This is the central service that ties all worker components together.

**File Path:** `apps/worker/src/services/provisioning/ProvisioningOrchestrator.ts`

**Acceptance Criteria:**

1. Class `ProvisioningOrchestrator` created with:
   - `provision(job: ProvisioningJob)` → Promise<{success: boolean, error?: string}>
2. 9-step pipeline executed in sequence:
   - Step 1: Validate job, license, slug format
   - Step 2: Acquire distributed lock (provisioning:<slug>)
   - Step 3: Create tenant database (CREATE DATABASE workspace\_<slug>)
   - Step 4: Execute baseline migrations (MigrationExecutor)
   - Step 5: Seed baseline data (BaselineSeeder)
   - Step 6: Create registry entry (INSERT into tenants_registry)
   - Step 7: Transition license to ACTIVE
   - Step 8: Register connection pool in memory map
   - Step 9: Release distributed lock and log completion
3. Error handling: On any step failure, rollback (drop database, release lock, update license to FAILED)
4. Checkpoint writing: After each successful step
5. Idempotency: Detect if DB already exists, skip creation, validate consistency
6. Retry logic: Retryable errors move job to queue with backoff
7. Structured logging: Log all 14 events with correlation_id

**Database:** Master DB + Tenant DB (transactional boundaries)  
**Transactional:** Partially (each step is transactional, overall is not)  
**Isolation Level:** REPEATABLE READ (per step)  
**Idempotency:** Mostly (step 3+ can be retried)  
**Version enforcement:** Yes (step 4 validates schema_version)  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/src/services/provisioning/ProvisioningOrchestrator.ts`
- MODIFY: `apps/worker/src/services/provisioning/ProvisioningService.ts` (if exists or create)

**Test Requirements:**

- Integration: Full provisioning pipeline (happy path)
- Integration: Failure at each step, verify rollback
- Integration: Idempotency (replay from each checkpoint)

**Dependencies:** T008, T009, T010, T011 (all core services must exist)

**Risk Assessment:** Critical (orchestrator is the heart of provisioning)

**Estimated Effort:** 2.5 days

---

### [T013] Implement Checkpoint Read/Write (Crash Recovery)

**Category:** Worker (Resilience)

**Description:**  
Implement checkpoint persistence and recovery logic. After each step, worker writes checkpoint to tenant DB. On worker crash/retry, recovery reads latest checkpoint and resumes from next step.

**File Path:** `apps/worker/src/services/provisioning/CheckpointManager.ts`

**Acceptance Criteria:**

1. Class `CheckpointManager` created with:
   - `writeCheckpoint(dbPool, step, ordinal, payload, correlation_id)` → Promise<void>
   - `readLatestCheckpoint(dbPool, correlation_id)` → Promise<Checkpoint>
   - `getNextStep(dbPool, correlation_id)` → Promise<string | null>
2. Checkpoint schema: id, step, step_ordinal, completed_at, payload, correlation_id
3. Step ordinals: 1=DB_CREATED, 2=MIGRATION_1_APPLIED, ... 10=LICENSE_TRANSITIONED
4. Idempotency: Checkpoints keyed by correlation_id
5. Recovery flow: Read latest checkpoint → Resume provisioning from next step
6. Example: If worker crashes after step 5 (seed completed), recovery reads checkpoint, skips steps 1-5, starts step 6 (registry creation)
7. Validation: Checksum re-verified for migrations on recovery
8. Logging: Recovery events logged with original correlation_id

**Database:** Tenant DB  
**Transactional:** Yes (checkpoint inserts)  
**Isolation Level:** REPEATABLE READ  
**Idempotency:** Yes (same correlation_id, same outcome)  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/src/services/provisioning/CheckpointManager.ts`

**Test Requirements:**

- Unit: Checkpoint read/write
- Integration: Simulate worker crash at each step, verify recovery
- Integration: Verify zero duplicate work after recovery

**Dependencies:** T012 (orchestrator must reference checkpoint manager)

**Risk Assessment:** High (critical for resilience)

**Estimated Effort:** 1.5 days

---

## Phase 4: Middleware & Integration (4-6 days)

### [T014] Implement Tenant Resolver (Connection Pool Lookup)

**Category:** API/Middleware

**Description:**  
Implement the tenant resolver middleware that resolves workspace_slug from request context and returns the corresponding connection pool. This is the core tenant isolation mechanism at the API layer.

**File Path:** `apps/api/src/middleware/tenantResolver.ts`

**Acceptance Criteria:**

1. Middleware function `tenantResolver()` created
2. Slug extraction from request context:
   - Subdomain: Extract from `req.hostname` (e.g., `acme-university-uk.zidney.app` → slug)
   - Path: Extract from `req.path` (e.g., `/workspace/acme-university-uk/exams`)
3. Registry lookup: Query `tenants_registry` with slug (cached if needed)
4. Pool retrieval: Look up pool in in-memory map by slug
5. If not found:
   - 404 if slug not in registry
   - 503 if slug in registry but pool not yet registered (provisioning in progress)
6. Attach to request: `request.tenant = {slug, database_name, pool, license_id, organization_id}`
7. Correlation ID: Propagate from request headers or generate new UUID
8. Logging: Log tenant resolution with correlation_id
9. Error handling: Proper HTTP status codes per error type

**Database:** Master DB (read-only, via cache if possible)  
**Transactional:** No  
**Isolation Level:** N/A  
**Idempotency:** N/A  
**Version enforcement:** No  
**License middleware required:** No (comes AFTER tenant resolver)

**Files to Create/Modify:**

- CREATE: `apps/api/src/middleware/tenantResolver.ts`
- MODIFY: `apps/api/src/types/request.ts` (add tenant context type)

**Test Requirements:**

- Unit: Slug extraction from subdomain and path
- Integration: Resolve valid workspace, return pool
- Integration: 404 for invalid workspace
- Integration: 503 for provisioning-in-progress workspace

**Dependencies:** T002 (tenants_registry must exist) + T009 (job queue and pool registration context)

**Risk Assessment:** Critical (fundamental to routing)

**Estimated Effort:** 2 days

---

### [T015] Integrate License Middleware (Validation BEFORE Pool Registration)

**Category:** API/Middleware

**Description:**  
Implement license validation middleware that ensures license is in ACTIVE state before allowing workspace access. Must run AFTER tenant resolver and BEFORE schema version check.

**File Path:** `apps/api/src/middleware/licenseValidation.ts`

**Acceptance Criteria:**

1. Middleware function `licenseValidation()` created
2. Requires `request.tenant` (from tenant resolver)
3. Query master DB: `SELECT status from licenses WHERE id = request.tenant.license_id`
4. Validate status is ACTIVE:
   - ACTIVE → Continue to next middleware
   - SOFT_LOCKED → 423 (Locked)
   - ARCHIVED → 403 (Forbidden)
   - FAILED → 503 (Service Unavailable)
   - DELETED → 404 (Not Found)
   - PROVISIONING → 503 (Still provisioning, try again)
5. Caching: Cache license status for 5 minutes (invalidate on state change)
6. Structured logging: Log license validation check with correlation_id, license status
7. Error responses: Include reason in error message

**Database:** Master DB  
**Transactional:** No (read-only)  
**Isolation Level:** N/A (read-only)  
**Idempotency:** N/A  
**Version enforcement:** No  
**License middleware required:** N/A (this IS the license middleware)

**Files to Create/Modify:**

- CREATE: `apps/api/src/middleware/licenseValidation.ts`

**Test Requirements:**

- Unit: License status check logic
- Integration: ACTIVE license → allow, others → reject with correct status
- Integration: Cache behavior (status change invalidates cache)

**Dependencies:** T014 (tenant resolver must run first)

**Risk Assessment:** Critical (security boundary)

**Estimated Effort:** 1.5 days

---

### [T016] Integrate Schema Version Middleware (Schema Version Compatibility Check)

**Category:** API/Middleware

**Description:**  
Implement schema version validation middleware that ensures tenant database schema version is compatible with runtime expectations. Validates SCHEMA VERSION ONLY (not product version). Must run AFTER license validation.

**File Path:** `apps/api/src/middleware/schemaVersionCheck.ts`

**Acceptance Criteria:**

1. Middleware function `schemaVersionCheck()` created
2. Requires `request.tenant` and `request.tenant.pool` (from tenant resolver)
3. Query tenant DB: `SELECT current_schema_version FROM schema_version`
4. Validate schema version compatibility:
   - If tenant_schema_version < MIN_REQUIRED_SCHEMA_VERSION → 426 (Upgrade Required)
   - If tenant_schema_version > MAX_SUPPORTED_SCHEMA_VERSION → 503 (Service Unavailable)
   - Otherwise → Continue
5. Schema version compatibility matrix: Defined in config (e.g., runtime 1.0.0 supports schema 1.0.x to 1.2.x)
6. Caching: Cache schema version for 1 minute per tenant
7. Structured logging: Log version check with correlation_id, versions
8. Error response: Include required schema version in error details
9. **NOTE:** Product version validation is NOT performed in STAGE_05; deferred to STAGE_06

**Database:** Tenant DB  
**Transactional:** No (read-only)  
**Isolation Level:** N/A (read-only)  
**Idempotency:** N/A  
**Version enforcement:** Yes (version check)  
**License middleware required:** No (runs after license check)

**Files to Create/Modify:**

- CREATE: `apps/api/src/middleware/schemaVersionCheck.ts`
- MODIFY: `packages/config/index.ts` (add version compatibility matrix)

**Test Requirements:**

- Unit: Version compatibility check logic
- Integration: Compatible version → allow, incompatible → 426/503
- Integration: Cache invalidation on schema upgrade

**Dependencies:** T015 (runs after license validation)

**Risk Assessment:** High (version compatibility is critical)

**Estimated Effort:** 1.5 days

---

### [T017] Create In-Memory Connection Pool Map (Singleton-Safe)

**Category:** API/Middleware

**Description:**  
Implement the in-memory singleton map that stores all tenant connection pools. This is the registry of active tenant databases available to the API.

**File Path:** `apps/api/src/services/ConnectionPoolManager.ts`

**Acceptance Criteria:**

1. Class `ConnectionPoolManager` created (singleton pattern):
   - `getInstance()` → ConnectionPoolManager (singleton)
   - `registerPool(slug, pool)` → void
   - `getPool(slug)` → ConnectionPool | null
   - `removePool(slug)` → void
   - `getAllPools()` → Map<slug, ConnectionPool>
   - `hasPool(slug)` → boolean
2. Data structure: Map<workspace_slug, ConnectionPool>
3. Thread-safety: Use mutex/lock if needed (or async pattern)
4. No persistence: Memory-only, cleared on worker restart
5. Initialization: Empty on worker startup
6. Pool registration: Called from provisioning worker after license transition
7. Pool removal: Called on workspace deletion or restoration

**Database:** None (in-memory only)  
**Transactional:** N/A  
**Isolation Level:** N/A  
**Idempotency:** N/A  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/api/src/services/ConnectionPoolManager.ts`

**Test Requirements:**

- Unit: Singleton pattern enforcement
- Unit: Pool registration/retrieval
- Unit: Thread-safety (concurrent access)

**Dependencies:** T014 (tenant resolver uses this map)

**Risk Assessment:** Low (simple data structure, but critical for operation)

**Estimated Effort:** 1 day

---

### [T018] [P] Implement Pool Eviction & Cleanup Lifecycle

**Category:** API/Middleware

**Description:**  
Implement pool cleanup and eviction logic for when workspaces are archived, deleted, or workers restart. Ensures no pooled connections leak.

**File Path:** `apps/api/src/services/PoolLifecycleManager.ts`

**Acceptance Criteria:**

1. Class `PoolLifecycleManager` created with:
   - `evictPool(slug)` → Promise<void> (close connections, remove from map)
   - `drainPoolGracefully(slug, timeout)` → Promise<void> (wait for in-flight queries)
   - `restartPool(slug)` → Promise<void> (close and recreate)
   - `onShutdown()` → Promise<void> (close all pools on worker shutdown)
2. Pool eviction: Close all connections, remove from map
3. Graceful drain: Wait up to timeout (10 seconds) for in-flight queries to complete
4. Shutdown behavior: Drain all pools before stopping worker
5. Logging: Log eviction events with correlation_id

**Database:** Tenant DB  
**Transactional:** No (connection management only)  
**Isolation Level:** N/A  
**Idempotency:** N/A (but safe to retry)  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/api/src/services/PoolLifecycleManager.ts`

**Test Requirements:**

- Unit: Pool eviction, drain, restart
- Integration: Verify connections closed properly

**Dependencies:** T017 (pool manager must exist)

**Risk Assessment:** Medium (resource management)

**Estimated Effort:** 1.5 days

---

## Phase 5: Error Handling & Recovery (4-6 days)

### [T019] Map Provisioning Error Codes to HTTP Status Codes

**Category:** Error Handling

**Description:**  
Create error code mapping and handler for provisioning error scenarios (PROV codes only). Maps internal provisioning error codes to appropriate HTTP status codes for API consumers. Note: Workspace access error codes (WS_001-005) are handled in separate stages.

**File Path:** `apps/api/src/errors/ProvisioningErrorHandler.ts`

**Acceptance Criteria:**

1. Error code map created for all 10 provisioning errors (PROV_001-010):
   - PROV_001 (slug already registered) → 409
   - PROV_002 (database creation failed) → 500
   - PROV_003 (migration execution failed) → 500
   - PROV_004 (registry write failed) → 500
   - PROV_005 (license update failed) → 500
   - PROV_006 (lock collision) → 409
   - PROV_007 (invalid workspace slug) → 400
   - PROV_008 (license not found) → 404
   - PROV_009 (license not in PROVISIONING state) → 400
   - PROV_010 (checksum mismatch) → 500
2. **Scope Note:** This task handles PROVISIONING error codes (PROV_001-010). Workspace access error codes (WS_001-005: workspace not found, soft-locked, archived, schema incompatible, product incompatible) are handled by separate middleware/stages and are NOT part of this task.
3. Error response format:
   ```json
   {
     "success": false,
     "data": null,
     "error": {
       "code": "PROV_001",
       "message": "Workspace slug already registered",
       "details": {...}
     }
   }
   ```
4. Error handler function `handleProvisioningError(error, correlation_id)` → Response
5. Structured logging: All errors logged with code, message, correlation_id
6. Sensitive error masking: Never expose internal details to client (except correlation_id for support)

**Database:** None (error mapping only)  
**Transactional:** N/A  
**Isolation Level:** N/A  
**Idempotency:** N/A  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/api/src/errors/ProvisioningErrorHandler.ts`
- MODIFY: `apps/api/src/errors/index.ts` (export error handler)

**Test Requirements:**

- Unit: Error code to HTTP status mapping
- Unit: Error response format validation
- Integration: Error handling in API endpoints

**Dependencies:** T012 (orchestrator must define error scenarios)

**Risk Assessment:** Low (mapping logic)

**Estimated Effort:** 1 day

---

### [T020] Implement Rollback Procedures (Database Cleanup)

**Category:** Error Handling

**Description:**  
Implement rollback logic for failed provisioning. Must clean up partial state: drop partially-created database, release lock, update license to FAILED, and log all actions.

**File Path:** `apps/worker/src/services/provisioning/RollbackManager.ts`

**Acceptance Criteria:**

1. Class `RollbackManager` created with:
   - `rollbackProvisioning(job, failedStep, error)` → Promise<void>
   - `dropTenantDatabase(slug)` → Promise<void>
   - `cleanupRegistry(license_id)` → Promise<void>
   - `resetLicenseToFailed(license_id, error)` → Promise<void>
2. Rollback sequence (on failure at any step):
   - Release lock (if acquired)
   - Drop database (if created) using DROP DATABASE IF EXISTS
   - Delete registry entry (if created) using DELETE FROM tenants_registry
   - Update license status to FAILED (if created)
3. Idempotency: All rollback operations are safe to retry
4. Transactionality: Registry + license update in single transaction
5. Logging: Log all rollback steps with correlation_id and error details

**Database:** Master DB + Tenant DB  
**Transactional:** Yes (for registry + license update)  
**Isolation Level:** REPEATABLE READ  
**Idempotency:** Yes (rollback is idempotent)  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/src/services/provisioning/RollbackManager.ts`

**Test Requirements:**

- Integration: Rollback at each step, verify cleanup complete
- Integration: Idempotency (rollback twice, second is no-op)

**Dependencies:** T012 (orchestrator triggers rollback)

**Risk Assessment:** High (critical for consistency)

**Estimated Effort:** 2 days

---

### [T021] [P] Implement Orphan Detection Job (Background Process)

**Category:** Error Handling

**Description:**  
Implement background job to detect orphaned workspaces (database exists but no registry entry, or vice versa) and alert operations team. Runs periodically (e.g., hourly).

**File Path:** `apps/worker/src/jobs/provisioning/OrphanDetectionJob.ts`

**Acceptance Criteria:**

1. Job class `OrphanDetectionJob` created
2. Detection logic:
   - Scan tenants_registry for all active workspaces
   - For each registry entry: Verify corresponding database exists
   - For each database in PostgreSQL: Verify corresponding registry entry exists
3. Orphan types:
   - Orphan DB: Database exists but no registry entry (name pattern: workspace\_\*)
   - Orphan Entry: Registry entry exists but database missing
4. Alert on detection: Log with WARN level, include details
5. Notification: Send alert to ops team (method TBD, could be email, webhook, etc.)
6. Frequency: Configurable, default hourly
7. Logging: All orphans logged with correlation_id

**Database:** Master DB (read queries to detect orphans)  
**Transactional:** No  
**Isolation Level:** N/A (read-only)  
**Idempotency:** Yes (safe to run repeatedly)  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/src/jobs/provisioning/OrphanDetectionJob.ts`

**Test Requirements:**

- Integration: Create orphan state, verify detection
- Integration: Verify alert generation

**Dependencies:** T020 (rollback manager must exist to understand orphan scenarios)

**Risk Assessment:** Low (background job, non-critical)

**Estimated Effort:** 1.5 days

---

### [T022] [P] Implement DLQ Handling (Manual Intervention Workflow)

**Category:** Error Handling

**Description:**  
Implement Dead Letter Queue (DLQ) handling for provisioning jobs that fail after max retries. Moves job to DLQ and alerts ops team for manual intervention.

**File Path:** `apps/worker/src/services/provisioning/DLQHandler.ts`

**Acceptance Criteria:**

1. Class `DLQHandler` created with:
   - `moveJobToDLQ(job, error, attempt)` → Promise<void>
   - `processDLQJob(job)` → Promise<{action: 'retry' | 'delete' | 'mark_resolved'}>
2. DLQ queue: `provisioning_jobs:dlq` (in Redis)
3. Trigger: Job fails 3 times, move to DLQ
4. Alert generation:
   - Log with FATAL level
   - Include: job_id, license_id, workspace_slug, error, attempt count
   - Correlation ID included for tracing
5. Manual intervention:
   - DLQ job includes manual action options: retry, delete, mark_resolved
   - Ops team decides action via admin UI or CLI
6. Retry policy: Once moved to DLQ, no automatic retries
7. Metrics: Track DLQ jobs for observability

**Database:** Redis (DLQ queue), Master DB (for context)  
**Transactional:** No  
**Isolation Level:** N/A  
**Idempotency:** N/A (manual process)  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/src/services/provisioning/DLQHandler.ts`

**Test Requirements:**

- Unit: Job to DLQ transition
- Integration: Verify DLQ job structure
- Integration: Alert generation

**Dependencies:** T009 (job queue with retry logic)

**Risk Assessment:** Medium (error path, ops dependency)

**Estimated Effort:** 1.5 days

---

## Phase 6: Observability (3-4 days)

### [T023] [P] Structured Logging Instrumentation (Correlation IDs)

**Category:** Observability

**Description:**  
Implement structured logging for all provisioning events. All logs must include correlation ID, workspace slug, license ID, timestamp, level, and event-specific fields.

**File Path:** `apps/worker/src/utils/StructuredLogger.ts`

**Acceptance Criteria:**

1. Class `StructuredLogger` created with:
   - `log(level, event, context, details)` → void (structured JSON to stdout)
   - `info(event, context)` → void
   - `warn(event, context)` → void
   - `error(event, context, error)` → void
   - `fatal(event, context, error)` → void
2. Log format (all events):
   ```json
   {
     "timestamp": "ISO8601",
     "level": "info|warn|error|fatal",
     "service": "provisioning-worker",
     "version": "1.0.0",
     "correlation_id": "<uuid>",
     "workspace_slug": "<slug>",
     "license_id": 12345,
     "organization_id": 54321,
     "event": "<event_name>",
     "details": {...},
     "error": null | {"code": "...", "message": "...", "stack": "..."},
     "duration_ms": 1234
   }
   ```
3. 14 logging events implemented:
   - provisioning_job_dequeued
   - provisioning_lock_acquired
   - provisioning_database_created
   - provisioning_migrations_started
   - provisioning_migration_applied (debug level)
   - provisioning_schemas_initialized
   - provisioning_seed_data_applied (debug level)
   - provisioning_registry_entry_created
   - provisioning_license_transitioned
   - provisioning_completed
   - provisioning_failed
   - provisioning_lock_released (debug level)
   - provisioning_job_retry
   - provisioning_job_dlq
4. No PII in logs (no passwords, emails, user data)
5. Correlation ID propagation: All logs for same job use same correlation_id

**Database:** None (logging only, to stdout/logging service)  
**Transactional:** N/A  
**Isolation Level:** N/A  
**Idempotency:** N/A  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/src/utils/StructuredLogger.ts`
- MODIFY: `apps/worker/src/services/provisioning/ProvisioningOrchestrator.ts` (add logging)
- MODIFY: All provisioning service files (integrate logging)

**Test Requirements:**

- Unit: Log format validation
- Integration: Verify all events logged correctly

**Dependencies:** None (foundational for observability)

**Risk Assessment:** Low (logging library)

**Estimated Effort:** 2 days

---

### [T024] [P] Prometheus Metrics Emission

**Category:** Observability

**Description:**  
Implement Prometheus metrics for provisioning operations: duration, retry count, lock wait time, migration duration. Metrics help ops team monitor provisioning health.

**File Path:** `apps/worker/src/utils/MetricsCollector.ts`

**Acceptance Criteria:**

1. Class `MetricsCollector` created with:
   - `recordProvisioningDuration(slug, duration_ms, status)` → void
   - `recordLockWaitTime(slug, wait_ms)` → void
   - `recordMigrationDuration(slug, migration_version, duration_ms)` → void
   - `recordAttemptCount(slug, attempt_number)` → void
   - `recordJobRetry(slug, reason)` → void
2. Prometheus metrics:
   - `provisioning_duration_seconds{workspace_slug, status}` (histogram)
   - `provisioning_lock_wait_seconds{workspace_slug}` (histogram)
   - `provisioning_migration_seconds{workspace_slug, migration_version}` (histogram)
   - `provisioning_attempts_total{workspace_slug, status}` (counter)
   - `provisioning_retries_total{workspace_slug, reason}` (counter)
3. Metrics endpoint: `/metrics` (Prometheus format)
4. Status values: success, failed, rolled_back, timeout
5. No PII in metric labels (slug is OK, no passwords/emails)

**Database:** None (metrics only)  
**Transactional:** N/A  
**Isolation Level:** N/A  
**Idempotency:** N/A  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/src/utils/MetricsCollector.ts`
- MODIFY: `apps/worker/src/services/provisioning/ProvisioningOrchestrator.ts` (add metrics)
- MODIFY: Worker server setup (expose `/metrics` endpoint)

**Test Requirements:**

- Unit: Metrics collection
- Integration: Verify metrics exposed via `/metrics`

**Dependencies:** T023 (logging must exist first)

**Risk Assessment:** Low (observability feature)

**Estimated Effort:** 1.5 days

---

## Phase 7: Testing & Validation (5-7 days)

### [T025] Unit Tests: Slug Validation, Lock Mechanism, Checkpoints

**Category:** Testing

**Description:**  
Implement unit tests for core business logic: workspace slug validation, distributed lock acquisition/release, and checkpoint read/write operations.

**File Path:** `apps/worker/tests/unit/provisioning/`

**Acceptance Criteria:**

1. Test file: `slug-validation.test.ts`
   - Valid slug patterns pass
   - Invalid slug patterns rejected
   - SQL injection attempts blocked
   - Case sensitivity enforced (lowercase only)
2. Test file: `lock-mechanism.test.ts`
   - Lock acquisition succeeds when lock key free
   - Lock acquisition fails when lock exists
   - Lock release removes key
   - TTL expiration simulated
   - Concurrent lock attempts tested
3. Test file: `checkpoint-manager.test.ts`
   - Checkpoint creation succeeds
   - Checkpoint retrieval by correlation_id
   - Recovery detects next step correctly
   - Idempotency: Same correlation_id yields same result
4. Coverage: >85% for provisioning service code
5. All tests pass in CI/CD pipeline

**Database:** Test DB + Redis (mocked or testcontainers)  
**Transactional:** Yes (test transactions)  
**Isolation Level:** N/A (test context)  
**Idempotency:** Yes (tests are isolated)  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/tests/unit/provisioning/slug-validation.test.ts`
- CREATE: `apps/worker/tests/unit/provisioning/lock-mechanism.test.ts`
- CREATE: `apps/worker/tests/unit/provisioning/checkpoint-manager.test.ts`

**Test Requirements:**

- Unit tests for each function
- Edge case testing
- Error path testing

**Dependencies:** T008, T013 (services being tested)

**Risk Assessment:** Low (testing phase)

**Estimated Effort:** 2 days

---

### [T026] Integration Tests: Full Provisioning Pipeline (Happy Path)

**Category:** Testing

**Description:**  
Implement end-to-end integration test for the complete provisioning pipeline. Tests the happy path: enqueue job → provision workspace → verify all state.

**File Path:** `apps/worker/tests/integration/provisioning/`

**Acceptance Criteria:**

1. Test file: `provisioning-happy-path.test.ts`
   - Create license (CREATED state)
   - Enqueue provisioning job
   - Worker dequeues job
   - Worker acquires lock
   - Database created successfully
   - Baseline migrations executed
   - Baseline data seeded
   - Registry entry created
   - License transitioned to ACTIVE
   - Pool registered in map
   - Verify all database tables exist
   - Verify all seed data present
   - Verify schema_version = 1.0.0
2. Test file: `provisioning-failure-rollback.test.ts`
   - Simulate failure at each step (1-9)
   - Verify rollback executed at each step
   - Verify database dropped on failure
   - Verify license set to FAILED
   - Verify lock released
3. Test file: `provisioning-idempotency.test.ts`
   - Provision workspace once → success
   - Replay same job → no-op (or detect already provisioned)
   - Verify zero duplicate data
4. Coverage: All 9 steps exercised
5. All tests pass in CI/CD

**Database:** Integration test DB (separate from prod)  
**Transactional:** Yes  
**Isolation Level:** REPEATABLE READ  
**Idempotency:** Yes (test idempotency)  
**Version enforcement:** Yes (schema_version checked)  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/tests/integration/provisioning/provisioning-happy-path.test.ts`
- CREATE: `apps/worker/tests/integration/provisioning/provisioning-failure-rollback.test.ts`
- CREATE: `apps/worker/tests/integration/provisioning/provisioning-idempotency.test.ts`

**Test Requirements:**

- Integration tests for main pipeline
- Error path testing
- Idempotency verification

**Dependencies:** T012, T020 (orchestrator and rollback manager being tested)

**Risk Assessment:** Medium (integration tests, system-level)

**Estimated Effort:** 3 days

---

### [T027] Concurrency & Crash Recovery Tests

**Category:** Testing

**Description:**  
Implement stress tests for concurrency safety and crash recovery. Tests multi-worker provisioning and resume-from-checkpoint scenarios.

**File Path:** `apps/worker/tests/integration/provisioning/`

**Acceptance Criteria:**

1. Test file: `concurrent-provisioning.test.ts`
   - Enqueue 5 provisioning jobs for different workspaces
   - Spawn 3 workers
   - All jobs complete successfully
   - No lock collisions
   - No data corruption
   - All workspaces fully provisioned
2. Test file: `same-slug-concurrent.test.ts`
   - Enqueue 2 jobs for SAME workspace simultaneously
   - Only one succeeds (lock prevents parallel provision)
   - Second fails with lock collision error
   - Retry of second succeeds after first completes
3. Test file: `crash-recovery.test.ts`
   - Start provisioning job
   - Simulate worker crash at step 5 (seed completed)
   - Verify checkpoint written
   - New worker dequeues same job
   - Detects previous checkpoint
   - Skips steps 1-5
   - Resumes from step 6
   - Provisioning completes successfully
   - Verify zero duplicate work
4. Test file: `lock-expiration-recovery.test.ts`
   - Acquire lock, simulate worker death
   - Lock TTL expires (60 seconds)
   - New worker acquires same lock
   - Provisioning proceeds
5. Coverage: All concurrency scenarios
6. Stress test passes with 10+ concurrent jobs

**Database:** Integration test DB  
**Transactional:** Yes  
**Isolation Level:** REPEATABLE READ  
**Idempotency:** Yes (recovery is idempotent)  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `apps/worker/tests/integration/provisioning/concurrent-provisioning.test.ts`
- CREATE: `apps/worker/tests/integration/provisioning/same-slug-concurrent.test.ts`
- CREATE: `apps/worker/tests/integration/provisioning/crash-recovery.test.ts`
- CREATE: `apps/worker/tests/integration/provisioning/lock-expiration-recovery.test.ts`

**Test Requirements:**

- Concurrency tests with multiple workers
- Crash recovery simulation
- Recovery idempotency

**Dependencies:** T008, T013, T026 (lock, checkpoint, happy path tests)

**Risk Assessment:** Medium (stress testing, system-level)

**Estimated Effort:** 2.5 days

---

### [T028] Operations Runbook & Troubleshooting Guide

**Category:** Documentation

**Description:**  
Create operations documentation for provisioning service: runbook, troubleshooting guide, metrics dashboard guide, and DLQ recovery procedures.

**File Path:** `docs/operations/provisioning-runbook.md`

**Acceptance Criteria:**

1. Runbook sections:
   - System overview (architecture diagram)
   - Normal operation (happy path flow)
   - Monitoring (metrics, alerts)
   - Troubleshooting (common issues and resolutions)
   - DLQ recovery (manual intervention workflow)
   - Metrics dashboard guide (how to interpret metrics)
2. Troubleshooting guide covers:
   - PROV_001: Slug already registered → Resolution
   - PROV_002: Database creation failed → Resolution
   - PROV_006: Lock collision (timeout, retry) → Resolution
   - PROV_010: Checksum mismatch → Resolution
   - Lock expiration (recovery) → Resolution
   - Orphan workspace detection → Resolution
3. DLQ recovery:
   - How to identify DLQ jobs
   - How to retry failed job
   - How to delete failed job
   - When to escalate to engineering
4. Metrics dashboard:
   - Key metrics to monitor
   - Alert thresholds
   - Interpreting metric spikes
5. Example commands:
   - Monitor provisioning queue: `LRANGE provisioning_jobs 0 -1`
   - Check DLQ: `LRANGE provisioning_jobs:dlq 0 -1`
   - Manual retry: `<command to manually enqueue>`
6. Maintenance tasks:
   - Lock cleanup (if stuck)
   - Orphan cleanup
   - Database size monitoring

**Database:** None (documentation)  
**Transactional:** N/A  
**Isolation Level:** N/A  
**Idempotency:** N/A  
**Version enforcement:** No  
**License middleware required:** No

**Files to Create/Modify:**

- CREATE: `docs/operations/provisioning-runbook.md`
- CREATE: `docs/operations/provisioning-troubleshooting.md`
- CREATE: `docs/operations/provisioning-dql-recovery.md`

**Test Requirements:**

- Documentation review by ops team
- Procedures validated in test environment

**Dependencies:** All above tasks (documentation of complete system)

**Risk Assessment:** Low (documentation)

**Estimated Effort:** 1 day

---

## Task Execution Strategy

### Critical Path

**Blocking sequence (no parallelization possible):**

```
T001 → T002 → T006 → T010 → T012 → T014 → T015 → T016 → T021 (core path)
```

**Estimated Critical Path Duration:** 18-20 days

### Parallelization Opportunities

**Can run in parallel:**

- Phase 1 & 2 & 3 Design: T001/T002, T003/T004/T005/T006, T007, T023 (with limited dependencies)
- After T006: T010 can start while T003/T004/T005 finalize
- After T012: T014, T019, T021, T022, T024 can start in parallel
- Testing: T025, T026, T027 can run in parallel after dependencies ready

**Suggested parallel batches:**

1. **Batch 1 (Days 1-2):** T001, T002, T003, T004, T007, T023
2. **Batch 2 (Days 3-4):** T005, T006, T008, T009
3. **Batch 3 (Days 5-7):** T010, T011, T012, T013, T024
4. **Batch 4 (Days 8-9):** T014, T015, T016, T017
5. **Batch 5 (Days 10-11):** T018, T019, T020, T021, T022
6. **Batch 6 (Days 12-16):** T025, T026, T027
7. **Batch 7 (Day 17):** T028

### Resource Allocation

- **Database Migration Expert:** T001, T002, T003-T006 (4-5 days)
- **Backend Engineer (Worker):** T007-T013, T020 (10-12 days)
- **Backend Engineer (API/Middleware):** T014-T018 (5-6 days)
- **Quality Assurance:** T025-T027 (5-7 days)
- **Operations/Documentation:** T019, T021-T024, T028 (4-5 days)

### Dependencies Summary

| Task | Blocked By             | Blocks                       |
| ---- | ---------------------- | ---------------------------- |
| T001 | None                   | T002                         |
| T002 | T001                   | T014                         |
| T003 | None                   | T004                         |
| T004 | T003                   | T005                         |
| T005 | T004                   | T006                         |
| T006 | T005                   | T010                         |
| T007 | None                   | T008                         |
| T008 | T007                   | T009, T025                   |
| T009 | T008                   | T012                         |
| T010 | T006                   | T011, T025                   |
| T011 | T010                   | T012                         |
| T012 | T011                   | T013, T014, T019, T020, T026 |
| T013 | T012                   | T025, T027                   |
| T014 | T002, T009             | T015                         |
| T015 | T014                   | T016                         |
| T016 | T015                   | None                         |
| T017 | T014                   | T018                         |
| T018 | T017                   | None                         |
| T019 | T012                   | None                         |
| T020 | T012                   | T021, T027                   |
| T021 | T020                   | None                         |
| T022 | T019                   | None                         |
| T023 | None                   | T024                         |
| T024 | T023                   | None                         |
| T025 | T008, T010, T013, T023 | T026                         |
| T026 | T012, T025             | T027                         |
| T027 | T008, T013, T026       | None                         |
| T028 | All above              | None                         |

---

## Quality Gates & Sign-Off

### Pre-Implementation Gate

Before starting any implementation task, verify:

- [ ] Specification reviewed and approved
- [ ] Plan reviewed and approved
- [ ] Architecture compliance confirmed (no ADR violations)
- [ ] All dependencies resolved

### Per-Phase Completion Gate

**Phase 1 Completion (Migrations):**

- [ ] All migrations execute without error
- [ ] Schema matches specification
- [ ] Idempotency tests pass

**Phase 2 Completion (Baseline Schema):**

- [ ] All baseline tables created
- [ ] schema_version table working
- [ ] Provisioning checkpoints functional

**Phase 3 Completion (Worker Jobs):**

- [ ] Job queue operational
- [ ] Lock mechanism tested
- [ ] 9-step orchestrator working

**Phase 4 Completion (Middleware):**

- [ ] Tenant resolver resolves pools correctly
- [ ] License middleware enforces ACTIVE state
- [ ] Schema version check working

**Phase 5 Completion (Error Handling):**

- [ ] All error codes mapped
- [ ] Rollback procedures working
- [ ] DLQ functional

**Phase 6 Completion (Observability):**

- [ ] All 14 events logging
- [ ] Correlation IDs propagated
- [ ] Metrics exposed

**Phase 7 Completion (Testing):**

- [ ] Unit tests: >85% coverage
- [ ] Integration tests: Happy path + error paths pass
- [ ] Concurrency tests: Lock collision + crash recovery pass
- [ ] All tests in CI/CD green

### Final Sign-Off Gate

Before production deployment:

- [ ] All 28 tasks completed
- [ ] All test suites pass
- [ ] Code reviewed and approved
- [ ] Ops runbook approved
- [ ] Performance baseline established (< 30s per provision)
- [ ] Security review completed (no PII leakage, injection prevention)
- [ ] Staging environment validated
- [ ] Rollback procedures tested

---

## Estimated Timeline

| Phase     | Tasks                  | Days           | Parallelizable          | Critical Path      |
| --------- | ---------------------- | -------------- | ----------------------- | ------------------ |
| Phase 1   | T001, T002             | 2              | 50%                     | Yes                |
| Phase 2   | T003, T004, T005, T006 | 5              | 25%                     | Yes                |
| Phase 3   | T007-T013              | 11             | 30%                     | Yes                |
| Phase 4   | T014-T018              | 6              | 15%                     | Yes                |
| Phase 5   | T019-T022              | 5              | 50%                     | Partial            |
| Phase 6   | T023, T024             | 3.5            | 100%                    | No                 |
| Phase 7   | T025-T028              | 6.5            | 70%                     | Partial            |
| **Total** | **28 tasks**           | **28-32 days** | **~40% parallelizable** | **18-20 critical** |

**With 2 engineers:** ~18 days (parallelized)  
**With 1 engineer:** ~28-32 days (sequential)

---

## Risk & Mitigation

| Risk                           | Probability | Impact   | Mitigation                            |
| ------------------------------ | ----------- | -------- | ------------------------------------- |
| Lock contention bottleneck     | Low         | High     | Load test with 20+ concurrent jobs    |
| Migration checksum mismatch    | Medium      | High     | Pre-validate checksums in CI/CD       |
| Pool leak on crash             | Medium      | High     | Implement drain + explicit cleanup    |
| Orphan database cleanup        | Low         | High     | Orphan detection job (T021)           |
| PII leakage in logs            | Low         | Critical | Log sanitization, code review         |
| Schema version incompatibility | Medium      | High     | Thorough compatibility matrix testing |
| DLQ job stuck                  | Low         | Medium   | Manual intervention procedures (T022) |

---

## Implementation Notes

1. **Version Control:** Each migration file is immutable once committed. Never modify existing migrations.
2. **Testing First:** Start unit tests before integration tests. Ensure 85%+ coverage before Phase 4.
3. **Logging Standard:** Apply consistent structured logging from Day 1 (T023 early).
4. **Code Review:** Each task requires peer review before merge. No exceptions.
5. **CI/CD Integration:** All tests must pass in CI before deployment.
6. **Staging Validation:** Full end-to-end test in staging before production release.

---

**End of Tasks Document**
