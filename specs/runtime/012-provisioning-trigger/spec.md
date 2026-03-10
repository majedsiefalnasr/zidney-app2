# STAGE 12 – Provisioning Trigger Specification

**Feature:** Tenant Provisioning Trigger System  
**Phase:** 02_PLATFORM_MMC  
**Stage:** STAGE_12_PROVISIONING_TRIGGER  
**Branch:** 012-provisioning-trigger  
**Status:** Specification Ready

---

## Feature Overview

### What Is Being Built

A provisioning trigger system that allows MMC (Master Management Console) to safely delegate tenant
database creation, initialization, and activation to an asynchronous Provisioning Worker. MMC
creates a license record and enqueues a provisioning job; the Provisioning Worker independently
creates the tenant database, runs migrations, seeds data, creates the admin account, and activates
the workspace.

### Why It Matters

- **Isolation**: MMC never directly provisions tenant infrastructure (hard boundary)
- **Scalability**: Provisioning is async, allowing MMC to respond immediately
- **Reliability**: Worker-based approach enables retry, idempotency, and failure recovery
- **Audit Trail**: All provisioning steps are logged with correlation IDs
- **Safety**: Prevents orphaned databases, invalid registry entries, or inactive licenses

### Phases Affected

- Belongs to Phase 02_PLATFORM_MMC
- Maps to STAGE_12_PROVISIONING_TRIGGER
- Affects: License enforcement, Database isolation, Worker subsystem, Tenant registry

---

## Constitutional Compliance Declaration

✅ **No cross-tenant access**: Worker operates on single isolated tenant DB.  
✅ **No middleware bypass**: License validation required before any provisioning.  
✅ **No grading outside worker**: N/A — provisioning is not grading.  
✅ **No direct DB instantiation**: Worker writes only through authenticated pool manager.  
✅ **No snapshot integrity violations**: N/A — provisioning creates data, not at attempt level.  
✅ **No transaction boundary weakening**: All provisioning operations are atomic or compensating.  
✅ **No version enforcement bypass**: schema_version and product_version checked before
provisioning.

**Compliance Status**: ✅ Fully compliant with Zidney Constitution v1.2.0

---

## Isolation Impact Analysis

### Database Access Pattern

- **Master Database (MMC)**: License table (write), Provisioning queue (write)
- **Tenant Database**: New database created by Worker for each license

### Tenant Resolution

By Provisioning Worker:

1. Worker reads **license_id** from job payload
2. Queries master_db.licenses to fetch workspace_slug, product_id, product_version
3. Validates license.status = PENDING_PROVISION
4. Establishes isolated connection to new tenant database (workspace\_<slug>)
5. All subsequent operations occur in tenant DB context

No cross-tenant joins. No shared student/attempt tables touched.

### Connection Pool Management

- MMC uses **master pool** for license writes
- Worker creates **dedicated tenant pool** for each workspace (one per async job execution)
- Pool is closed after provisioning completes
- No singleton DB connections

### Resolver Middleware Impact

- License resolver validates **license.status** before allowing workspace login
- If status = PENDING_PROVISION → Block (423 Locked)
- If status = PROVISION_FAILED → Block (503 Service Unavailable)
- If status = ACTIVE → Allow (200 OK)

**Isolation Guarantee**: ✅ Only licensed, authorized workspaces can access their data.
Unprovisioned workspaces are blocked.

---

## License & Version Enforcement

### License Middleware Context

1. **MMC creates license** with initial status = PENDING_PROVISION
2. **License middleware** is NOT bypassed; it validates on every request
3. **Schema version** stored in license record at creation time (platform version)
4. **Product version** stored in license record at creation time

### License States During Provisioning

| State             | Meaning                    | User Access   | Action                   |
| ----------------- | -------------------------- | ------------- | ------------------------ |
| PENDING_PROVISION | Awaiting worker completion | Blocked (423) | Enqueued job in progress |
| ACTIVE            | Provisioning complete      | Allowed       | Normal operations        |
| PROVISION_FAILED  | Provisioning failed        | Blocked (503) | Manual retry available   |

### Version Checks

Before Provisioning Worker starts:

1. **Fetch license record**
   - Extract schema_version (e.g., "2.5.0")
   - Extract product_version (e.g., "2.5.0")

2. **Compare against platform**
   - If schema_version < platform.schema_version → Run forward migrations (includes all versions in
     range)
   - If product_version mismatch detected → Log warning (not blocking for initial provisioning)

3. **Apply migrations up to schema_version**
   - All migrations cumulative, forward-only
   - Idempotent (safe to replay)

### Limit Enforcement

License defines:

- student_limit
- staff_limit
- divisions_enabled (boolean)

Worker seeds default settings with these limits. Runtime later validates against usage.

---

## Data Model Changes

### New Tables in Master DB

None. Existing tables are used:

- `licenses` (modified with provision-related fields)
- `tenants_registry` (new — created in master DB)

### Modified Master DB Table: `licenses`

```sql
ALTER TABLE licenses ADD COLUMN (
  status varchar(32) DEFAULT 'PENDING_PROVISION'
    CHECK (status IN ('PENDING_PROVISION', 'ACTIVE', 'PROVISION_FAILED')),
  schema_version varchar(50) NOT NULL,
  product_version varchar(50) NOT NULL,
  retry_count integer DEFAULT 0,
  last_provision_error varchar(1024),
  provisioned_at timestamp,
  failed_at timestamp
);

CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_workspace_slug ON licenses(workspace_slug);
```

### New Master DB Table: `tenants_registry`

```sql
CREATE TABLE tenants_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL UNIQUE REFERENCES licenses(id) ON DELETE CASCADE,
  workspace_slug varchar(255) NOT NULL UNIQUE,
  db_name varchar(255) NOT NULL UNIQUE,
  schema_version varchar(50) NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_registry_license_id ON tenants_registry(license_id);
CREATE INDEX idx_tenants_registry_workspace_slug ON tenants_registry(workspace_slug);
CREATE INDEX idx_tenants_registry_db_name ON tenants_registry(db_name);
```

### Tenant DB Tables (Created by Worker)

Worker runs baseline migrations in each new tenant DB. Baseline includes:

- roles
- permissions
- workspace_settings
- divisions (if enabled)
- admin user

**Version Bump Required**: Yes — Add version field to schema_versions table.  
**Backward Compatibility**: N/A (initial provisioning stage)

---

## Transaction Boundaries

### Provisioning Atomicity Model

Worker must execute the following **as a single atomic transaction** per tenant:

```
BEGIN TRANSACTION (tenant_db)
  1. Create baseline schema (runs all migration files for version)
  2. Insert schema_version record
  3. Seed default roles
  4. Seed default permissions
  5. Seed default settings (with product limits)
  6. Create workspace admin account
  7. Create division record (if enabled)
COMMIT TRANSACTION

IF COMMIT SUCCEEDS:
  UPDATE master_db.licenses SET status = 'ACTIVE' WHERE license_id = ?
  INSERT INTO master_db.tenants_registry (...)
ELSE IF ROLLBACK:
  UPDATE master_db.licenses SET status = 'PROVISION_FAILED', last_provision_error = ?
  DROP DATABASE workspace_<slug> (or mark for purge)
  RETURN error to queue (for retry)
```

### Idempotency Constraint

If Worker receives duplicate job (same license_id):

1. Check if tenants_registry entry exists for license_id
2. If yes → Return success (already provisioned)
3. If no but license.status = ACTIVE → Return success
4. If license.status = PENDING_PROVISION → Retry provisioning (may find orphan DB, clean it first)

**Duplicate Delivery Protection**: Use Redis distributed lock keyed by license_id with 30-second
TTL. Only one Worker instance can provision a given license concurrently.

### Failure Handling & Rollback Paths

**Scenario: Database Creation Fails**

- Reason: Slug already exists (race condition)
- Action: Rollback transaction, update license.status = PROVISION_FAILED, enqueue retry
- Retry: Next attempt validates slug again before creating DB

**Scenario: Migration Fails**

- Reason: SQL syntax error or schema incompatibility
- Action: Drop partially created database, rollback license status
- Operator Action: Fix migration, manual retry from MMC

**Scenario: Seed Data Fails**

- Reason: Constraint violation (e.g., duplicate role name)
- Action: Drop database, mark license as PROVISION_FAILED
- Operator Action: Review seed script, retry

**Scenario: Admin Account Creation Fails**

- Reason: Email validation failure
- Action: Transaction rolls back, license marked PROVISION_FAILED
- Operator Action: Provide valid admin email on retry

**Scenario: Registry Insert Fails**

- Reason: Workspace slug not unique in registry
- Action: Rollback, clean up database, mark PROVISION_FAILED
- Reason: License orphaned (regression test)

**Never Leave Database In State**:

- ❌ Orphan database (exists but no registry entry)
- ❌ Registry without database (entry but DB does not exist)
- ❌ Database without registry (exists but not registered)
- ❌ License ACTIVE without both database and registry

---

## Worker Job Payload & Processing Logic

### Job Enqueue Format (MMC → Redis Queue)

```json
{
  "job_type": "PROVISION_WORKSPACE",
  "job_id": "uuid-generated-by-mmc",
  "license_id": "uuid",
  "workspace_slug": "acme-university-2026",
  "product_id": "uuid",
  "product_version": "2.5.0",
  "student_limit": 5000,
  "staff_limit": 100,
  "default_language": "en",
  "uses_divisions": true,
  "correlation_id": "request-uuid-from-mmc",
  "enqueued_at": "2026-02-24T10:00:00Z",
  "max_retries": 3
}
```

### Worker Processing Flow

```
1. VALIDATE LICENSE EXISTS
   - Query master_db.licenses WHERE id = job.license_id
   - If not found → Log error, mark job as FAILED, return

2. VALIDATE LICENSE STATUS
   - If status != PENDING_PROVISION → Log warning, return (likely already provisioned)
   - If status = ACTIVE → Return (idempotent success)

3. ACQUIRE DISTRIBUTED LOCK
   - Redis SETNX "provision:license:<license_id>" for 30s
   - If lock acquisition fails → Enqueue retry (max 3 times)

4. VALIDATE SLUG UNIQUENESS
   - Query master_db.tenants_registry WHERE workspace_slug = ?
   - If found → Rollback, mark license PROVISION_FAILED (slug violation)
   - If not found → Continue

5. CREATE TENANT DATABASE
   - SQL: CREATE DATABASE workspace_<slug>
   - If fails (exists from previous attempt) → DROP it, CREATE again
   - Set locale to UTF-8

6. CONNECT TO TENANT DATABASE
   - Establish connection with credentials from secrets manager
   - Create connection pool

7. BEGIN TRANSACTION

8. RUN BASELINE MIGRATIONS
   - For each migration in schemas/tenant/initial/:
     - Execute SQL
     - If fails → ROLLBACK, set license.status = PROVISION_FAILED, return
   - Insert into schema_versions (version, applied_at, checksum)

9. SEED BASELINE DATA
   - Insert default roles (ADMIN, STAFF, STUDENT, SUPPORT)
   - Insert default permissions (CREATE_EXAM, GRADE_EXAM, etc.)
   - Insert default settings (student_limit, staff_limit, default_language)
   - If uses_divisions → Insert default division

10. CREATE WORKSPACE ADMIN ACCOUNT
    - Hash password (bcrypt)
    - Insert into users table
    - Link to ADMIN role
    - Set verified_at = now()

11. INSERT REGISTRY ENTRY
    - INSERT INTO master_db.tenants_registry ON master_db connection
    - Fields: license_id, workspace_slug, db_name, schema_version, created_at

12. COMMIT TRANSACTION (tenant_db)

13. UPDATE LICENSE STATUS
    - UPDATE master_db.licenses SET status = 'ACTIVE', provisioned_at = now()

14. RELEASE DISTRIBUTED LOCK

15. LOG STRUCTURED SUCCESS
    - Include: license_id, workspace_slug, duration_ms, provision_version

RELEASE DISTRIBUTED LOCK (finally block, always)
```

### Retry Strategy

**Retry Conditions**:

- Max 3 retries (exponential backoff: 5s → 10s → 30s)
- Only if license.status = PROVISION_FAILED (after first attempt)
- Retry button in MMC UI allows manual retry

**Idempotent Retry Behavior**:

- Worker checks if tenants_registry entry exists
- If yes → Return success (no re-provisioning)
- If no but database exists → Clean up orphan DB, then re-provision
- If no and no database → Provision normally

---

## Authoritative Time Usage

### Server-Side Time Authority

All timestamps in provisioning are **server-generated** on the Provisioning Worker:

1. **enqueued_at** — Worker logs when job enters queue
2. **provisioned_at** — Worker sets when license.status = ACTIVE
3. **failed_at** — Worker sets when license.status = PROVISION_FAILED
4. **schema_versions.applied_at** — Worker sets during migration
5. **tenants_registry.created_at** — Worker generates on insert

### Time Drift Prevention

- Worker container uses system NTP (network time protocol)
- No client-provided timestamps accepted
- Platform enforces UTC for all server timestamps
- API resolver validates correlation_id timestamp (no older than 5 minutes)

### Reconnection / Long-Running Provisioning

- Provisioning can take 30-120 seconds for large schemas
- If Worker dies mid-provisioning:
  - Lock is released (30s TTL)
  - Next retry checks transaction completion status
  - Transaction logs in master_db show attempt history

---

## Idempotency Strategy

### Idempotency Key Model

- **Primary Key**: license_id (unique in licenses table)
- **Idempotency Check**: Before provisioning, check `tenants_registry.license_id`
- **Fallback**: Check license.status (if ACTIVE, no re-provisioning needed)

### Replay Behavior

If Worker receives duplicate job:

```
IF tenants_registry has entry for license_id:
  RETURN SUCCESS (already provisioned)

IF license.status = ACTIVE:
  RETURN SUCCESS (already active)

IF license.status = PROVISION_FAILED:
  RETRY provisioning
  IF database exists from previous attempt:
    DROP it
  CREATE new database

IF license.status = PENDING_PROVISION:
  Normal provisioning flow
```

### Double Submission Protection

- MMC generates unique job_id for each enqueue call
- Redis queue dedups based on license_id + attempt_number
- Master DB unique constraint on (license_id) in tenants_registry

---

## Observability Requirements

### Structured Logging

Every provisioning event must emit a structured log entry with:

```json
{
  "timestamp": "2026-02-24T10:05:30.123Z",
  "level": "info",
  "service": "provisioning-worker",
  "correlation_id": "<request-uuid>",
  "license_id": "uuid",
  "workspace_slug": "acme-university-2026",
  "db_name": "workspace_acme_university_2026",
  "event": "provisioning_started|step_completed|provisioning_success|provisioning_failed",
  "step": "database_creation|migration_applied|seed_roles|admin_created|registry_inserted",
  "duration_ms": 5032,
  "attempt_number": 1,
  "status": "ACTIVE|PROVISION_FAILED",
  "error_code": "DB_CREATE_FAILED|MIGRATION_FAILED|LOCK_TIMEOUT",
  "error_message": "descriptive error",
  "retry_count": 0,
  "environment": "production|staging"
}
```

### Metrics Emitted

- `provisioning.duration_ms` (histogram) — Time per provisioning attempt
- `provisioning.success_count` (counter) — Successful provisions
- `provisioning.failure_count` (counter) — Failed provisions by error type
- `provisioning.retry_count` (counter) — Retry attempts
- `provisioning.lock_wait_ms` (histogram) — Lock acquisition time
- `tenants_registry.total_workspaces` (gauge) — Current active workspaces

---

## Rate Limiting & Abuse Protection

### Provisioning Job Queue Protection

- Job queue is **internal** (not public endpoint)
- Only MMC can enqueue via admin authentication
- No rate limit needed per se, but queue size is monitored
- If queue backs up > 100 jobs: Alert operator

### Database Creation Rate Limiting

- Provisioning Worker can create max 10 databases per minute per host
- Enforced by: max 10 concurrent provisioning jobs
- Excess jobs wait in queue (no rejection)

### Workspace Slug Validation (Pre-Enqueue)

MMC must validate slug before enqueuing:

```
/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/
```

- Lowercase letters, digits, hyphens
- 3-255 characters
- No leading/trailing hyphens or underscores

---

## Layer Separation Confirmation

✅ **Frontend**: No provisioning logic. Admin creates license in MMC UI, worker handles the rest.  
✅ **API**: No grading logic. Enqueues provisioning jobs, never executes DDL.  
✅ **Worker**: Executes provisioning, migrations, admin account creation. No HTTP logic.  
✅ **MMC**: Creates license record, enqueues job, checks status. Never provisions directly.  
✅ **Database**: Tenant DBs isolated. No cross-tenant joins. Provisioning write-only by Worker.

---

## Failure Modes & Recovery

### Database Creation Failure

**Cause**: Slug already exists, insufficient storage, permission issues  
**Detection**: CREATE DATABASE returns error  
**Recovery**:

- Log error with correlation_id
- Update license.status = PROVISION_FAILED
- Operator fixes underlying issue (storage, permissions)
- Retry via MMC UI

**Prevention**: Slug uniqueness validated before enqueue

### Migration Failure

**Cause**: SQL syntax, version mismatch, constraint violation  
**Detection**: Migration execution fails  
**Recovery**:

- Drop partially created database
- Mark license PROVISION_FAILED with error_message
- Operator reviews migration, fixes code
- Manual retry after deploy

**Prevention**: Migrations tested in CI/CD before production

### Seed Data Failure

**Cause**: Duplicate role names, invalid defaults  
**Detection**: INSERT fails  
**Recovery**:

- Rollback transaction, drop database
- Mark license PROVISION_FAILED
- Operator reviews seed script
- Retry

**Prevention**: Seed script validated with test tenant

### Admin Account Creation Failure

**Cause**: Email invalid, password requirements not met  
**Detection**: INSERT into users fails  
**Recovery**:

- Transaction rolls back
- Mark license PROVISION_FAILED
- Operator provides valid email on retry

**Prevention**: Email validation before enqueue (optional future improvement)

### Registry Insert Failure

**Cause**: Slug not unique in registry (race condition)  
**Detection**: Unique constraint violation  
**Recovery**:

- Rollback, drop database
- Mark license PROVISION_FAILED
- Operator investigates race condition
- Retry after fix

**Prevention**: Distributed lock ensures only one provisioning per license at a time

### Worker Pod Crash Mid-Provisioning

**Cause**: OOM, node failure, deployment rollout  
**Detection**: Lock timeout (30s TTL)  
**Recovery**:

- Lock released after 30s
- Next Worker picks up job
- Checks if database exists (partial provisioning)
- Cleans up partial database if found
- Retries provisioning normally

**Prevention**: Worker uses persistent queue (Redis AOF)

### Timeout During Registry Insert

**Cause**: Network partition to master_db  
**Detection**: INSERT timeout (60s)  
**Recovery**:

- Rollback transaction
- Mark license PROVISION_FAILED
- Job re-enqueued (max 3 retries)
- Next attempt may find database already exists (idempotent check)

**Prevention**: Connection pooling with retry logic

---

## Success Criteria

Provisioning trigger is complete and working when:

1. ✅ **License Creation Enqueues Job**
   - MMC creates license with status=PENDING_PROVISION
   - Job appears in Redis queue within 100ms
   - Correlation ID propagated to job

2. ✅ **Tenant Database Created Automatically**
   - Worker picks up job
   - Database `workspace_<slug>` created in PostgreSQL
   - UTF-8 locale set

3. ✅ **Baseline Schema Applied**
   - All migrations run idempotently
   - schema_versions table populated
   - No schema mismatch errors

4. ✅ **Admin Account Seeded**
   - Admin user created in tenant DB
   - Linked to ADMIN role
   - Password bcrypt hashed
   - Email verified_at set

5. ✅ **Registry Entry Created**
   - tenants_registry has entry for license_id
   - workspace_slug, db_name, schema_version all correctly populated
   - created_at timestamp server-generated

6. ✅ **License Transitions to ACTIVE**
   - license.status updated to ACTIVE
   - provisioned_at timestamp set
   - All operations logged

7. ✅ **Failure Transitions to PROVISION_FAILED**
   - On error, license.status = PROVISION_FAILED
   - failed_at timestamp set
   - error_message populated

8. ✅ **Retry Succeeds After Failure**
   - Manual retry from MMC works
   - Provisioning completes on second attempt
   - License transitions to ACTIVE

9. ✅ **No Orphan Database Possible**
   - Partial databases cleaned up on failure
   - Registry constraint prevents unregistered DBs
   - Operator cannot manually create "stray" workspaces

10. ✅ **Resolver Blocks Non-ACTIVE States**
    - PENDING_PROVISION returns 423 Locked
    - PROVISION_FAILED returns 503 Service Unavailable
    - ACTIVE returns 200 OK
    - User cannot log in until ACTIVE

11. ✅ **Structured Logging Complete**
    - Every step emits correlation_id
    - workspace_slug included in all logs
    - duration_ms measurable for performance tracking
    - Error messages are descriptive and actionable

---

## Not Allowed

❌ Direct database creation from MMC (must use Worker)  
❌ ACTIVE license without corresponding tenant database  
❌ Registry entry without verified database  
❌ Cross-tenant provisioning jobs  
❌ Unencrypted database credentials in logs  
❌ Provisioning jobs executed outside Worker (e.g., by API endpoints)  
❌ License status changes outside provisioning flow  
❌ Bypassing license middleware during workspace login  
❌ Shared provisioning queues between tenants  
❌ Manual SQL modifications to registry (only Worker writes)

---

## Explicit Non-Goals

This specification does NOT address:

- **Multi-database deployments** (assumed single PostgreSQL instance for now)
- **Backup/recovery of newly provisioned workspaces** (covered by separate STAGE)
- **Workspace deletion/deprovisioning** (future STAGE)
- **Changing product after provisioning** (future STAGE)
- **Tenant migration between instances** (future STAGE)

---

## Test Strategy

### Unit Tests Required

1. ✅ License status validation before provisioning
2. ✅ Workspace slug validation (regex, uniqueness)
3. ✅ Distributed lock acquisition/release
4. ✅ Idempotency check (duplicate job handling)
5. ✅ Migration version comparison logic
6. ✅ Seed data default values
7. ✅ Error message formatting

### Integration Tests Required

1. ✅ Full provisioning flow (license → job → database → ACTIVE)
2. ✅ Failure recovery (database cleanup on error)
3. ✅ Retry after failure (manual trigger)
4. ✅ Registry consistency (no orphans)
5. ✅ Resolver blocking PENDING_PROVISION state
6. ✅ Resolver allowing ACTIVE state
7. ✅ Concurrent provisioning (lock prevents race)
8. ✅ Admin account login after provisioning

### Transactional Tests Required

1. ✅ Rollback on migration failure
2. ✅ Rollback on seed failure
3. ✅ Database cleanup after rollback
4. ✅ License status rolled back to PENDING_PROVISION

### Idempotency Tests Required

1. ✅ Duplicate job with same license_id returns success
2. ✅ Second provisioning attempt finds existing database
3. ✅ Lock-timeout scenario (pod crash, recovery)

### Observability Tests Required

1. ✅ Correlation ID propagated through all logs
2. ✅ Structured JSON logs parseable
3. ✅ Metrics emitted at correct intervals
4. ✅ Error logs include error_code and error_message

### Version Compatibility Tests Required

1. ✅ Schema version stored in license at creation
2. ✅ Worker applies migrations up to that version
3. ✅ Incompatible schema versions produce clear error

---

## Assumptions

1. **Single PostgreSQL Instance**: Only one PostgreSQL server per deployment. Multi-database
   deployments handled in future stages.
2. **Redis Queue Persistent**: Redis is configured with AOF (append-only file) persistence, so jobs
   survive restarts.
3. **Distributed Lock**: Redis SETNX used for distributed lock (alternative: DB-based lock via
   advisory locks).
4. **Credential Management**: DB credentials stored in Docker secrets or environment variables;
   never logged.
5. **Slug Validation Upstream**: MMC validates workspace slug before enqueue; Worker re-validates as
   defensive check.
6. **Admin Email Valid**: MMC ensures admin email is valid before enqueue (future: add email
   verification).
7. **Seed Data Static**: Baseline roles, permissions, divisions don't change during provisioning
   (versioned in migrations).
8. **NTP Sync**: All Worker pods sync via NTP; no manual time adjustments.
9. **No Partial Provisioning**: Once license.status = ACTIVE, provisioning is considered complete
   (no incremental steps can be added mid-way).

---

## Final Constitutional Compliance Statement

**✅ Compliant with Zidney Constitution v1.2.0 — No violations detected.**

This specification:

- Enforces database-per-tenant isolation
- Requires license middleware validation before any workspace access
- Uses Worker exclusively for infrastructure operations (no MMC DB writes)
- Maintains attempt snapshot integrity (N/A for provisioning)
- Ensures all operations are server-authoritative (no client timestamps)
- Provides full structured logging with correlation IDs
- Enforces idempotent retry behavior
- Prevents orphaned data through atomic transactions
- Aligns with ADR decisions on versioning and multi-tenancy

No exceptions or modifications to Zidney architecture required.

## Clarifications

### Session 2026-02-24

**Q1: Worker network-partition + lock TTL**

Scenario: Worker acquires distributed lock (30s TTL), proceeds with provisioning, then loses
connectivity to master_db after 45s (mid-provision).

**A1:** C) Worker attempts reconnect with exponential backoff up to 60s; if still disconnected, roll
back, release lock, mark `PROVISION_FAILED`, and re-enqueue for retry. This preserves safety while
avoiding indefinite lock extension.

**Q2: Seed data initialization scope**

Should seed data be platform-generic, tenant-specific, or hybrid?

**A2:** C) Hybrid: platform-generic baseline plus tenant-specific optional hooks (e.g., locale or
tenant feature flags). Default seeds are platform-generic; hooks allow later tenant customization
during provisioning.

**Q3: Admin account initial credential handling**

How should initial admin credentials be handled/delivered?

**A3:** D) Worker creates an admin placeholder and MMC triggers an invite flow where the admin sets
their password. Worker does not email or return raw credentials.

**Q4: Database-creation failure rollback semantics**

If DROP/CREATE fails mid-recovery, what is desired behavior?

**A4:** B) Attempt automatic retries for DROP/create with exponential backoff (N attempts) then mark
`PROVISION_FAILED`. Operator remediation is allowed after retries fail.

**Q5: Concurrent provisioning requests for same workspace_slug**

How should duplicate/concurrent requests be handled?

**A5:** A) Deduplicate at enqueue time (by `license_id`/slug) — drop duplicates so a single job is
processed; processing remains idempotent.

---

All clarifications recorded above have been resolved and incorporated into the specification. No
further `[NEEDS CLARIFICATION]` markers remain.
