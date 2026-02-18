# STAGE 05 – Tenant Provisioning Service: Comprehensive Feature Specification

**Phase:** 01_PLATFORM_FOUNDATION  
**Stage:** STAGE_05_TENANT_PROVISIONING_SERVICE  
**Status:** IN PROGRESS  
**Authority:** Zidney Constitution v1.2.0, ADR-0001, ADR-0002, ADR-0007, ADR-0008  
**Last Updated:** 2026-02-18

---

## 1. Feature Overview

### 1.1 Purpose

The Tenant Provisioning Service is the foundational, non-public internal service responsible for establishing the complete database-per-tenant isolation model at the physical infrastructure level. It automates the lifecycle of tenant workspace databases—creation, initialization, archiving, restoration, and permanent deletion—while guaranteeing:

- **Isolation Integrity:** Each tenant database is fully isolated with no cross-tenant access
- **Deterministic State:** Provisioning is idempotent and transactionally safe
- **Operational Stability:** No orphan databases, no partial migrations, no inconsistent registries
- **Auditability:** All provisioning events are structured-logged with correlation IDs

### 1.2 Architectural Position

**Trust Chain Position:** Isolation → License → Authentication → Attempt → Runtime → Frontoffice

This service operates at the **Isolation layer**, the foundational trust boundary. It establishes the physical database boundary that all subsequent authentication, licensing, runtime, and frontoffice operations depend upon.

**Phase Dependency:**

- Requires: STAGE_02_MULTI_TENANCY_ARCHITECTURE, STAGE_02C_MIGRATION_AND_VERSIONING_MODEL, STAGE_04_LICENSE_ENGINE
- Enables: STAGE_06_ATTEMPT_ENGINE_FOUNDATION, all tenant-bound operations

### 1.3 Scope

**Included:**

- Asynchronous provisioning via job queue (no synchronous DB creation during API requests)
- Distributed lock-based concurrency safety
- Baseline tenant schema initialization
- Baseline structural data seeding
- Registry entry creation and tracking
- Archive snapshot management
- Restoration from snapshot
- Permanent deletion
- Idempotency and recovery mechanisms
- Structured logging and tracing
- Integrity verification for operationally critical state

**Out of Scope:**

- Public HTTP endpoints for provisioning (internal only)
- Application-level data seeding beyond structural baseline
- Data migration beyond baseline schema
- Audit log storage (logged, not persisted in this stage)
- Backup storage infrastructure (snapshot locations assumed to exist)

---

## 2. Constitutional Compliance Declaration

### 2.1 Mandatory Alignment Confirmation

✅ **No cross-tenant access:** All databases accessed exclusively through tenant-specific connection pools resolved from provenance.  
✅ **No middleware bypass:** License and tenant validation required before any workspace operation.  
✅ **No grading outside worker:** Provisioning logic executes exclusively in worker, not API.  
✅ **No direct DB instantiation:** All connections obtained through tenant resolver context or provisioning service.  
✅ **No snapshot integrity weakening:** Configuration snapshots immutable post-provisioning (handled in STAGE_06).  
✅ **No transaction boundary weakening:** Provisioning atomic at system level.  
✅ **No version enforcement weakening:** Schema version compatibility enforced at middleware (STAGE_02C, STAGE_04).

### 2.2 Architecture Boundary Preservation

- **Database-per-Tenant Isolation (ADR-0001):** Preserved. Each workspace gets distinct database with full schema isolation.
- **Worker Authority (PROJECT_CONTEXT_PRIMER):** Preserved. Provisioning executes in worker process only, never API.
- **Semantic Versioning (ADR-0008):** Preserved. Schema version tracked and validated per tenant.
- **License Enforcement (ADR-0007):** Preserved. License middleware validates before workspace access.

✅ **No ADR conflicts detected.**

---

## Clarifications Session — 2026-02-18

### Overview

This section documents all critical ambiguities resolved during clarification phase. Five questions were addressed, each with implementation implications for the provisioning architecture. All questions are fully resolved and have been integrated into subsequent specification sections.

---

### Q1: PostgreSQL Isolation Level — Resolved ✅

**Question:** Should tenant databases operate at specific isolation levels to prevent concurrent modification conflicts?

**Answer:** REPEATABLE READ

**Reasoning:**

- Provides protection against dirty reads and non-repeatable reads
- Adequate safety for transactional provisioning without SERIALIZABLE contention overhead
- Prevents race conditions during concurrent schema modifications
- Aligns with standard OLTP workloads in exam systems
- Platform standard for all tenant databases ensures consistency across all workspaces

**Implementation Impact:**

- Add `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;` to baseline migration file
- All schema_migrations table writes execute within REPEATABLE READ context
- Tenant connection pool initialized with isolation level enforcer
- Configuration documented in tenant `schema_version` table metadata for auditing
- Connection string includes isolation level parameter passed to pool initialization

---

### Q2: Connection Pool Registration Timing — Resolved ✅

**Question:** Should tenant connection pools be registered into the in-memory map before or after schema initialization completes?

**Answer:** After baseline schema completes

**Reasoning:**

- Prevents premature application queries against incomplete schema
- Ensures schema_version table exists before any application metadata writes
- Reduces risk of partition tolerance issues during concurrent migrations
- Matches container startup safety model (schema-first, then routes-active)
- Aligns with health check dependencies and service readiness signals

**Implementation Impact:**

- Provisioning flow: Create DB → Run migrations → Seed baseline data → Verify schema_version table exists → THEN register pool in map
- Pool availability becomes explicit signal: "Database is ready for application use"
- Tenant resolver returns 503 Service Unavailable if pool not yet registered (provisioning window)
- Integration test: Verify pool registration cannot race with first application request
- Deployment readiness: Health checks only pass after schema_version is queryable

---

### Q3: Credential Storage Strategy — Resolved ✅

**Question:** How should tenant database credentials be stored and accessed during provisioning?

**Answer:** Docker Secrets (Production) + Environment Variables (Development)

**Reasoning:**

- Production: Docker Secrets prevent credential rotation breaking running containers mid-provisioning
- Development: Environment variables enable local testing without secrets infrastructure complexity
- Credentials never logged or exposed to frontend or client
- Provisioning service account credentials stored once at startup (immutable for session duration)
- Tenant account credentials generated per workspace and managed independently

**Implementation Impact:**

- Provisioning service loads credentials from PROVISIONING_DB_USER / PROVISIONING_DB_PASSWORD environment at startup
- Per-tenant credentials created transactionally during provisioning, stored in secrets manager externally (not in DB)
- Worker container runs with secrets volume mounted: `/run/secrets/provisioning_db_password`
- Dev environment: `.env` file with unencrypted credentials for local testing
- Credential injection: Never from request body (security boundary preserved)
- Credential rotation procedure: Update Docker secrets → Drain existing workers → Restart workers with new secrets
- Audit: Log credential access events (not content) with correlation_id for security tracking

---

### Q4: License Middleware Execution Order — Resolved ✅

**Question:** Should license validation occur before or after pool registration?

**Answer:** BEFORE pool registration

**Reasoning:**

- License state is source of truth for workspace authorization
- Prevents provisioning of unlicensed workspaces
- License middleware order consistent for all subsequent API requests (predictability)
- Worker already validates license before provisioning starts (no bypassing)
- Ensures atomicity: License valid → Pool registered → API requests proceed
- Aligns with trust chain priority: Isolation → License → Authentication → Runtime

**Implementation Impact:**

- Provisioning worker: Check license_id exists and status is CREATED/PROVISIONING before any DB operations
- Pool registration: Occurs only after license status transitioned to ACTIVE (transactional)
- API requests: License middleware validates before tenant resolver runs (strict ordering)
- Middleware stack: License check → Tenant resolution → Schema version check → Route handler
- Example flow: License created → Job queued → Worker validates license → Provision → License→ACTIVE → Pool registered → API requests allowed
- Validation: Attempt API call to non-licensed workspace returns 404 (license not found) or 423 (soft-locked)
- Guard rail: Cannot register pool if license is not ACTIVE (enforced in provisioning code)

---

### Q5: Crash Recovery & Idempotency Mechanism — Resolved ✅

**Question:** How should the system detect and recover from crashes during provisioning (e.g., worker dies mid-migration)?

**Answer:** Explicit State Checkpoint Table

**Reasoning:**

- Distributed lock expires via TTL safety net, allowing retry by another worker
- Checkpoint table in tenant DB tracks provisioning progress
- On retry: Read checkpoint → Resume from last successful step
- Prevents replay of already-applied migrations (checksum validation ensures uniqueness)
- Explicit state is more reliable than filesystem timestamps or log scraping
- Each migration tagged with immutable version identifier (safe replay)

**Implementation Impact:**

- Create `provisioning_checkpoints` table during baseline migrations:
  ```sql
  CREATE TABLE provisioning_checkpoints (
    id UUID PRIMARY KEY,
    step VARCHAR(50) NOT NULL,
    step_ordinal INTEGER NOT NULL,
    completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payload JSONB,
    correlation_id VARCHAR(255)
  );
  CREATE INDEX idx_provisioning_checkpoints_step ON provisioning_checkpoints(step_ordinal DESC);
  ```
- Worker writes checkpoint after each critical step: database_created, migration_001_applied, migration_002_applied, seed_completed, registry_created
- On worker crash: New worker acquires lock (old lock expired after 60s), reads latest checkpoint, resumes from next step
- Example: If worker crashes after migration_003 applied, retry worker sees checkpoint, skips to migration_004
- Recovery job (background): Scan checkpoints older than 1 hour; if provisioning job still in progress, escalate to ops team
- Validation test: Simulate worker crash → Verify retry resumes correctly → Confirm zero migrations replayed → Confirm final state consistent

---

### Clarifications Summary

| Question            | Answer                    | Immediate Impact                       | Integration Point                            |
| ------------------- | ------------------------- | -------------------------------------- | -------------------------------------------- |
| Isolation Level     | REPEATABLE READ           | Safety during concurrent modifications | Section 5.4 (Migration Execution)            |
| Pool Registration   | Post-schema completion    | Prevents premature requests            | Section 5.4 (Schema Initialization)          |
| Credentials Storage | Docker Secrets + Env Vars | Security posture + local development   | Section 7.3 (Credential Isolation)           |
| License Middleware  | Before pool registration  | Trust chain enforced                   | Section 4.1 (License Middleware Integration) |
| Crash Recovery      | State Checkpoint Table    | Idempotency guaranteed                 | Section 6.7 (Rollback & Recovery)            |

**All Ambiguities Resolved:** ✅

**Specification Ready for Implementation:** ✅

**Clarifications Completed:** 2026-02-18T14:30:00Z

---

## 3. Isolation Impact Analysis

### 3.1 Database Access Model

**Primary Database:** Master DB (`zidney_master`)

- Accessed during license creation/transition
- Write: Update `licenses` table with PROVISIONING state
- Access: Always through master connection pool (managed by MMC)

**Tenant Databases:** Per-tenant workspace database (`workspace_<slug>`)

- Created during provisioning phase
- Baseline schema initialized in this database
- Access: Always through tenant-specific connection pool in map
- Tenant resolution: Via slug from license metadata

### 3.2 Tenant Resolution

**Provisioning Context:** Worker receives license_id + workspace_slug from job queue.

**Access Path:**

1. Worker loads license from master DB (validates slug format, uniqueness)
2. Worker acquires distributed lock on `provisioning:<slug>`
3. Worker creates tenant DB connection (initially empty)
4. Worker loads tenant connection pool into in-memory map
5. Tenant resolver middleware available on all tenant-bound requests

**No Shared Tenant Data:** Each workspace database contains only that workspace's data.

### 3.3 Connection Pool Lifecycle

**Master Pool:**

- Singleton, instantiated at startup
- Used for license validation, metadata writes
- Never used for tenant data access

**Tenant Pool (Per-Tenant):**

- Created during provisioning
- Stored in in-memory map keyed by workspace_slug
- Each subsequent request resolves pool via slug from request context
- Pool destroyed only on permanent deletion

**Validation:**

- No tenant can access another tenant's pool
- No global DB singleton
- Tenant resolver middleware mandatory before any tenant query

✅ **Isolation boundary preserved at binary level.**

---

## 4. License & Version Enforcement

### 4.1 License Middleware Integration

**Requirement:** License validation is mandatory before provisioning starts and before any workspace operation.

**Flow:**

1. License created (status: `CREATED`, no DB exists)
2. Async job enqueued (workspace_slug in payload)
3. Provisioning job starts
4. License middleware validates: `PROVISIONING` state allowed → continue
5. Provisioning completes
6. License transitioned to `ACTIVE`
7. All subsequent workspace requests validate: license must be `ACTIVE` (not `SOFT_LOCKED`, `ARCHIVED`, `DELETED`)

**License States:**

- `CREATED` → License created, no DB yet
- `PROVISIONING` → Database creation in progress
- `ACTIVE` → Fully provisioned, operationally available
- `SOFT_LOCKED` → Provisioned but access blocked (preserves DB)
- `ARCHIVED` → Provisioned, snapshot taken, access blocked
- `DELETED` → Database dropped, license terminal

**Actions:**

- `PROVISIONING` → `ACTIVE` on success
- `PROVISIONING` → `FAILED` on error
- `ACTIVE` ↔ `SOFT_LOCKED` (lock/unlock tenant access)
- `SOFT_LOCKED` → `ARCHIVED` (on snapshot completion)
- `ARCHIVED` → `ACTIVE` (restore operation) OR → `DELETED` (permanent deletion)

### 4.2 Schema Version Enforcement

**Requirement:** Schema version compatibility validated at runtime middleware.

**Flow:**

1. During provisioning, create `schema_version` table in tenant DB
2. Insert row: `current_schema_version` = baseline version (e.g., `1.0.0`)
3. Store `expected_schema_version` in license metadata
4. On every workspace request: Validate tenant `schema_version.current_schema_version` ≥ minimum required
5. On schema upgrade: Increment `current_schema_version` via migration (STAGE_02C)

**Compatibility Rule:**

- Tenant schema version must be forward-compatible with runtime
- If `tenant.schema_version < runtime.min_supported_schema` → Reject (426 Upgrade Required)
- If `tenant.schema_version > runtime.max_supported_schema` → Reject (503 Service Unavailable)

### 4.3 Product Version Compatibility

**Requirement:** Product version compatibility is stored in license metadata but DEFERRED for enforcement to STAGE_06.

**STAGE_05 Scope:**

- License table stores `product_version` column (e.g., `1.0.0`)
- No runtime validation of product_version occurs in STAGE_05
- Schema version compatibility (4.2) is enforced; product version enforcement is separate

**STAGE_06 Scope (Attempt Engine Foundation):**

- Product version compatibility validation added to license middleware
- Runtime defines compatible version range
- On license middleware execution: Validate `license.product_version` in compatible range
- If incompatible → Reject (426 Upgrade Required)

**Rationale:** Product version enforcement is a runtime behavioral check, not a provisioning concern. STAGE_05 focuses on infrastructure provisioning; STAGE_06 handles runtime version compatibility.

✅ **License stored with product_version metadata for future STAGE_06 enforcement.**

---

## 5. Functional Requirements

### 5.1 License Lifecycle Trigger

**Requirement:** Provisioning is triggered by license state transition.

**Trigger Condition:**

- License transitions from `CREATED` → `PROVISIONING`
- Job payload contains: `license_id`, `workspace_slug`, `correlation_id`
- Worker dequeues and processes asynchronously

**Result:**

- Success: License transitions to `ACTIVE`, database fully operational
- Failure: License transitions to `FAILED`, database rolled back cleanly

### 5.2 Distributed Lock Acquisition

**Requirement:** All provisioning must be protected by a distributed lock.

**Lock Key:** `provisioning:<workspace_slug>`

**Lock Duration:** 60 seconds (auto-renewable if operation in progress)

**Lock Mechanism:**

- Use Redis-based distributed lock (transactional SET with NX and EX)
- Before any provisioning: Attempt to acquire lock
- If lock exists: Abort provisioning, log collision, retry later (exponential backoff)
- If lock acquired: Proceed with provisioning
- On completion (success or rollback): Release lock immediately

**Purpose:** Prevents parallel provisioning attempts that could cause:

- Duplicate database creation
- Race conditions in migrations
- Registry corruption

**Example Scenario:**

```
Attempt 1: Acquire lock ✓ → Create DB → Migrate → Write registry → Release lock
Attempt 2 (during Attempt 1): Acquire lock ✗ → Abort → Exponential backoff → Retry later
```

### 5.3 Database Creation

**Requirement:** Create isolated PostgreSQL database per tenant.

**Implementation:**

1. Validate `workspace_slug` format (lowercase, alphanumeric + dash, 3-50 chars)
2. Check uniqueness in `tenants_registry` (no duplicate slug)
3. Execute: `CREATE DATABASE workspace_<slug>`
4. Validate creation success
5. Connect to new database

**Naming Convention:**

- Format: `workspace_<slug>` (e.g., `workspace_acme-university-uk`)
- Slug: Immutable identifier for the workspace
- Database must exist on same PostgreSQL instance (managed by DevOps)

**Safety Constraints:**

- No special characters in database name
- No reserved SQL keywords
- Idempotency: If database exists, verify creation was ours (via registry), or abort

### 5.4 Baseline Tenant Schema Initialization

**Requirement:** Run tenant baseline migrations to create structural tables.

**Baseline Tables to Create:**

```
users               → Student/staff accounts
roles               → Role definitions
role_permissions    → Permission grants
divisions           → Institutional divisions
departments         → Departments within divisions
groups              → Study groups
subscriptions       → License subscriptions per group
attempts            → Exam attempt records
exams               → Exam definitions
mcq_questions       → Multiple-choice question pool
traditional_questions → Short/long answer question pool
translations        → Multi-language content
certificates        → Certificate records
settings            → Workspace-level settings
schema_version      → Schema metadata (CRITICAL)
```

**Migration Execution:**

1. Load migration files from `apps/api/src/db/tenant/migrations`
2. Execute in transaction (all-or-nothing)
3. Each migration must be idempotent (safe to replay)
4. Checksum validation: Verify migration hash matches expected (SHA256)
5. On success: Write migration metadata to `schema_migrations` table
6. If any migration fails: ROLLBACK entire transaction, drop database, log error

**Schema Version Table:**

```sql
CREATE TABLE schema_version (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_schema_version VARCHAR(20) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64) NOT NULL
);

INSERT INTO schema_version
  (current_schema_version, checksum)
VALUES
  ('1.0.0', '<sha256-hash>');
```

**Baseline Version:** `1.0.0` (semantic versioning)

### 5.5 Baseline Structural Data Seeding

**Requirement:** Seed minimal required structural data for workspace to operate.

**Seed Data:**

- Default Admin Role: `role_id=1, name='Admin'`
- Default Student Role: `role_id=2, name='Student'`
- Default Permissions: Standard CRUD permissions for roles
- Default Language: English (`code='en'`)
- Default Division: `name='Main Division'` (cannot be deleted)
- Default Settings: Workspace timezone, date format, etc.

**Constraints:**

- NO demo users
- NO demo content (exams, questions, attempts)
- NO sample data
- Only structural scaffolding required for application logic

**Idempotency:** If seed already exists (e.g., on retry), skip (use upsert semantics).

### 5.6 Registry Entry Creation

**Requirement:** Record provisioned workspace in `tenants_registry` (master DB).

**Registry Schema:**

```sql
CREATE TABLE tenants_registry (
  id BIGSERIAL PRIMARY KEY,
  workspace_slug VARCHAR(255) UNIQUE NOT NULL,
  license_id BIGINT NOT NULL UNIQUE REFERENCES licenses(id),
  database_name VARCHAR(255) NOT NULL,
  expected_schema_version VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP,
  deleted_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

**Entry Creation:**

1. Same transaction as license update
2. Insert: `workspace_slug`, `license_id`, `database_name`, `expected_schema_version`
3. Set `created_at` to server time
4. Validate: No duplicate slug exists

**Integrity Guarantee:** Registry row must exist ⟺ Database exists ⟺ License active.

### 5.7 License Status Transition

**Requirement:** Transition license from `PROVISIONING` to `ACTIVE`.

**Flow:**

1. All previous steps succeeded
2. Update master DB: `licenses.status = 'ACTIVE'`
3. Update master DB: `licenses.schema_version = '1.0.0'`
4. Same transaction as registry entry creation
5. Commit

**On Failure:**

- Update master DB: `licenses.status = 'FAILED'`
- Log error with correlation_id
- Ensure partial rollback completed (database dropped)

### 5.8 Lock Release

**Requirement:** Release distributed lock upon completion.

**Timing:**

- Release immediately after final transaction commit (success path)
- Release immediately after rollback completion (failure path)
- Never hold lock during external operations (backup, etc.)

**Handling:**

- If lock release fails: Log warning, let lock expire (TTL safety net)
- If lock already expired: Log info, continue

---

## 6. Non-Functional Requirements

### 6.1 Isolation Guarantees

**Requirement:** Absolute tenant isolation at every level.

**Guarantees:**

1. **Database Isolation:** Each tenant owns exactly one isolated database
2. **Connection Pool Isolation:** Each tenant has separate connection pool in memory map
3. **Query Isolation:** No cross-tenant queries possible (database-level enforcement)
4. **Credential Isolation:** Each tenant connection uses tenant-scoped credentials (if applicable)
5. **No Shared Tables:** No database table is accessed by multiple tenants

**Validation:**

- Static analysis: No cross-tenant JOIN in codebase
- Runtime: Tenant resolver validates before every query
- Test: Integration test confirms isolated databases fully separated

### 6.2 Concurrency Safety

**Requirement:** Provisioning is safe under concurrent attempts.

**Mechanisms:**

1. **Distributed Lock:** Prevents parallel provisioning of same workspace
2. **Unique Constraints:** `tenants_registry(workspace_slug) UNIQUE`
3. **Transaction Boundaries:** All critical writes transactional
4. **Idempotency:** Operation can be safely retried with same outcome

**Scenario Testing:**

- Duplicate license creation → Lock prevents double provision
- Parallel registration attempts → Unique constraint enforces serial committed state
- Worker crash mid-provision → Lock expires, retry succeeds

### 6.3 Idempotency Contracts

**Requirement:** Provisioning is safely retryable.

**Idempotence Rules:**

1. **Database Existence Check:** If `workspace_<slug>` exists and in registry → Skip creation, validate consistency
2. **Migration Checksum:** Each migration has immutable checksum; if already applied (in schema_migrations), skip
3. **Registry Uniqueness:** If registry entry exists with same license_id → Skip write (already exists)
4. **Seed Idempotency:** Seed operations use upsert (INSERT ... ON CONFLICT DO NOTHING)

**Example Retry Scenario:**

```
Attempt 1: Lock ✓ → DB create ✓ → Migrate ✓ → Seed ✓ → Registry ✓ → License ✓ → Fail before lock release
Attempt 2: Lock ✓ (retry acquired) → Check DB exists ✓ → Check migrations in DB ✓ → Check registry ✓ → No-op remainder → Success
```

### 6.4 Retry Strategy

**Requirement:** Failed provisioning retries with exponential backoff.

**Configuration:**

- **Max Retries:** 3
- **Initial Backoff:** 5 seconds
- **Backoff Multiplier:** 2 (i.e., 5s, 10s, 20s)
- **Max Backoff:** 60 seconds

**Retry Conditions:**

- Database creation transient error (connection timeout)
- Lock collision (another worker holding lock)
- Transient network error

**No-Retry Conditions:**

- Slug already registered (not transient, manual intervention needed)
- Migration checksum mismatch (data integrity issue, escalate)
- License not in `PROVISIONING` state (business logic error)

**DLQ (Dead Letter Queue):**

- After 3 retries: Move job to DLQ
- Log with EMERGENCY level: `correlation_id`, `license_id`, `workspace_slug`, error details
- Manual intervention required to resolve

### 6.5 Timeout Boundaries

**Requirement:** All time-sensitive operations have bounded timeouts.

**Timeouts:**

- **Lock Wait:** 5 seconds (quick abort if lock held)
- **Database Creation:** 30 seconds
- **Migration Execution:** 300 seconds (per migration)
- **Total Provisioning Job:** 600 seconds (10 minutes)
- **Registry Write:** 10 seconds

**Timeout Handling:**

- On timeout: Abort, attempt rollback, move to DLQ if retries exhausted

### 6.6 Transactional Writes

**Requirement:** All state mutations are atomic.

**Transaction Boundaries:**

1. **Schema Creation Transaction:** All baseline migrations in single transaction (auto-rollback on any failure)
2. **Registry + License Transaction:** Registry entry + license status update in single master DB transaction
3. **Seed Transaction:** All seed operations in single transaction

**Atomicity Guarantee:** Either full system state updated, or full rollback (no partial state).

**Failure Handling:**

- Checksum mismatch in migration → Rollback entire baseline migration transaction
- Registry insert fails → Rollback, drop database, mark license FAILED
- License update fails → Rollback registry entry

### 6.7 Rollback & Recovery

**Requirement:** Failed provisioning leaves no orphans or partial state.

**Rollback Actions (On Failure):**

1. If database created but migrations failed:
   - Rollback migration transaction (automatic)
   - Drop entire database
   - Release lock
2. If database and schema created but registry write failed:
   - Rollback registry transaction (automatic)
   - Drop database
   - Release lock
3. If everything succeeds but final transaction fails:
   - No rollback needed (idempotency handles retry)

**Result:** Either fully provisioned or fully rolled back (no in-between state).

**Registry Consistency:** If registry entry exists but database missing → Mark license FAILED (critical bug in ops job).

### 6.8 Performance & Scalability

**Requirement:** Provisioning must support concurrent workspace creation without blocking.

**Constraints:**

- Asynchronous processing (no API request blocking)
- Job queue distributes load across workers
- Lock duration short (seconds, not minutes)
- Lock allows other workers to provision different workspaces concurrently

**Expected Throughput:**

- Single worker: ~10-20 provisioning jobs per minute
- Multiple workers: Linear scaling (no single point of contention)
- No customer-facing latency impact (API requests never wait for provisioning)

---

## 7. Security & Compliance

### 7.1 Tenant ID Validation

**Requirement:** All workspace identifiers validated before use.

**Validation Rules:**

- **Slug Format:** Regex `^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$` (lowercase, alphanumeric, dash, 3-50 chars)
- **Slug Uniqueness:** Checked against `tenants_registry` before creation
- **License Association:** Validate license_id matches slug in job payload

**Injection Prevention:**

- No dynamic SQL construction using slug
- All slug usage via parameterized queries
- Slug used as database name validated against whitelist pattern

### 7.2 License Status Checks

**Requirement:** No provisioning without valid license in correct state.

**Checks:**

1. License exists in master DB
2. License status is `CREATED` or `PROVISIONING` (idempotency)
3. License organization_id matches expected
4. License subscription valid (not expired)

**Failure Handling:**

- If license not found in `CREATED` → Abort (log inconsistency)
- If previous provisioning is still `PROVISIONING` → Retry from current point (idempotency)
- If license already `ACTIVE` → Log info, no-op (already provisioned)

### 7.3 Credential Isolation

**Requirement:** Database credentials scoped per tenant.

**Model:**

- Master DB: Single service account (provisioner role)
- Tenant DB: Single service account per tenant (minimal CRUD permissions)
- Credentials stored in secrets manager (not committed)
- No shared credentials across tenants

**Implementation:**

- Provisioner service account: Can create databases, run migrations, manage users
- Tenant account: Can SELECT/INSERT/UPDATE/DELETE application tables only, no DDL

### 7.4 Audit Logging

**Requirement:** All provisioning events logged with structured format.

**Log Fields (All Events):**

```json
{
  "timestamp": "2026-02-18T10:23:45.123Z",
  "level": "info|error|warn",
  "service": "provisioning-worker",
  "correlation_id": "<uuid>",
  "workspace_slug": "acme-university-uk",
  "license_id": 12345,
  "event": "provisioning_started|provisioning_completed|provisioning_failed|lock_acquired|database_created|schema_initialized|registry_created|license_transitioned",
  "details": { ... },
  "error": null | { "code": "...", "message": "..." }
}
```

**Events Logged:**

1. `provisioning_started` → Job dequeued
2. `lock_acquired` → Distributed lock acquired
3. `database_created` → `CREATE DATABASE` succeeded
4. `schema_initialized` → All migrations completed
5. `seed_completed` → Baseline data seeded
6. `registry_created` → Registry entry inserted
7. `license_transitioned` → License status changed
8. `provisioning_completed` → All steps succeeded
9. `provisioning_failed` → Any step failed (with error details)
10. `lock_released` → Lock released

**No PII in Logs:**

- Slug is workspace identifier (metadata)
- License ID is metadata (not sensitive)
- No user data in logs
- No credentials in logs
- No connection strings in logs

### 7.5 PII Handling

**Requirement:** Provisioning does not expose personal data.

**Constraints:**

- Baseline seed has NO user accounts (not PII)
- Baseline seed has NO email addresses
- Baseline seed has NO personal information
- Logs contain only workspace identifiers
- Snapshots encrypted at rest (handled by backup infrastructure)

---

## 8. Architecture & Constraints

### 8.1 Trust Chain Enforcement

**Trust Chain:** Isolation → License → Authentication → Attempt → Runtime → Frontoffice

**This Stage's Role:** Establishes Isolation layer.

**Implications:**

- Provisioning must complete before any license validation (no DB to validate against yet in early flow)
- Provisioning success enables subsequent license checks
- Any corruption in provisioning breaks entire trust chain

**Validation:**

- Isolation boundary verified: No cross-tenant database access possible
- License validation layer ready for subsequent stages
- Next stage (STAGE_06) depends on successful provisioning

### 8.2 Database Isolation Model Compliance

**Requirement:** Preserve ADR-0001 (Database-per-Tenant).

**Compliance:**

- ✅ Each workspace gets fully isolated database
- ✅ No shared tables across tenants
- ✅ No row-based multi-tenancy
- ✅ No cross-tenant joins

**Enforcement:**

- Provisioning only creates single database per workspace
- Connection pooling prevents access between tenants at application level
- Database permissions (if used) prevent physical cross-tenant access

### 8.3 Middleware Layering

**Requirement:** All workspace operations must invoke tenant resolver after provisioning.

**Middleware Stack (for subsequent workspace requests):**

1. Correlation ID middleware
2. **Tenant resolver middleware** (uses slug from subdomain/path)
3. License enforcement middleware
4. Schema version check middleware
5. Route handler

**Provisioning Position:** Runs outside normal request middleware stack (internal job).

**Validation:**

- Normal requests go through all middleware layers
- Provisioning bypasses tenant resolver (it IS the tenant resolver)
- Cannot provision without all isolation infrastructure in place

### 8.4 Worker Interaction Model

**Requirement:** Provisioning is worker-only, never in API process.

**Model:**

```
API Request (POST /workspace/provision)
    ↓
License Service (API)
    ↓ Enqueue Job
Job Queue (Redis)
    ↓
Worker Process (Dequeue)
    ↓
Provisioning Service (Worker)
    ↓ Update License Status
Master DB (license status)
```

**Safety:**

- API never creates databases (no DDL in API process)
- API only enqueues metadata
- Worker has DDL permissions
- Separation prevents API crashes from corrupting schema

---

## 9. Data Model / Schema Changes

### 9.1 Master Database Changes

**New Columns in `licenses` Table:**

```sql
ALTER TABLE licenses ADD COLUMN status VARCHAR(20) DEFAULT 'CREATED';
  -- Values: CREATED, PROVISIONING, ACTIVE, SOFT_LOCKED, ARCHIVED, FAILED, DELETED

ALTER TABLE licenses ADD COLUMN schema_version VARCHAR(20);
  -- Tracks expected schema version for tenant DB

ALTER TABLE licenses ADD COLUMN archived_at TIMESTAMP;
  -- Timestamp when archived (moved to snapshot)
```

**New Table: `tenants_registry`**

```sql
CREATE TABLE tenants_registry (
  id BIGSERIAL PRIMARY KEY,
  workspace_slug VARCHAR(255) UNIQUE NOT NULL,
  license_id BIGINT NOT NULL UNIQUE REFERENCES licenses(id),
  database_name VARCHAR(255) NOT NULL UNIQUE,
  expected_schema_version VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP,
  deleted_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT valid_slug CHECK (workspace_slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$')
);

CREATE INDEX idx_tenants_registry_slug ON tenants_registry(workspace_slug);
CREATE INDEX idx_tenants_registry_license_id ON tenants_registry(license_id);
```

### 9.2 Tenant Database Schema (Baseline)

**Tables Created on Provisioning:**

1. `schema_version` (CRITICAL)

   ```sql
   CREATE TABLE schema_version (
     id INTEGER PRIMARY KEY DEFAULT 1,
     current_schema_version VARCHAR(20) NOT NULL,
     applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     checksum VARCHAR(64) NOT NULL,
     CONSTRAINT only_one_row CHECK (id = 1)
   );
   ```

2. `schema_migrations` (Migration tracking)

   ```sql
   CREATE TABLE schema_migrations (
     id NEWID PRIMARY KEY,
     version VARCHAR(20) NOT NULL UNIQUE,
     description VARCHAR(255),
     installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     checksum VARCHAR(64) NOT NULL,
     execution_time_ms INTEGER
   );
   ```

3. Core Application Tables:
   - `users` → Student/staff accounts
   - `roles` → Role definitions
   - `role_permissions` → Permission matrix
   - `divisions` → Organizational divisions
   - `departments` → Department structure
   - `groups` → Study groups
   - `subscriptions` → Group subscriptions
   - `exams` → Exam definitions
   - `attempts` → Exam attempts
   - `mcq_questions` → Multiple-choice questions
   - `traditional_questions` → Short/long answer questions
   - `translations` → Multi-language content
   - `certificates` → Certificate records
   - `settings` → Workspace settings

(Detailed DDL provided in migration files, not here.)

### 9.3 Migration Impact

**Master DB Migration:**

- Add status column to licenses
- Add schema_version column to licenses
- Add archived_at column to licenses
- Create tenants_registry table

**Tenant DB Migration:**

- Baseline tenant migrations create all structural tables
- Each migration must be idempotent
- Migration order: Fixed (determined by file naming convention)
- No rollback in Phase 1 (only replay idempotent migrations)

**Version Bump:** `0.1.0` → `1.0.0` (schema structure complete)

### 9.4 Backward Compatibility

**Strategy:** This is baseline schema creation (no backward compatibility concern yet).

**Future Migrations:** STAGE_02C defines forward-compatible MINOR/MAJOR schema versioning.

---

## 10. API Contracts

### 10.1 Internal Job Queue Interface

**Message Format (Redis queue `provisioning_jobs`):**

```json
{
  "id": "<uuid>",
  "license_id": 12345,
  "workspace_slug": "acme-university-uk",
  "organization_id": 54321,
  "correlation_id": "<uuid>",
  "enqueued_at": "2026-02-18T10:00:00Z",
  "attempt": 1,
  "max_attempts": 3
}
```

**Job Dequeue (Worker):**

- Worker dequeues from Redis queue
- Must validate message format
- Must validate license state is `PROVISIONING` or `CREATED`
- Must log dequeue event

### 10.2 Registry Query Interface (Internal)

**Master DB Queries:**

```sql
-- Resolve tenant database name from workspace slug
SELECT database_name, license_id, expected_schema_version
FROM tenants_registry
WHERE workspace_slug = $1 AND is_active = true;

-- Check slug uniqueness before provisioning
SELECT id FROM tenants_registry
WHERE workspace_slug = $1 AND deleted_at IS NULL;

-- Get all active tenants (for integrity job)
SELECT workspace_slug, database_name, license_id, expected_schema_version
FROM tenants_registry
WHERE is_active = true AND deleted_at IS NULL;
```

### 10.3 License Service Interface

**License Transition (API calls from License Engine):**

```
POST /internal/licenses/<license_id>/transition
{
  "from_state": "CREATED",
  "to_state": "PROVISIONING",
  "reason": "workspace_provisioning_initiated"
}
```

**Result:** License status changed, provisioning job enqueued.

---

## 11. Error Codes & Status Codes

### 11.1 Provisioning Errors

| Error Code | HTTP Status | Condition                                    | Action                                          |
| ---------- | ----------- | -------------------------------------------- | ----------------------------------------------- |
| `PROV_001` | 409         | Slug already registered                      | Abort, log conflict, retry without recreating   |
| `PROV_002` | 500         | Database creation failed                     | Rollback, retry (transient) or DLQ (persistent) |
| `PROV_003` | 500         | Migration execution failed                   | Rollback DB creation, retry or DLQ              |
| `PROV_004` | 500         | Registry write failed                        | Rollback, drop DB, retry or DLQ                 |
| `PROV_005` | 500         | License update failed                        | Rollback registry, drop DB, retry or DLQ        |
| `PROV_006` | 409         | Lock collision (another worker provisioning) | Exponential backoff, retry                      |
| `PROV_007` | 400         | Invalid workspace slug format                | No retry, escalate (invalid config)             |
| `PROV_008` | 404         | License not found                            | No retry, escalate (data inconsistency)         |
| `PROV_009` | 400         | License not in PROVISIONING state            | No retry, check business logic                  |
| `PROV_010` | 500         | Checksum mismatch in migration               | No retry, escalate (data integrity)             |

### 11.2 Workspace Access Errors (Post-Provisioning)

| Error Code | HTTP Status | Condition                                  | Action                                     |
| ---------- | ----------- | ------------------------------------------ | ------------------------------------------ |
| `WS_001`   | 404         | Workspace not found (slug not in registry) | User error (invalid tenant)                |
| `WS_002`   | 423         | License soft-locked                        | Tenant access blocked, show message        |
| `WS_003`   | 403         | License archived                           | Tenant access forbidden, restore or delete |
| `WS_004`   | 426         | Schema version incompatible                | Tenant upgrade required                    |
| `WS_005`   | 426         | Product version incompatible               | **(STAGE_06)** License upgrade required    |

---

## 12. Logging Requirements

### 12.1 Structured Log Format

**Every Log Entry Must Include:**

```json
{
  "timestamp": "ISO 8601",
  "level": "debug|info|warn|error|fatal",
  "service": "provisioning-worker",
  "version": "1.0.0",
  "correlation_id": "<uuid>",
  "workspace_slug": "<slug>",
  "license_id": 12345,
  "organization_id": 54321,
  "event": "<event_name>",
  "details": { ... },
  "error": null | { "code": "<ERROR_CODE>", "message": "...", "stack": "..." },
  "duration_ms": 1234
}
```

### 12.2 Critical Events

```
1. provisioning_job_dequeued
   - scope: license_id, workspace_slug
   - level: info

2. provisioning_lock_acquired
   - lock_key: provisioning:<slug>
   - level: info

3. provisioning_database_created
   - database_name: workspace_<slug>
   - level: info

4. provisioning_migrations_started
   - migration_count: N
   - level: info

5. provisioning_migration_applied
   - migration_version: "1.0.0.001"
   - duration_ms: 500
   - level: debug

6. provisioning_schemas_initialized
   - tables_created: N
   - level: info

7. provisioning_seed_data_applied
   - roles_count: N
   - level: debug

8. provisioning_registry_entry_created
   - registry_id: N
   - level: info

9. provisioning_license_transitioned
   - from_state: "PROVISIONING"
   - to_state: "ACTIVE"
   - level: info

10. provisioning_completed
    - total_duration_ms: 5000
    - level: info

11. provisioning_failed
    - failed_step: "schema_initialization"
    - error_code: "PROV_003"
    - level: error

12. provisioning_lock_released
    - level: debug

13. provisioning_job_retry
    - attempt: 2
    - backoff_ms: 10000
    - reason: "transient_database_error"
    - level: warn

14. provisioning_job_dlq
    - attempt: 3
    - total_duration_ms: 35000
    - level: error|fatal
```

### 12.3 Observability Metrics

**Prometheus Metrics (if applicable):**

```
provisioning_duration_seconds{workspace_slug, status}
provisioning_attempts_total{workspace_slug, status}
provisioning_lock_waittime_seconds{workspace_slug}
provisioning_database_creation_seconds{workspace_slug}
provisioning_migration_seconds{workspace_slug, migration_version}
```

---

## 13. Version & Compatibility

### 13.1 Schema Version Tracking

**Baseline Schema Version:** `1.0.0` (Semantic Versioning)

**Components:**

- `MAJOR` (1): Schema structure version (breaking DB changes)
- `MINOR` (0): Backward-compatible schema additions
- `PATCH` (0): Non-breaking updates (indexes, constraints)

**Tracking Location:**

- Stored in `tenant_db.schema_version.current_schema_version`
- Stored in `master_db.licenses.schema_version`
- Stored in `master_db.tenants_registry.expected_schema_version`

### 13.2 Product Version Compatibility

**Product Version Range:** `1.0.0` to `1.x.x` (Phase 1)

**Compatibility Enforcement:**

- Runtime validates `license.product_version` in compatible range
- If incompatible: Reject with 426 Upgrade Required

### 13.3 Platform Runtime Version

**Runtime Version:** Defined in `packages/config/runtimeVersion.ts`

**Compatibility Matrix:**

```
Runtime Version 1.0.0:
  - Supports Schema: 1.0.0 to 1.2.x
  - Supports Product: 1.0.0 to 1.0.x
  - Requires Protocol: 1.0
```

**Migration Path for MAJOR Versions:**

- Explicit license upgrade required
- Workspace snapshot required before MAJOR upgrade
- New migration stage created (not provisioning responsibility)

### 13.4 Forward Compatibility Strategy

**Why Provisioning is STAGE_05 (early):**

- Foundation must be established before attempting, licenses, runtime can build on it
- Early schema versioning prevents later changes from breaking established assumptions
- Baseline cannot change without forcing all tenants to migrate (high cost)

**Future Stages Then Build:**

- STAGE_06: Attempt engine (depends on schema, versioning)
- STAGE_04 (before): License engine (manages product versions)
- Later runtime, frontoffice (depend on stable provisioning)

---

## 14. Success Criteria

### 14.1 Functional Success Criteria

| Criterion                     | Measurement                                   | Target                                                  |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| Async provisioning works      | Provisioning job processes successfully       | 100% success rate for valid inputs                      |
| Database isolation guaranteed | No cross-tenant query possible                | 0 cross-tenant access attempts in tests                 |
| Lock prevents duplicates      | Two parallel provision attempts for same slug | Only one succeeds; one aborts with lock collision       |
| Idempotency proven            | Replay same job 3 times                       | 3rd and subsequent replays no-op successfully           |
| Schema initialized            | Workspace database has all baseline tables    | All 15+ structural tables created                       |
| Registry consistency          | Check registry ↔ DB state                     | 100% alignment (no orphans)                             |
| Archive snapshot works        | Take snapshot of fully provisioned workspace  | Snapshot valid, contains all tables                     |
| Restore from snapshot         | Restore archived workspace                    | Restored workspace fully operational, no data loss      |
| Permanent deletion            | Delete workspace                              | Database dropped, registry cleared, license DELETED     |
| Rollback on failure           | Simulate schema init failure                  | Partial state cleaned up, lock released, retry succeeds |
| Version compatibility         | Query schema version                          | Correctly matches expected version                      |

### 14.2 Non-Functional Success Criteria

| Criterion            | Measurement                          | Target                                                     |
| -------------------- | ------------------------------------ | ---------------------------------------------------------- |
| Concurrency safety   | Provision 10 workspaces concurrently | All succeed, no collisions                                 |
| Retry resilience     | Simulation of transient failures     | 95%+ recovery rate after 2-3 retries                       |
| Performance          | Provisioning duration                | < 30 seconds per workspace (single worker)                 |
| Throughput           | Jobs per minute                      | 10-20 jobs per minute per worker                           |
| Lock efficiency      | Lock hold time                       | < 5 seconds for most provisions                            |
| Audit logging        | Correlation ID tracing               | 100% of events correlatable                                |
| Isolation validation | Static code analysis                 | 0 cross-tenant code paths in provisioning                  |
| Scalability          | Multiple workers                     | Linear performance scaling (no lock contention bottleneck) |

### 14.3 Security Success Criteria

| Criterion             | Measurement                       | Target                                            |
| --------------------- | --------------------------------- | ------------------------------------------------- |
| No credential leakage | Log analysis                      | 0 credentials, connection strings, or PII in logs |
| Slug validation       | Fuzzing slug input                | 0 SQL injection vectors                           |
| License enforcement   | Attempt provision without license | 100% rejection                                    |
| Checksum integrity    | Modified migration detection      | Checksum mismatch detected, no silent corruption  |
| Audit trail           | Trace provisioning flow           | All events logged with correlation_id             |

### 14.4 Architectural Success Criteria

| Criterion              | Measurement                 | Target                                          |
| ---------------------- | --------------------------- | ----------------------------------------------- |
| ADR-0001 compliance    | Database isolation verified | Each tenant has fully isolated database         |
| No cross-tenant joins  | Code review                 | 0 cross-tenant queries in provisioning logic    |
| Worker-only execution  | Deployment validation       | Provisioning code never runs in API process     |
| Idempotency proven     | Formal verification         | Provisioning = safe retry + deterministic       |
| Transaction boundaries | Schema change audit         | All critical writes transactional               |
| Version enforcement    | Compatibility test          | Schema version enforced before workspace access |
| No global DB singleton | Codebase audit              | All tenant connections use resolver context     |

---

## 15. Explicit Non-Goals

### What This Feature Does NOT Change

- **Authentication system:** Deferred to STAGE_03
- **Attempt engine:** Deferred to STAGE_06
- **Exam configuration:** Deferred to frontoffice
- **User management UI:** Deferred to frontoffice
- **Backup infrastructure:** Assumes external snapshot storage exists
- **Access control policies:** Deferred to STAGE_03 + frontoffice
- **Email templates:** Deferred to later stages
- **Certificate generation:** Deferred to later stages
- **Reporting system:** Deferred to later phases
- **Data warehousing:** Out of scope for provisioning

### Assumptions

1. **External Snapshot Storage Exists:** Backup infrastructure (S3, Azure Blob, etc.) is provisioned by DevOps
2. **PostgreSQL Instance Configured:** Single PostgreSQL instance exists with provisioner credentials
3. **Redis Instance Exists:** Redis cluster for job queue, locks, caching
4. **Idempotency via UPSERT:** Application code uses INSERT ... ON CONFLICT for seed operations
5. **No Dynamic SQL:** Slug always parameterized, never string-interpolated
6. **Server Clock Synchronized:** All server clocks NTP-synchronized for distributed lock TTL reliability
7. **Migration Checksums Immutable:** Once a migration checksum is published, it never changes (immutability contract)
8. **No Direct DB Access Outside Provisioning:** Application always uses connection pools, never raw connections

---

## 16. Constitutional Compliance Statement

### 16.1 Compliance Verification

This specification has been validated against:

- ✅ Zidney Constitution v1.2.0
- ✅ ADR-0001 (Database-per-Tenant)
- ✅ ADR-0002 (Snapshot Attempt Model)
- ✅ ADR-0007 (Product Version Compatibility)
- ✅ ADR-0008 (Semantic Versioning Policy)
- ✅ STAGE_LIFECYCLE_POLICY.md
- ✅ PROJECT_CONTEXT_PRIMER.md

### 16.2 Violations Found

**None.** ✅

### 16.3 Final Compliance Declaration

> **Compliant with Zidney Constitution v1.2.0 — No violations detected.**
>
> - No cross-tenant access introduced
> - No middleware bypass possible
> - No grading outside worker (N/A)
> - No direct DB instantiation without resolver
> - Snapshot integrity preserved (configuration snapshotting in STAGE_06)
> - Transaction boundaries maintained
> - Version enforcement integrated
> - Idempotency formally specified
> - Audit logging comprehensive
> - All isolation guarantees strengthened

**Status:** ✅ READY FOR PLANNING

---

## 17. Specification Metadata

| Attribute                 | Value                                  |
| ------------------------- | -------------------------------------- |
| **Specification Version** | 1.0.0                                  |
| **Date Created**          | 2026-02-18                             |
| **Last Reviewed**         | 2026-02-18                             |
| **Authority**             | Zidney Constitution v1.2.0             |
| **References**            | ADR-0001, ADR-0002, ADR-0007, ADR-0008 |
| **Depends On**            | STAGE_02, STAGE_02C, STAGE_04          |
| **Enables**               | STAGE_06, All Tenant Operations        |
| **Specification Author**  | AI Agent (GitHub Copilot)              |
| **Reviewed By**           | [Pending]                              |
| **Approved By**           | [Pending]                              |

---

**End of Specification**
