# Implementation Plan: STAGE 12 – Provisioning Trigger

**Branch**: `012-provisioning-trigger` | **Date**: 2026-02-24 | **Spec**:
[specs/runtime/012-provisioning-trigger/spec.md](specs/runtime/012-provisioning-trigger/spec.md)
**Input**: Feature specification from `/specs/runtime/012-provisioning-trigger/spec.md`

## Summary

MMC creates license records and enqueues provisioning jobs to an asynchronous Worker. The Worker
independently creates tenant databases, runs baseline migrations, seeds required configuration data,
creates workspace admin accounts, and activates the workspace by transitioning license.status to
ACTIVE. The system enforces database-per-tenant isolation, transactional consistency, idempotent
retry behavior, and comprehensive structured logging with correlation IDs.

**Technical Approach**: Multi-stage async provisioning with distributed locks (Redis) for
idempotency, transactional database operations for atomicity, and structured logging for
observability. License middleware enforces access control at request boundary.

---

## Technical Context

**Language/Version**: TypeScript + Node.js (Bun runtime)  
**Primary Dependencies**: Hono (API routing), Redis (queue + distributed locks), PostgreSQL
(master + tenant DBs), Vitest (unit/integration testing)  
**Storage**: PostgreSQL (database-per-tenant model), Redis (job queue, distributed locks, transient
state)  
**Testing**: Vitest unit tests, integration test harness with DB setup/teardown  
**Target Platform**: Linux/Docker (multi-worker deployment model)  
**Project Type**: Backend microservice (Worker + API integration)  
**Performance Goals**: Provision workspace in <120s p95 (5k tenant, 100+ migrations)  
**Constraints**: <500MB memory per Worker, idempotent operation within 30s lock TTL  
**Scale/Scope**: 10k+ workspaces, 100 concurrent provisions, 99.5% success rate

---

## Constitution Check

**✅ GATE PASSED** — All constitutional requirements met:

| Principle                         | Status  | Evidence                                                                                          |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| Database-per-tenant isolation     | ✅ Pass | Worker creates isolated DB per license, no cross-tenant queries                                   |
| Middleware authority              | ✅ Pass | License validation required before workspace access; PENDING_PROVISION blocks with 423            |
| Authoritative license enforcement | ✅ Pass | Status enum enforced; ACTIVE/PENDING_PROVISION/PROVISION_FAILED states block/allow access         |
| Snapshot-based attempt integrity  | N/A     | Provisioning is not attempt-related                                                               |
| Versioned evolution               | ✅ Pass | schema_version stored in license; migrations applied per version                                  |
| Runtime authoritative time        | ✅ Pass | All timestamps set by Worker server; no client timestamps accepted                                |
| Deterministic worker execution    | ✅ Pass | Idempotent; transactional; validates state before execution                                       |
| Concurrency guarantees            | ✅ Pass | Distributed lock ensures only one provision per license; registry unique constraint               |
| Strict separation of layers       | ✅ Pass | MMC creates license+enqueues; Worker provisions; API never writes DDL                             |
| Security baseline                 | ✅ Pass | JWT workspace scope; RBAC; structured logging; correlation IDs; no secrets in logs                |
| Operational integrity             | ✅ Pass | All mutations in transactions; critical endpoints idempotent; structured logs with correlation_id |

**Re-check Required After Phase 1**: No, all checks completed upfront. Design adheres to
constitution.

---

## Digital Artifacts Structure

### Documentation (this feature)

```text
specs/runtime/012-provisioning-trigger/
├── spec.md              # Feature specification (Clarifications resolved)
├── plan.md              # This file (technical design overview)
├── research.md          # (None required — no unknowns identified)
├── data-model.md        # Entity-relationship design + schema details
├── contracts/           # External interface contracts
│   ├── license-creation-api.md
│   ├── provisioning-job-contract.md
│   └── error-codes.md
└── quickstart.md        # Local development setup
```

### Source Code Structure

Zidney uses a monorepo layout:

```text
apps/
├── api/                           # Hono API layer
│   ├── src/
│   │   ├── middleware/            # License validation, tenant resolver
│   │   │   └── license-middleware.ts
│   │   ├── routes/
│   │   │   └── licenses.ts        # POST /mmc/licenses endpoint
│   │   └── handlers/
│   │       └── provision.ts       # Job enqueue logic
│   └── tests/
│       ├── licenses.test.ts
│       └── provision.test.ts
│
├── worker/                        # Provisioning Worker
│   ├── src/
│   │   ├── jobs/
│   │   │   └── provision-workspace.ts
│   │   ├── services/
│   │   │   ├── database-service.ts
│   │   │   ├── migration-service.ts
│   │   │   ├── seed-service.ts
│   │   │   └── idempotency-service.ts
│   │   ├── queue/
│   │   │   ├── consumer.ts
│   │   │   └── retry-handler.ts
│   │   └── observability/
│   │       └── logging.ts
│   └── tests/
│       ├── unit/
│       │   ├── serialization.test.ts
│       │   ├── idempotency.test.ts
│       │   └── migration-version.test.ts
│       └── integration/
│           ├── full-provision.test.ts
│           ├── failure-recovery.test.ts
│           └── concurrent-provision.test.ts
│
└── mmc/                           # Master Management Console (Svelte UI)
    └── src/
        └── components/
            └── LicenseCreation.vue
```

**Database Structure**:

```text
Master Database (shared):
├── licenses
│   └── Added fields: status, schema_version, product_version, retry_count,
│       last_provision_error, provisioned_at, failed_at
└── tenants_registry (new)
    └── Tracks license→workspace→database mapping

Tenant Database (per workspace):
├── schema_versions
├── roles
├── permissions
├── workspace_settings
├── users (with admin placeholder)
└── divisions (if enabled)
```

---

## Technical Design Overview

### 1. Schema Migration Strategy

**Master Database Migrations**:

```text
apps/api/src/db/master/migrations/
├── 001_add_provisioning_fields_to_licenses.sql  # Add status, version, timestamps
├── 002_create_tenants_registry.sql              # New table for workspace mapping
└── 003_add_provisioning_indexes.sql             # idx_licenses_status, idx_licenses_workspace_slug
```

**Tenant Database Baseline Migrations**:

```text
apps/api/src/db/tenant/migrations/
├── 001_init_schema.sql (idempotent)     # roles, permissions, workspace_settings tables
├── 002_add_divisions.sql                 # divisions table
├── 003_init_baseline_data.sql            # Default roles, permissions, settings
└── schema_versions.sql                   # Track schema version
```

**Migration Sequencing**:

1. Master DB migrations applied first (one-time, not per-tenant)
2. On provision: Tenant DB created → all migrations applied in order → schema_version recorded
3. **Rollback Strategy**: Transaction rollback on failure; partial database dropped by Worker
4. **Idempotency**: All migrations use `CREATE TABLE IF NOT EXISTS` pattern; checksum validation
   prevents re-application

---

### 2. API Contracts

**License Creation Endpoint**:

```
POST /mmc/licenses
Content-Type: application/json
Authorization: Bearer <mmc-service-token>

Request Body:
{
  "workspace_slug": "acme-university-2026",
  "organization_name": "ACME University",
  "admin_email": "admin@acme.edu",
  "product_id": "uuid",
  "student_limit": 5000,
  "staff_limit": 100,
  "uses_divisions": true,
  "correlation_id": "req-uuid-from-client"
}

Response (200 OK):
{
  "success": true,
  "data": {
    "license_id": "uuid",
    "workspace_slug": "acme-university-2026",
    "status": "PENDING_PROVISION",
    "job_id": "uuid",
    "created_at": "2026-02-24T10:00:00Z"
  },
  "error": null
}

Response (400 Bad Request):
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_WORKSPACE_SLUG",
    "message": "Workspace slug does not match pattern: ^[a-z0-9][a-z0-9-]*[a-z0-9]$"
  }
}

Response (409 Conflict):
{
  "success": false,
  "data": null,
  "error": {
    "code": "WORKSPACE_SLUG_EXISTS",
    "message": "Workspace 'acme-university-2026' already registered"
  }
}
```

---

### 3. Worker Implementation Blueprint

**Job Processing Skeleton**:

```typescript
// Worker job entry point
async function provisionWorkspace(job: ProvisioningJob): Promise<void> {
  const { license_id, workspace_slug, correlation_id } = job;

  // Step 1: Validate license exists and is in PENDING_PROVISION state
  const license = await validateLicense(license_id);
  if (!license || license.status !== "PENDING_PROVISION") {
    logger.info("License already provisioned or not found", {
      license_id,
      license_status: license?.status,
    });
    return; // Idempotent success
  }

  // Step 2: Acquire distributed lock to prevent concurrent provisioning
  const lockKey = `provision:license:${license_id}`;
  const lockAcquired = await acquireDistributedLock(lockKey, 30_000); // 30s TTL
  if (!lockAcquired) {
    logger.warn("Failed to acquire lock, retrying", { license_id });
    await enqueueRetry(job);
    return;
  }

  try {
    // Step 3: Validate slug uniqueness
    const existingRegistry = await queryRegistry(license_id);
    if (existingRegistry) {
      logger.info("Registry entry exists, provisioning already complete", {
        license_id,
      });
      return; // Idempotent
    }

    // Step 4: Create tenant database
    const dbName = `workspace_${workspace_slug.replace(/-/g, "_")}`;
    await createDatabase(dbName);

    // Step 5: Connect to tenant database and begin transaction
    const tenantConn = await connectToTenant(dbName, license.schema_version);

    await tenantConn.transaction(async (trx) => {
      // Step 6: Run baseline migrations
      await applyMigrations(trx, license.schema_version);

      // Step 7: Seed baseline data (hybrid approach per Q2)
      await seedBaselineData(trx, license, job);

      // Step 8: Create workspace admin account
      await createAdminAccount(trx, job.admin_email, job.workspace_slug);

      // Step 9: Insert tenants_registry entry on master DB (within transaction context)
      const masterConn = await getPoolManager().getMasterPool();
      await masterConn.query(
        `INSERT INTO tenants_registry (license_id, workspace_slug, db_name, schema_version, created_at)
         VALUES ($1, $2, $3, $4, now())`,
        [license_id, workspace_slug, dbName, license.schema_version],
      );
    }); // End transaction

    // Step 10: Update license status to ACTIVE
    const masterConn = await getPoolManager().getMasterPool();
    await masterConn.query(
      `UPDATE licenses SET status = 'ACTIVE', provisioned_at = now()
       WHERE id = $1`,
      [license_id],
    );

    // Step 11: Release distributed lock
    await releaseDistributedLock(lockKey);

    // Step 12: Log structured success
    logger.info("Provisioning completed successfully", {
      license_id,
      workspace_slug,
      db_name: dbName,
      duration_ms: Date.now() - job.enqueued_at,
      correlation_id,
    });
  } catch (error) {
    // Handle failure: rollback, cleanup, mark PROVISION_FAILED
    await handleProvisioningFailure(license_id, workspace_slug, error, correlation_id);
  } finally {
    // Always release lock
    await releaseDistributedLock(lockKey).catch((err) =>
      logger.error("Failed to release lock", { license_id, error: err.message }),
    );
  }
}

// Failure handler
async function handleProvisioningFailure(
  license_id: string,
  workspace_slug: string,
  error: Error,
  correlation_id: string,
): Promise<void> {
  const dbName = `workspace_${workspace_slug.replace(/-/g, "_")}`;

  // Attempt to clean up partial database with retries (per Q4)
  let dropAttempts = 0;
  while (dropAttempts < 3) {
    try {
      await dropDatabase(dbName);
      logger.info("Database dropped after failure", {
        license_id,
        db_name: dbName,
      });
      break;
    } catch (dropError) {
      dropAttempts++;
      if (dropAttempts < 3) {
        const backoffMs = Math.pow(2, dropAttempts) * 1000; // Exponential backoff
        await delay(backoffMs);
      } else {
        logger.error("Failed to drop database after max retries", {
          license_id,
          db_name: dbName,
          error: dropError.message,
        });
      }
    }
  }

  // Mark license as PROVISION_FAILED
  const masterConn = await getPoolManager().getMasterPool();
  await masterConn.query(
    `UPDATE licenses 
     SET status = 'PROVISION_FAILED', 
         failed_at = now(),
         retry_count = retry_count + 1,
         last_provision_error = $1
     WHERE id = $2`,
    [error.message.substring(0, 1024), license_id],
  );

  logger.error("Provisioning failed", {
    license_id,
    workspace_slug,
    error_message: error.message,
    error_code: classifyError(error),
    correlation_id,
  });
}
```

**Validation Checks**:

- License exists in master_db.licenses
- License.status = PENDING_PROVISION (idempotent check)
- Workspace slug matches regex pattern
- Slug not already in tenants_registry
- Database creation succeeds
- All migrations pass SQL syntax validation
- Admin email contains @ symbol (basic validation)

**Error Handlers**:

```typescript
enum ProvisioningErrorCode {
  LICENSE_NOT_FOUND = "LICENSE_NOT_FOUND",
  INVALID_LICENSE_STATUS = "INVALID_LICENSE_STATUS",
  INVALID_WORKSPACE_SLUG = "INVALID_WORKSPACE_SLUG",
  DATABASE_CREATION_FAILED = "DATABASE_CREATION_FAILED",
  MIGRATION_FAILED = "MIGRATION_FAILED",
  SEED_DATA_FAILED = "SEED_DATA_FAILED",
  ADMIN_ACCOUNT_FAILED = "ADMIN_ACCOUNT_FAILED",
  REGISTRY_INSERT_FAILED = "REGISTRY_INSERT_FAILED",
  LOCK_TIMEOUT = "LOCK_TIMEOUT",
  NETWORK_PARTITION = "NETWORK_PARTITION",
}

// Each error type maps to recovery action
// - DB_CREATE_FAILED → Mark PROVISION_FAILED, retry
// - MIGRATION_FAILED → Mark PROVISION_FAILED, operator reviews code
// - LOCK_TIMEOUT → Enqueue retry (max 3 times)
// - NETWORK_PARTITION → Reconnect for 60s, then mark PROVISION_FAILED
```

**Logging Instrumentation** (every event emits):

```json
{
  "timestamp": "ISO-8601",
  "level": "info|warn|error",
  "service": "provisioning-worker",
  "correlation_id": "...",
  "license_id": "...",
  "workspace_slug": "...",
  "db_name": "...",
  "event": "provisioning_started|step_completed|provisioning_success|provisioning_failed",
  "step": "license_validation|database_creation|migration_start|migration_complete|seed_data|admin_account|registry_insert",
  "duration_ms": "...",
  "retry_count": 0,
  "status": "PENDING_PROVISION|PROVISION_FAILED|ACTIVE"
}
```

---

### 4. Data Model Detailed Design

**Master DB: licenses Table (ADD COLUMNS)**

```sql
ALTER TABLE licenses ADD COLUMN (
  status varchar(32) DEFAULT 'PENDING_PROVISION'
    CHECK (status IN ('PENDING_PROVISION', 'ACTIVE', 'PROVISION_FAILED')),
  schema_version varchar(50) NOT NULL,
  product_version varchar(50) NOT NULL,
  retry_count int DEFAULT 0,
  last_provision_error varchar(1024),
  provisioned_at timestamp,
  failed_at timestamp
);

CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_workspace_slug ON licenses(workspace_slug);
CREATE INDEX idx_licenses_created_at ON licenses(created_at DESC);
```

**Master DB: tenants_registry Table (CREATE)**

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

**Tenant DB Baseline Schema**:

```sql
-- Per-tenant database: workspace_<slug>

CREATE TABLE schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version varchar(50) NOT NULL,
  applied_at timestamp NOT NULL DEFAULT now(),
  checksum varchar(128) NOT NULL,
  UNIQUE(version)
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  description varchar(500),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  description varchar(500),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key varchar(255) NOT NULL UNIQUE,
  setting_value text NOT NULL,
  value_type varchar(50) NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  code varchar(50) UNIQUE,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  first_name varchar(100),
  last_name varchar(100),
  password_hash varchar(255) NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id),
  verified_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
```

---

### 5. Transaction Blueprints

**Atomic Provisioning Transaction**:

```
BEGIN TRANSACTION (tenant_db)
  ┌─ Step 1: Apply Migrations
  │   └─ For each migration file:
  │      ├─ Execute SQL
  │      ├─ Insert into schema_versions (version, checksum, applied_at)
  │      └─ If fails: ROLLBACK ALL
  │
  ├─ Step 2: Seed Default Data
  │  │  ├─ Insert default roles (ADMIN, STAFF, STUDENT, SUPPORT)
  │  │  ├─ Insert default permissions (CREATE_EXAM, GRADE_EXAM, VIEW_REPORTS, etc.)
  │  │  ├─ Insert workspace_settings (student_limit, staff_limit, default_language)
  │  │  └─ If fails: ROLLBACK ALL
  │  │
  │  ├─ Step 3: Create Admin Account
  │  │  ├─ Hash password with bcrypt (rounds=12)
  │  │  ├─ Insert into users (email, password_hash, role_id=ADMIN_ROLE)
  │  │  ├─ Set verified_at = now()
  │  │  └─ If fails: ROLLBACK ALL
  │  │
  │  ├─ Step 4 (optional): Create Default Division
  │  │  └─ If uses_divisions=true:
  │  │     ├─ Insert into divisions (name='Default Division', code='DEFAULT')
  │  │     └─ If fails: ROLLBACK ALL
  │  │
  │  └─ Step 5: Insert Registry Entry (on master_db within trx context)
  │     ├─ Master pool query: INSERT INTO tenants_registry
  │     ├─ Fields: license_id, workspace_slug, db_name, schema_version, created_at
  │     └─ If fails: ROLLBACK ALL (entire tenant transaction rolls back)
  │
COMMIT TRANSACTION

IF COMMIT SUCCEEDS:
  ├─ Step 6 (post-commit): Update License Status
  │  ├─ Master DB: UPDATE licenses SET status='ACTIVE', provisioned_at=now()
  │  └─ If update fails: License stuck in PENDING_PROVISION (idempotent retry)
  │
  └─ Step 7 (post-commit): Structured logging
     └─ Emit success event with correlation_id, license_id, workspace_slug, duration_ms

IF COMMIT FAILS (any step):
  ├─ Automatic ROLLBACK
  ├─ Clean up: DROP DATABASE workspace_<slug>
  ├─ Update: license.status = PROVISION_FAILED, last_provision_error = error_msg
  └─ Re-enqueue: job for retry (max 3 retries with backoff)
```

**Savepoint Strategy** (optional for cross-DB operations):

```
-- Savepoint for registry insert (master DB operation within tenant transaction)
SAVEPOINT registry_insert;
  INSERT INTO master_db.tenants_registry (...) VALUES (...);
IF error:
  ROLLBACK TO SAVEPOINT registry_insert;
  -- Entire tenant transaction still intact; can retry
```

**Idempotent Retry Within Transaction**:

```
-- On retry, before transaction:
IF tenants_registry entry exists for license_id:
  RETURN success (no need for transaction)

IF license.status = ACTIVE:
  RETURN success (no need for transaction)

-- If partial database exists:
  DROP DATABASE workspace_<slug>;
  -- Now proceed with normal transaction
```

---

### 6. Idempotency Implementation

**Redis Distributed Lock**:

```typescript
// Lock acquisition
const lockKey = `provision:license:${license_id}`;
const lockValue = Date.now().toString(); // Unique token
const lockAcquired = await redis.set(
  lockKey,
  lockValue,
  "EX",
  30, // 30-second TTL
  "NX", // Only set if not exists
);

// Lock release (must use script to ensure owner releases)
const luaScript = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;
await redis.eval(luaScript, 1, lockKey, lockValue);

// Retry on lock timeout
if (!lockAcquired) {
  const retries = job.retry_count || 0;
  if (retries < 3) {
    const backoffMs = Math.pow(2, retries) * 1000; // 1s, 2s, 4s
    await enqueueRetry(job, retries + 1, backoffMs);
  } else {
    logger.error("Lock timeout max retries exceeded", { license_id });
    await markProvisioningFailed(license_id, "LOCK_TIMEOUT");
  }
}
```

**Idempotency Key Model**:

```typescript
// Primary idempotency check
async function checkIdempotency(
  license_id: string,
): Promise<"already_provisioned" | "needs_provisioning" | "needs_cleanup"> {
  // Check 1: Is there a registry entry?
  const registryEntry = await queryRegistry(license_id);
  if (registryEntry) {
    return "already_provisioned"; // Success
  }

  // Check 2: What's the license status?
  const license = await queryLicense(license_id);
  if (license.status === "ACTIVE") {
    return "already_provisioned"; // Shouldn't happen, but handle it
  }

  if (license.status !== "PENDING_PROVISION") {
    return "already_provisioned"; // Different state (shouldn't happen)
  }

  // Check 3: Does partial database exist?
  const dbExists = await databaseExists(license.workspace_slug);
  if (dbExists) {
    return "needs_cleanup"; // Orphan database, clean it up first
  }

  return "needs_provisioning"; // Normal path
}

// During provisioning
const status = await checkIdempotency(license_id);
switch (status) {
  case "already_provisioned":
    logger.info("License already provisioned", { license_id });
    return; // Exit successfully

  case "needs_cleanup":
    logger.info("Cleaning up orphan database", { license_id });
    await dropDatabase(license.workspace_slug);
  // Fall through to provision

  case "needs_provisioning":
    // Normal provisioning flow
    // ... (steps 1-11 from blueprint above)
    return;
}
```

**Replay Safety**:

- ✅ Registry unique constraint on (license_id) prevents duplicate entries
- ✅ License status acts as secondary idempotency signal (ACTIVE = already done)
- ✅ Distributed lock prevents two Workers from provisioning same license concurrently
- ✅ All migrations are idempotent (CREATE IF NOT EXISTS patterns)
- ✅ Admin account creation uses email uniqueness; retry finds existing user

---

### 7. Integration Points

**Queue Producer (MMC → Redis)**:

```typescript
// In API endpoint POST /mmc/licenses

async function createLicense(req: Request): Promise<Response> {
  const { workspace_slug, admin_email, product_id, uses_divisions } = req.body;

  // Validate input
  validateWorkspaceSlug(workspace_slug);

  // Check uniqueness in registry
  const existingRegistry = await queryRegistry(workspace_slug);
  if (existingRegistry) {
    return error(409, "WORKSPACE_SLUG_EXISTS");
  }

  // Create license record in master DB
  const license = await masterDb.query(
    `INSERT INTO licenses 
     (workspace_slug, product_id, schema_version, product_version, status)
     VALUES ($1, $2, $3, $4, 'PENDING_PROVISION')
     RETURNING *`,
    [workspace_slug, product_id, platform.schema_version, platform.product_version],
  );

  // Enqueue provisioning job (with deduplication per Q5)
  const job = {
    job_type: "PROVISION_WORKSPACE",
    job_id: generateUUID(),
    license_id: license.id,
    workspace_slug,
    product_id,
    uses_divisions,
    correlation_id: req.headers["x-correlation-id"],
    enqueued_at: new Date().toISOString(),
    max_retries: 3,
  };

  // Deduplicate at enqueue time by license_id (drop duplicates)
  const existingJob = await redis.getex(`pending:license:${license.id}`);
  if (existingJob) {
    logger.warn("Duplicate enqueue detected, dropping new job", {
      license_id: license.id,
    });
    return success({ license_id: license.id, status: "PENDING_PROVISION" });
  }

  // Enqueue to Redis queue
  await redis.lpush("provisioning:queue", JSON.stringify(job));
  await redis.setex(`pending:license:${license.id}`, 300, "1"); // 5-min pending marker

  return success({
    license_id: license.id,
    workspace_slug,
    status: "PENDING_PROVISION",
    job_id: job.job_id,
  });
}
```

**Queue Consumer (Worker ← Redis)**:

```typescript
// Worker main loop

async function consumeQueue(): Promise<void> {
  while (true) {
    try {
      const jobJson = await redis.rpop("provisioning:queue", "BLOCK", 10);
      if (!jobJson) continue;

      const job = JSON.parse(jobJson);

      try {
        await provisionWorkspace(job);
      } catch (error) {
        logger.error("Job processing failed", {
          job_id: job.job_id,
          error: error.message,
        });

        // Re-enqueue with retry logic
        if (job.retry_count < job.max_retries) {
          const backoffMs = Math.pow(2, job.retry_count) * 1000;
          await redis.delayed_push(
            "provisioning:queue",
            JSON.stringify({ ...job, retry_count: (job.retry_count || 0) + 1 }),
            backoffMs,
          );
        } else {
          // Max retries exceeded, enqueue to DLQ
          await enqueueToDLQ(job, error);
        }
      }

      // Clear pending marker
      await redis.del(`pending:license:${job.license_id}`);
    } catch (error) {
      logger.error("Queue consumer error", { error: error.message });
      await delay(5000); // Back off before retrying
    }
  }
}
```

**DLQ Handling**:

```typescript
// Dead-Letter Queue for persistent failures

const dlqSchema = {
  id: uuid,
  job: ProvisioningJob,
  error: string,
  error_code: string,
  retry_count: number,
  failed_at: timestamp,
  attempted_recovery: boolean,
};

// DLQ consumer (runs on-demand or periodically)
async function processDLQ(): Promise<void> {
  const dlqJobs = await redis.lrange("provisioning:dlq", 0, -1);

  for (const jobJson of dlqJobs) {
    const dlqEntry = JSON.parse(jobJson);

    // Log for operator review
    logger.error("DLQ entry requires operator intervention", {
      license_id: dlqEntry.job.license_id,
      workspace_slug: dlqEntry.job.workspace_slug,
      error_code: dlqEntry.error_code,
      attempts: dlqEntry.retry_count,
    });

    // Update license status to assist operator
    await masterDb.query(
      `UPDATE licenses SET status = 'PROVISION_FAILED', last_provision_error = $1
       WHERE id = $2`,
      [dlqEntry.error, dlqEntry.job.license_id],
    );
  }
}
```

---

### 8. Observability Wiring

**Structured Logger Setup** (correlation_id propagation):

```typescript
// Logger middleware in API
const logger = createStructuredLogger({
  service: "zidney-api",
  environment: process.env.NODE_ENV,
});

app.use(async (req, res, next) => {
  const correlation_id = req.headers["x-correlation-id"] || generateUUID();

  // Store in context for downstream use
  req.context = { correlation_id, user_id: req.user?.id };

  res.setHeader("x-correlation-id", correlation_id);
  next();
});

// Logger instance with context
function logWithContext(level, message, data) {
  logger.log({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
    correlation_id: req.context.correlation_id,
  });
}
```

**Correlation_id Propagation**:

```typescript
// In provisioning job
const job = {
  // ... other fields
  correlation_id: req.headers["x-correlation-id"], // From API request
  // ...
};

// Worker receives job and logs with same correlation_id
logger.info("Provisioning started", {
  license_id: job.license_id,
  correlation_id: job.correlation_id, // Same trace across API→Queue→Worker
  workspace_slug: job.workspace_slug,
});

// All logs under same correlation_id are grouped together
// Enables end-to-end tracing: API request → Job enqueue → Worker execution → License update
```

**Log Aggregation Schema**:

```json
{
  "timestamp": "2026-02-24T10:05:30.123Z",
  "level": "info",
  "service": "provisioning-worker",
  "correlation_id": "req-uuid-from-mmc",
  "license_id": "license-uuid",
  "workspace_slug": "acme-university-2026",
  "db_name": "workspace_acme_university_2026",
  "event": "provisioning_started|step_completed|provisioning_success|provisioning_failed",
  "step": "license_validation|database_creation|migration_applied|seed_roles|admin_created|registry_inserted",
  "duration_ms": 5032,
  "attempt_number": 1,
  "retry_count": 0,
  "status": "ACTIVE|PROVISION_FAILED",
  "error_code": "DB_CREATE_FAILED|MIGRATION_FAILED|LOCK_TIMEOUT|null",
  "error_message": "descriptive error or null",
  "environment": "production|staging"
}
```

**Metrics Instrumentation**:

```typescript
// Metrics exported to Prometheus

// Histogram: provisioning duration
metrics.histogramObserve("provisioning.duration_ms", duration, {
  status: "success|failure",
  error_code: error?.code || "none",
});

// Counter: provisioning outcomes
metrics.counterIncrement("provisioning.success_count");
metrics.counterIncrement("provisioning.failure_count", 1, { error_code });
metrics.counterIncrement("provisioning.retry_count", 1, { attempt: 2 });

// Histogram: lock acquisition time
metrics.histogramObserve("provisioning.lock_wait_ms", lockWaitTime);

// Gauge: current active workspaces (query tenants_registry)
const activeWorkspaces = await queryRegistry("COUNT(*)");
metrics.gaugeSet("tenants_registry.total_workspaces", activeWorkspaces);

// Histogram: migration execution per step
metrics.histogramObserve("provisioning.migration_duration_ms", migrationTime, {
  migration: "init_schema|baseline_data|divisions",
});
```

---

### 9. Test Harness Design

**Unit Test Scaffold**:

```typescript
// tests/unit/idempotency.test.ts
describe("Idempotency Service", () => {
  test("should detect already-provisioned license", async () => {
    const license_id = "uuid-123";
    const registry_entry = {
      license_id,
      workspace_slug: "acme-2026",
      db_name: "workspace_acme_2026",
    };

    // Mock registry entry exists
    jest.spyOn(registry, "query").mockResolvedValueOnce([registry_entry]);

    const result = await checkIdempotency(license_id);
    expect(result).toBe("already_provisioned");
  });

  test("should detect orphan database", async () => {
    const license_id = "uuid-123";
    jest.spyOn(registry, "query").mockResolvedValueOnce([]); // No registry entry
    jest.spyOn(license, "query").mockResolvedValueOnce({
      status: "PENDING_PROVISION",
    });
    jest.spyOn(database, "exists").mockResolvedValueOnce(true); // DB exists

    const result = await checkIdempotency(license_id);
    expect(result).toBe("needs_cleanup");
  });
});

// tests/unit/migration-version.test.ts
describe("Migration Version Comparison", () => {
  test("should apply all migrations up to license.schema_version", async () => {
    const license = { schema_version: "1.2.0" };
    const migrations = [
      { version: "1.0.0", file: "001_init.sql" },
      { version: "1.1.0", file: "002_add_divisions.sql" },
      { version: "1.2.0", file: "003_add_settings.sql" },
    ];

    const toApply = migrations.filter(
      (m) => compareVersions(m.version, license.schema_version) <= 0,
    );
    expect(toApply).toHaveLength(3);
  });
});
```

**Integration Test Scaffold**:

```typescript
// tests/integration/full-provision.test.ts
describe("Full Provisioning Flow", () => {
  let masterDb, redis;

  beforeAll(async () => {
    masterDb = await setupTestDatabase("master");
    redis = await setupTestRedis();
  });

  afterEach(async () => {
    await cleanupTenantDatabase("workspace_test_acme");
    await redis.flushdb();
  });

  test("should provision workspace end-to-end", async () => {
    // Step 1: Create license via API
    const postLicenseResponse = await api.post("/mmc/licenses", {
      workspace_slug: "test-acme",
      admin_email: "admin@acme.test",
      product_id: "product-123",
      uses_divisions: true,
      correlation_id: "corr-123",
    });

    const license_id = postLicenseResponse.data.license_id;
    expect(postLicenseResponse.status).toBe(200);

    // Step 2: Verify license created in PENDING_PROVISION state
    const license = await masterDb.query("SELECT * FROM licenses WHERE id = ?", [license_id]);
    expect(license.status).toBe("PENDING_PROVISION");

    // Step 3: Job enqueued to Redis
    const jobs = await redis.lrange("provisioning:queue", 0, -1);
    expect(jobs.length).toBe(1);

    // Step 4: Process job (simulate Worker)
    await provisionWorkspace(JSON.parse(jobs[0]));

    // Step 5: Verify license now ACTIVE
    const updatedLicense = await masterDb.query("SELECT * FROM licenses WHERE id = ?", [
      license_id,
    ]);
    expect(updatedLicense.status).toBe("ACTIVE");
    expect(updatedLicense.provisioned_at).not.toBeNull();

    // Step 6: Verify registry entry created
    const registry = await masterDb.query("SELECT * FROM tenants_registry WHERE license_id = ?", [
      license_id,
    ]);
    expect(registry.workspace_slug).toBe("test-acme");
    expect(registry.db_name).toBe("workspace_test_acme");

    // Step 7: Verify tenant database created
    const tenantDb = await connectToTenant("workspace_test_acme");
    const schemaVersion = await tenantDb.query("SELECT version FROM schema_versions");
    expect(schemaVersion.length).toBeGreaterThan(0);

    // Step 8: Verify admin user created
    const admin = await tenantDb.query("SELECT * FROM users WHERE email = ?", ["admin@acme.test"]);
    expect(admin.role_id).toBeTruthy();
  });

  test("should handle failure recovery", async () => {
    // Enqueue job that will fail (e.g., bad workspace slug)
    const failingJob = {
      job_id: "job-123",
      license_id: "license-123",
      workspace_slug: "invalid@slug", // Invalid character
      // ...
    };

    await redis.lpush("provisioning:queue", JSON.stringify(failingJob));

    // Process (should catch validation error)
    await provisionWorkspace(failingJob).catch((err) => {
      expect(err.message).toMatch(/INVALID_WORKSPACE_SLUG/);
    });

    // Verify license marked PROVISION_FAILED
    const license = await masterDb.query("SELECT * FROM licenses WHERE id = ?", ["license-123"]);
    expect(license.status).toBe("PROVISION_FAILED");
    expect(license.last_provision_error).toMatch(/invalid/i);

    // Verify job re-enqueued for retry
    const jobs = await redis.lrange("provisioning:queue", 0, -1);
    expect(jobs.length).toBe(1); // Re-enqueued
  });

  test("should block workspace access until ACTIVE", async () => {
    // Create license (status=PENDING_PROVISION)
    const license_id = await createLicense("test-acme");

    // Attempt to access workspace
    const loginResponse = await api.post("/login", {
      email: "user@acme.test",
      workspace_slug: "test-acme",
    });

    // Should be blocked (423 Locked)
    expect(loginResponse.status).toBe(423);
    expect(loginResponse.data.error.code).toBe("WORKSPACE_LOCKED");

    // Provision workspace
    const job = await redis.rpop("provisioning:queue");
    await provisionWorkspace(JSON.parse(job));

    // Now login should work
    const loginResponse2 = await api.post("/login", {
      email: "admin@acme.test",
      workspace_slug: "test-acme",
    });
    expect(loginResponse2.status).toBe(200);
  });
});

// tests/integration/concurrent-provision.test.ts
describe("Concurrent Provisioning", () => {
  test("should prevent concurrent provisioning of same license", async () => {
    const license_id = "license-123";

    // Enqueue two identical provisioning jobs
    const job1 = { license_id, workspace_slug: "test-acme" /* ... */ };
    const job2 = { license_id, workspace_slug: "test-acme" /* ... */ };

    await redis.lpush("provisioning:queue", JSON.stringify(job1));
    await redis.lpush("provisioning:queue", JSON.stringify(job2));

    // Start two workers
    const [result1, result2] = await Promise.all([
      provisionWorkspace(job1),
      provisionWorkspace(job2),
    ]);

    // One should succeed, other should timeout on lock (and retry)
    const license = await masterDb.query("SELECT * FROM licenses WHERE id = ?", [license_id]);
    expect(license.status).toBe("ACTIVE"); // Successfully provisioned once

    // Verify only one database created
    const databases = await queryDatabases("%test_acme%");
    expect(databases.length).toBe(1);
  });
});
```

**Idempotency Replay Rig**:

```typescript
// tests/integration/idempotency-replay.test.ts
describe("Idempotency Replay Scenarios", () => {
  test("should handle duplicate job delivery", async () => {
    const license_id = "license-123";
    const job = {
      job_id: "job-123", // Same job_id for both deliveries
      license_id,
      workspace_slug: "test-acme",
      /* ... */
    };

    // First delivery: provisions workspace successfully
    await provisionWorkspace(job);

    // Verify ACTIVE
    let license = await masterDb.query("SELECT * FROM licenses WHERE id = ?", [license_id]);
    expect(license.status).toBe("ACTIVE");

    // Second delivery: same job (simulating queue redelivery)
    await provisionWorkspace(job); // Should return early (idempotent)

    // Verify still ACTIVE (no re-provisioning)
    license = await masterDb.query("SELECT * FROM licenses WHERE id = ?", [license_id]);
    expect(license.status).toBe("ACTIVE");
    expect(license.provisioned_at).toStrictEqual(/* first attempt time */);

    // Verify only one database created
    const databases = await queryDatabases("%test_acme%");
    expect(databases.length).toBe(1);
  });

  test("should clean up orphan database on retry", async () => {
    const license_id = "license-123";
    const workspace_slug = "test-acme";

    // Simulate first attempt that created DB but failed before registry insert
    await createDatabase(`workspace_${workspace_slug}`);

    // Mark license PROVISION_FAILED
    await masterDb.query("UPDATE licenses SET status = ? WHERE id = ?", [
      "PROVISION_FAILED",
      license_id,
    ]);

    // Retry provisioning
    const job = {
      job_id: "job-123",
      license_id,
      workspace_slug,
      /* ... */
    };

    await provisionWorkspace(job);

    // Verify:
    // 1. Database exists (recreated after cleanup)
    const databases = await queryDatabases("%test_acme%");
    expect(databases.length).toBe(1);

    // 2. Registry entry created
    const registry = await masterDb.query("SELECT * FROM tenants_registry WHERE license_id = ?", [
      license_id,
    ]);
    expect(registry).toBeTruthy();

    // 3. License ACTIVE
    const license = await masterDb.query("SELECT * FROM licenses WHERE id = ?", [license_id]);
    expect(license.status).toBe("ACTIVE");
  });
});
```

---

### 10. Retry/Backoff Logic

**Per Clarifications (Q1, Q4)**:

```typescript
// Network partition recovery (Q1)
async function executeWithReconnect(
  operation: () => Promise<any>,
  timeoutMs = 60_000,
): Promise<any> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      return await operation();
    } catch (error) {
      if (isNetworkError(error)) {
        const elapsedMs = Date.now() - startTime;
        if (elapsedMs < timeoutMs) {
          const backoffMs = Math.min(1000, 100 * Math.pow(2, retryCount));
          logger.warn("Network error, reconnecting...", {
            elapsed_ms: elapsedMs,
            backoff_ms: backoffMs,
          });
          await delay(backoffMs);
          retryCount++;
          continue;
        }
      }
      throw error;
    }
  }

  throw new Error("Network partition exceeded 60s timeout");
}

// Database drop/create retries (Q4)
async function dropDatabaseWithRetry(dbName: string, maxRetries = 3): Promise<void> {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await masterDb.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      logger.info("Database dropped", { db_name: dbName, attempt: attempt + 1 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const backoffMs = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        logger.warn("DROP DATABASE failed, retrying...", {
          db_name: dbName,
          attempt: attempt + 1,
          backoff_ms: backoffMs,
          error: error.message,
        });
        await delay(backoffMs);
      }
    }
  }

  // Max retries exceeded
  logger.error("DROP DATABASE max retries exceeded", {
    db_name: dbName,
    attempts: maxRetries,
    error: lastError.message,
  });

  throw new Error(`Failed to drop database after ${maxRetries} attempts: ${lastError.message}`);
}

// Job retry with exponential backoff
async function enqueueRetryWithBackoff(job: ProvisioningJob, maxRetries = 3): Promise<void> {
  const currentRetry = (job.retry_count || 0) + 1;

  if (currentRetry > maxRetries) {
    logger.error("Max job retries exceeded, enqueueing to DLQ", {
      job_id: job.job_id,
      license_id: job.license_id,
      attempts: currentRetry,
    });
    await enqueueToDLQ(job, "MAX_RETRIES_EXCEEDED");
    return;
  }

  const backoffMs = Math.pow(2, currentRetry - 1) * 1000; // 1s, 2s, 4s
  const retryJob = { ...job, retry_count: currentRetry };

  // Use delayed queue (Redis with expiry) or schedule with a scheduler
  await redis.zadd(
    "provisioning:queue:scheduled",
    Date.now() + backoffMs,
    JSON.stringify(retryJob),
  );

  logger.info("Job enqueued for retry", {
    job_id: job.job_id,
    license_id: job.license_id,
    retry_count: currentRetry,
    backoff_ms: backoffMs,
  });
}
```

---

### 11. Seed Data Initialization

**Per Clarifications (Q2 — Hybrid Approach)**:

```typescript
// Hybrid: Platform-generic baseline + tenant-specific hooks

async function seedBaselineData(
  trx: Transaction,
  license: License,
  job: ProvisioningJob,
): Promise<void> {
  // Phase 1: Platform-generic baseline (always)
  await seedDefaultRoles(trx);
  await seedDefaultPermissions(trx);
  await seedDefaultSettings(trx, license);

  if (job.uses_divisions) {
    await seedDefaultDivision(trx);
  }

  // Phase 2: Tenant-specific hooks (optional)
  // Could be extended later with product_id-specific customizations
  // E.g., if product_id = 'lms', seed additional LMS-specific roles
  if (license.product_id === "lms") {
    await seedLMSSpecificRoles(trx);
  }
}

async function seedDefaultRoles(trx: Transaction): Promise<void> {
  const roles = [
    { name: "ADMIN", description: "Workspace administrator" },
    { name: "STAFF", description: "Staff member" },
    { name: "STUDENT", description: "Student" },
    { name: "SUPPORT", description: "Support staff" },
  ];

  for (const role of roles) {
    await trx.query(
      `INSERT INTO roles (name, description, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (name) DO NOTHING`,
      [role.name, role.description],
    );
  }
}

async function seedDefaultPermissions(trx: Transaction): Promise<void> {
  const permissions = [
    { name: "CREATE_EXAM", description: "Create examinations" },
    { name: "GRADE_EXAM", description: "Grade examinations" },
    { name: "VIEW_REPORTS", description: "View analytics reports" },
    { name: "MANAGE_STUDENTS", description: "Manage student accounts" },
    { name: "MANAGE_STAFF", description: "Manage staff accounts" },
    // ... more permissions
  ];

  for (const perm of permissions) {
    await trx.query(
      `INSERT INTO permissions (name, description, created_at)
       VALUES ($1, $2, now())
       ON CONFLICT (name) DO NOTHING`,
      [perm.name, perm.description],
    );
  }
}

async function seedDefaultSettings(trx: Transaction, license: License): Promise<void> {
  const settings = [
    {
      setting_key: "STUDENT_LIMIT",
      setting_value: license.student_limit.toString(),
      value_type: "number",
    },
    {
      setting_key: "STAFF_LIMIT",
      setting_value: license.staff_limit.toString(),
      value_type: "number",
    },
    {
      setting_key: "DEFAULT_LANGUAGE",
      setting_value: "en",
      value_type: "string",
    },
    {
      setting_key: "TIMEZONE",
      setting_value: "UTC",
      value_type: "string",
    },
  ];

  for (const setting of settings) {
    await trx.query(
      `INSERT INTO workspace_settings (setting_key, setting_value, value_type, created_at, updated_at)
       VALUES ($1, $2, $3, now(), now())
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2`,
      [setting.setting_key, setting.setting_value, setting.value_type],
    );
  }
}
```

---

### 12. Admin Invite Flow

**Per Clarifications (Q3 — Worker creates placeholder, MMC triggers invite)**:

```typescript
// Worker: Create admin account placeholder
async function createAdminAccount(
  trx: Transaction,
  admin_email: string,
  workspace_slug: string,
): Promise<string> {
  // Generate temporary password (will be overridden by invite)
  const tempPassword = generateSecureRandomPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const result = await trx.query(
    `INSERT INTO users (email, first_name, last_name, password_hash, role_id, created_at, updated_at)
     SELECT $1, 'Admin', 'Placeholder', $2, id, now(), now()
     FROM roles WHERE name = 'ADMIN'
     RETURNING id`,
    [admin_email, passwordHash],
  );

  const admin_user_id = result.rows[0].id;

  logger.info("Admin account created", {
    admin_email,
    admin_user_id,
    workspace_slug,
    note: "Password will be set via invite flow",
  });

  return admin_user_id;
}

// After Worker finishes: MMC API triggers invite
async function triggerAdminInvite(
  license_id: string,
  admin_email: string,
  workspace_slug: string,
): Promise<void> {
  // Verify provisioning is complete
  const license = await masterDb.query("SELECT * FROM licenses WHERE id = ? AND status = ?", [
    license_id,
    "ACTIVE",
  ]);

  if (!license) {
    throw new Error("License not yet ACTIVE");
  }

  // Generate invite token
  const inviteToken = generateSecureToken();
  await redis.setex(
    `invite:${inviteToken}`,
    86400 * 7, // 7 days
    JSON.stringify({
      admin_email,
      workspace_slug,
      expires_at: Date.now() + 86400 * 7 * 1000,
    }),
  );

  // Send invite email
  await emailService.send({
    to: admin_email,
    subject: `Invited to ${workspace_slug} workspace`,
    template: "admin-invite",
    context: {
      workspace_slug,
      invite_link: `https://app.zidney.com/invite/${inviteToken}`,
      expires_in_days: 7,
    },
  });

  logger.info("Admin invite sent", {
    admin_email,
    workspace_slug,
    invite_token: inviteToken.substring(0, 8) + "***",
  });
}

// POST /invite/:token
async function acceptInvite(req: Request): Promise<Response> {
  const { token } = req.params;
  const { password } = req.body;

  // Retrieve invite from Redis
  const inviteJson = await redis.getdel(`invite:${token}`);
  if (!inviteJson) {
    return error(410, "INVITE_EXPIRED_OR_INVALID");
  }

  const invite = JSON.parse(inviteJson);
  const { admin_email, workspace_slug } = invite;

  // Connect to tenant database
  const registry = await masterDb.query(
    "SELECT db_name FROM tenants_registry WHERE workspace_slug = ?",
    [workspace_slug],
  );

  const tenantDb = await getTenantPool(registry.db_name);

  // Update admin user password
  const passwordHash = await bcrypt.hash(password, 12);
  await tenantDb.query("UPDATE users SET password_hash = ?, verified_at = now() WHERE email = ?", [
    passwordHash,
    admin_email,
  ]);

  logger.info("Admin account activated", {
    admin_email,
    workspace_slug,
  });

  return success({
    message: "Admin account activated",
    redirect_to: `/login?workspace=${workspace_slug}`,
  });
}
```

---

### 13. Deduplication Strategy

**Per Clarifications (Q5 — Drop duplicates at enqueue time)**:

```typescript
// Deduplication at enqueue time by license_id

async function enqueueLicenseProvisioningJob(
  jobPayload: ProvisioningJob,
): Promise<{ enqueued: boolean; reason: string }> {
  const { license_id, workspace_slug } = jobPayload;

  // Check if already pending
  const pendingKey = `pending:license:${license_id}`;
  const alreadyPending = await redis.get(pendingKey);

  if (alreadyPending) {
    logger.warn("Duplicate job dropped (already pending)", {
      license_id,
      workspace_slug,
    });
    return { enqueued: false, reason: "DUPLICATE_PENDING" };
  }

  // Check if already provisioned
  const registry = await masterDb.query("SELECT * FROM tenants_registry WHERE license_id = ?", [
    license_id,
  ]);

  if (registry) {
    logger.warn("Duplicate job dropped (already provisioned)", {
      license_id,
      workspace_slug,
    });
    return { enqueued: false, reason: "ALREADY_PROVISIONED" };
  }

  // Check license status
  const license = await masterDb.query("SELECT status FROM licenses WHERE id = ?", [license_id]);

  if (license.status === "ACTIVE" || license.status === "PROVISION_FAILED") {
    logger.warn("Duplicate job dropped (license not pending)", {
      license_id,
      license_status: license.status,
    });
    return { enqueued: false, reason: "LICENSE_NOT_PENDING" };
  }

  // Safe to enqueue
  await redis.lpush("provisioning:queue", JSON.stringify(jobPayload));
  await redis.setex(pendingKey, 600, "1"); // 10-minute pending marker

  logger.info("Job enqueued", {
    license_id,
    workspace_slug,
  });

  return { enqueued: true, reason: "SUCCESS" };
}
```

---

### 14. Version Enforcement Implementation

**Where schema/product version checks happen**:

```typescript
// 1. At license creation (API endpoint)
async function createLicense(req: Request): Promise<Response> {
  const { workspace_slug, product_id /* ... */ } = req.body;

  // Get current platform version
  const platformVersion = {
    schema_version: process.env.SCHEMA_VERSION || "1.2.0",
    product_version: process.env.PRODUCT_VERSION || "1.0.0",
  };

  // Create license with platform version frozen
  const license = await masterDb.query(
    `INSERT INTO licenses 
     (workspace_slug, product_id, schema_version, product_version, status, created_at)
     VALUES ($1, $2, $3, $4, 'PENDING_PROVISION', now())
     RETURNING *`,
    [workspace_slug, product_id, platformVersion.schema_version, platformVersion.product_version],
  );

  logger.info("License created with versions", {
    license_id: license.id,
    schema_version: platformVersion.schema_version,
    product_version: platformVersion.product_version,
  });

  return success({ ...license });
}

// 2. At worker provisioning start
async function provisionWorkspace(job: ProvisioningJob): Promise<void> {
  const license = await masterDb.query(
    "SELECT schema_version, product_version FROM licenses WHERE id = ?",
    [job.license_id],
  );

  if (!license) {
    throw new Error("LICENSE_NOT_FOUND");
  }

  // Validate schema version compatibility
  const currentSchemaVersion = process.env.SCHEMA_VERSION;
  const licenseSchemaVersion = license.schema_version;

  if (compareVersions(licenseSchemaVersion, currentSchemaVersion) > 0) {
    // License requires newer platform version
    logger.error("License incompatible with platform", {
      license_schema_version: licenseSchemaVersion,
      platform_schema_version: currentSchemaVersion,
    });
    throw new Error("LICENSE_INCOMPATIBLE_SCHEMA");
  }

  logger.info("Schema version compatibility confirmed", {
    license_id: job.license_id,
    schema_version: licenseSchemaVersion,
  });

  // Proceed with migrations up to license.schema_version
  const migrationsToApply = await getMigrationsUpTo(licenseSchemaVersion);
  // ... apply migrations
}

// 3. At workspace login (resolver middleware)
async function licenseMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { workspace_slug } = req.params;

  // Resolve tenant
  const license = await resolveTenantLicense(workspace_slug);

  if (!license) {
    return error(404, "WORKSPACE_NOT_FOUND");
  }

  // Check status
  if (license.status === "PENDING_PROVISION") {
    return error(423, "WORKSPACE_LOCKED", "Workspace is being provisioned");
  }

  if (license.status === "PROVISION_FAILED") {
    return error(503, "WORKSPACE_UNAVAILABLE", "Workspace provisioning failed");
  }

  // Check version compatibility
  const currentSchemaVersion = process.env.SCHEMA_VERSION;
  if (compareVersions(license.schema_version, currentSchemaVersion) > 0) {
    return error(426, "UPGRADE_REQUIRED", "Workspace requires platform upgrade");
  }

  // Validation passed
  req.context.license = license;
  req.context.workspace_slug = workspace_slug;
  next();
}
```

---

### 15. Resolver Middleware Impact

**How PENDING_PROVISION/PROVISION_FAILED/ACTIVE states block/allow access**:

```typescript
// License resolver middleware (runs on every workspace-bound request)

async function LicenseResolver(req: Request): Promise<LicenseContext> {
  const workspace_slug = extractWorkspaceSlug(req); // From subdomain or path

  // Query license by workspace_slug
  const license = await masterDb.query(
    'SELECT id, status, schema_version, product_version FROM licenses WHERE workspace_slug = ?',
    [workspace_slug]
  );

  if (!license) {
    throw new HttpError(404, 'WORKSPACE_NOT_FOUND');
  }

  // State-based access control
  switch (license.status) {
    case 'PENDING_PROVISION':
      // Workspace is being provisioned; block all access
      throw new HttpError(423, 'WORKSPACE_LOCKED', {
        message: 'Workspace is currently being provisioned. Please try again in a few moments.',
        retry_after_seconds: 10
      });

    case 'PROVISION_FAILED':
      // Provisioning failed; block with error
      throw new HttpError(503, 'WORKSPACE_UNAVAILABLE', {
        message: 'Workspace provisioning failed. Please contact support.',
        support_contact: 'support@zidney.com'
      });

    case 'ACTIVE':
      // License is active; allow access
      return {
        license_id: license.id,
        workspace_slug,
        schema_version: license.schema_version,
        product_version: license.product_version,
        status: 'ACTIVE'
      };

    default:
      throw new HttpError(500, 'UNKNOWN_LICENSE_STATUS', {
        actual_status: license.status
      });
  }
}

// Apply middleware to all workspace-bound routes
app.use('/:workspace/*', async (req, res, next) => {
  try {
    const licenseContext = await LicenseResolver(req);
    req.context.license = licenseContext;
    next();
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.status).json(error.toJSON());
    }
    res.status(500).json({ error: 'Internal error' });
  }
});

// Response examples:

// 423 LOCKED (PENDING_PROVISION)
{
  "success": false,
  "data": null,
  "error": {
    "code": "WORKSPACE_LOCKED",
    "message": "Workspace is currently being provisioned. Please try again in a few moments.",
    "status": 423,
    "retry_after_seconds": 10
  }
}

// 503 SERVICE_UNAVAILABLE (PROVISION_FAILED)
{
  "success": false,
  "data": null,
  "error": {
    "code": "WORKSPACE_UNAVAILABLE",
    "message": "Workspace provisioning failed. Please contact support.",
    "status": 503,
    "support_contact": "support@zidney.com"
  }
}

// 200 OK (ACTIVE)
{
  "success": true,
  "data": {
    "license_id": "uuid",
    "workspace_slug": "acme-2026",
    "status": "ACTIVE"
  },
  "error": null
}
```

---

## Project Structure Decision

**Selected: Option 2 (Web application with API backend + Worker service)**

```text
Monorepo structure (Zidney):

apps/
├── api/         # Hono REST API + MMC routes
│   ├── src/
│   │   ├── middleware/    # License resolver, auth
│   │   ├── routes/        # License creation endpoints
│   │   └── services/      # DB queries, business logic
│   └── tests/
│
├── worker/      # Provisioning Worker (Node.js service)
│   ├── src/
│   │   ├── jobs/          # Job handlers (provision-workspace.ts)
│   │   ├── services/      # Database, migration, seed services
│   │   ├── observability/ # Logging, metrics
│   │   └── queue/         # Redis consumer, DLQ
│   └── tests/
│
├── mmc/         # Master Management Console (Svelte UI)
│   └── src/
│       └── components/    # License creation form
│
└── backoffice/  # (Existing) Institution control panel

packages/
├── validation/  # Shared regex, validators (workspace slug validation)
├── logger/      # Structured logging utility
├── config/      # Environment config
└── types/       # Shared TypeScript interfaces

migrations/
├── master/      # PostgreSQL master DB migrations
│   ├── 001_add_provisioning_fields.sql
│   └── 002_create_tenants_registry.sql
└── tenant/      # Tenant database baseline migrations
    ├── 001_init_schema.sql
    └── 002_init_baseline_data.sql

tests/
├── integration/ # End-to-end provisioning flow tests
├── unit/        # Idempotency, validation tests
└── fixtures/    # Test data, Docker Compose setup for local testing
```

---

## Dependencies & Tech Stack

**API Layer (Hono + TypeScript)**:

- `hono@*` - Web framework
- `postgres` or `@neondatabase/serverless` - DB driver
- `redis@^4` - Queue + distributed locks
- `bcryptjs` - Password hashing
- `jsonschema` - Payload validation

**Worker (Node.js + TypeScript)**:

- `redis@^4` - Job queue consumption
- `postgres` - Tenant DB operations
- `p-queue` or `bull` - Optional: advanced queue management
- `pino` - Structured logging
- `prometheus-client` - Metrics

**Testing**:

- `vitest` - Unit + integration tests
- `@vitest/ui` - Test UI
- `supertest` - HTTP assertions (if applicable)
- Docker for test DB setup

**Observability**:

- `pino` - JSON logging
- Prometheus client - Metrics export
- OpenTelemetry (future): Distributed tracing

---

## Complexity Tracking

**Constitution Check**: ✅ PASSED — All gates clear. No violations justified.

**Risk Flags for Guardian Audit**:

1. **Distributed Lock TTL (30s)**: If worker hangs beyond 30s, lock released and duplicate
   provisioning possible. Mitigation: Worker implements timeout protection; lock extension not used
   (to avoid unbounded retry).
2. **Network Partition (Q1)**: Reconnect up to 60s, then fail. If database becomes unreachable
   mid-transaction, partial state may exist. Mitigation: Worker detects partial DB and cleans up on
   retry.
3. **Concurrent Job Handling**: If two jobs for same license_id are enqueued before dedup check, one
   will timeout on lock. Mitigation: Dedup at enqueue time (Q5) and distributed lock ensures safety.
4. **Operator Intervention Required**: If DROP DATABASE fails after N retries, operator must
   manually remediate. Mitigation: Clear error logs and DLQ entries guide operator action.

**Testing Completeness**: ✅ Unit, integration, idempotency, and observability test scaffolds
defined.

No further escalation required. Design is complete and ready for implementation.

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
