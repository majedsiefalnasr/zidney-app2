# STAGE 05 - Tenant Provisioning Service: Implementation Plan

**Phase:** 01_PLATFORM_FOUNDATION  
**Stage:** STAGE_05_TENANT_PROVISIONING_SERVICE  
**Status:** READY FOR IMPLEMENTATION  
**Authority:** Zidney Constitution v1.2.0, ADR-0001, ADR-0007, ADR-0008  
**Created:** 2026-02-18  
**Related Spec:** [spec.md](spec.md)

---

## 1. Stage Alignment & Architectural Scope Confirmation

### 1.1 Phase & Stage Context

- **Phase:** 01_PLATFORM_FOUNDATION
- **Stage:** STAGE_05_TENANT_PROVISIONING_SERVICE
- **Related ADRs:** ADR-0001 (Database-per-Tenant), ADR-0007 (Product Version Compatibility),
  ADR-0008 (Semantic Versioning)
- **Related Spec File:**
  `specs/phases/01_PLATFORM_FOUNDATION/STAGE_05_TENANT_PROVISIONING_SERVICE/spec.md`

### 1.2 Architectural Scope Confirmation

✅ **No cross-tenant data access:** All databases accessed exclusively through tenant-specific
connection pools resolved from provenance. Each tenant owns one fully isolated database.

✅ **No middleware bypass:** License middleware mandatory before pool registration. Tenant resolver
executes first on all subsequent workspace requests.

✅ **No direct DB instantiation:** All connections obtained through tenant resolver context or
provisioning service within worker-only context.

✅ **No global DB singleton:** Master pool is singleton for provisioning service only. Each tenant
has separate pool in in-memory map.

✅ **No cross-tenant joins:** Database-level isolation prevents any JOIN between tenant databases.

✅ **Correlation ID propagation:** All logs include `correlation_id`, `workspace_slug`, and tenant
identifiers for full traceability.

✅ **Structured logging only:** All event logs follow standardized JSON format with timestamp,
level, service, and contextual fields.

✅ **Transaction atomicity:** All critical writes (registry creation, license transition, schema
initialization) are transactional with automatic rollback on failure.

✅ **Idempotency provable:** Provisioning is safely retryable via checkpoint table, migration
checksums, and upsert semantics for seeded data.

✅ **Worker-only execution:** Provisioning DDL and DML occurs exclusively in worker process, never
in API process.

---

## 2. System Architecture Overview

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Zidney Platform                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐         ┌──────────────┐                       │
│  │ MMC/License  │         │ API Process  │                       │
│  │  Service     │         │ (Web Tier)   │                       │
│  └──────┬───────┘         └──────────────┘                       │
│         │                                                         │
│         │ Enqueue Job                                             │
│         ▼                                                         │
│  ┌──────────────────────────────────────┐                        │
│  │    Redis Job Queue                   │                        │
│  │  (provisioning_jobs)                 │                        │
│  └──────────────┬───────────────────────┘                        │
│                 │                                                 │
│                 │ Dequeue                                         │
│                 ▼                                                 │
│  ┌─────────────────────────────────────────┐                     │
│  │ Worker Process (Provisioning Service)   │                     │
│  │                                          │                     │
│  │  ┌─────────────────────────────────┐   │                     │
│  │  │ 1. Acquire Distributed Lock     │   │                     │
│  │  │    (redis-lock: provisioning:<slug>)│                     │
│  │  └─────────────────────────────────┘   │                     │
│  │            ▼                             │                     │
│  │  ┌─────────────────────────────────┐   │                     │
│  │  │ 2. Validate License & Slug      │   │                     │
│  │  │    (query master DB)            │   │                     │
│  │  └─────────────────────────────────┘   │                     │
│  │            ▼                             │                     │
│  │  ┌─────────────────────────────────┐   │                     │
│  │  │ 3. Create Tenant Database       │   │                     │
│  │  │    CREATE DATABASE workspace_<slug> │                     │
│  │  └─────────────────────────────────┘   │                     │
│  │            ▼                             │                     │
│  │  ┌─────────────────────────────────┐   │                     │
│  │  │ 4. Run Baseline Migrations      │   │                     │
│  │  │    (schema_migrations table)    │   │                     │
│  │  └─────────────────────────────────┘   │                     │
│  │            ▼                             │                     │
│  │  ┌─────────────────────────────────┐   │                     │
│  │  │ 5. Seed Baseline Data           │   │                     │
│  │  │    (INSERT ... ON CONFLICT)     │   │                     │
│  │  └─────────────────────────────────┘   │                     │
│  │            ▼                             │                     │
│  │  ┌─────────────────────────────────┐   │                     │
│  │  │ 6. Create Registry Entry        │   │                     │
│  │  │    (tenants_registry, master DB)│   │                     │
│  │  └─────────────────────────────────┘   │                     │
│  │            ▼                             │                     │
│  │  ┌─────────────────────────────────┐   │                     │
│  │  │ 7. Transition License to ACTIVE │   │                     │
│  │  │    (update licenses, master DB) │   │                     │
│  │  └─────────────────────────────────┘   │                     │
│  │            ▼                             │                     │
│  │  ┌─────────────────────────────────┐   │                     │
│  │  │ 8. Register Pool in Memory Map  │   │                     │
│  │  │    (make available to API)      │   │                     │
│  │  └─────────────────────────────────┘   │                     │
│  │            ▼                             │                     │
│  │  ┌─────────────────────────────────┐   │                     │
│  │  │ 9. Release Distributed Lock     │   │                     │
│  │  │    (redis DELETE)               │   │                     │
│  │  └─────────────────────────────────┘   │                     │
│  └──────────────────────────────────────────┘                    │
│         ▲                                                         │
│         │ On Failure: Rollback All Changes                       │
│         │                                                         │
├─────────┼─────────────────────────────────────────────────────────┤
│         │                                                         │
│  ┌──────▼─────────┐     ┌───────────────┐       ┌─────────────┐  │
│  │ Master DB      │     │ Tenant DB     │       │ Redis Cache │  │
│  │ (zidney_       │     │ (workspace_   │       │ (Locks,     │  │
│  │  master)       │     │  <slug>)      │       │  Jobs)      │  │
│  │                │     │               │       │             │  │
│  │ • licenses     │     │ • users       │       │ • Distrib.  │  │
│  │ • tenants_     │     │ • roles       │       │   Locks     │  │
│  │   registry     │     │ • exams       │       │ • Job Queue │  │
│  │ • organization │     │ • attempts    │       │ • Conn Pool │  │
│  │   s            │     │ • ...all base │       │             │  │
│  │                │     │   structural  │       └─────────────┘  │
│  │                │     │   tables      │                        │
│  │                │     │               │                        │
│  │                │     │ schema_version│                        │
│  │                │     │ provisioning_ │                        │
│  │                │     │  checkpoints  │                        │
│  └────────────────┘     └───────────────┘                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow - Request to Provisioning Completion

```
Step 1: License Creation (API)
  POST /internal/licenses/create
    ↓
  Create license in CREATED state
    ↓
  success: true
  license_id: 12345

Step 2: Trigger Provisioning (API or MMC)
  Internal call: license_service.startProvisioning(license_id, workspace_slug)
    ↓
  Update license.status = 'PROVISIONING'
  Enqueue job: {license_id, workspace_slug, correlation_id}
    ↓
  Job -> Redis queue (provisioning_jobs)

Step 3: Worker Dequeue
  Worker process polling redis
    ↓
  Dequeue job
    ↓
  Log: provisioning_job_dequeued (correlation_id)
    ↓
  Validate license state = PROVISIONING

Step 4: Acquire Lock
  Try: REDIS SET provisioning:<slug> <worker_id> NX EX 60
    ↓
  If lock exists: Abort, exponential backoff, retry
    ↓
  If acquired: Log provisioning_lock_acquired

Step 5: Validate & Prepare
  Query master: SELECT * from licenses WHERE id = <license_id>
  Validate: status = PROVISIONING, slug matches
    ↓
  Check slug uniqueness in tenants_registry
    ↓
  If slug exists: Abort (PROV_001, 409)

Step 6: Database Creation (Tenant DB)
  Execute: CREATE DATABASE workspace_<slug> TEMPLATE template0
    ↓
  Validate creation success
    ↓
  Log: provisioning_database_created
    ↓
  Write checkpoint: {step: 'database_created', completed_at: now()}

Step 7: Schema Initialization (Tenant DB)
  Load all migration files from apps/api/src/db/tenant/migrations/
    ↓
  BEGIN TRANSACTION (REPEATABLE READ)
    ↓
  For each migration (ordered by version):
    - Check schema_migrations table (exists? checksum match?)
    - If NOT applied: Execute migration SQL
    - Validate checksum matches expected (SHA256)
    - Write to schema_migrations(version, checksum, installed_on)
    - Log: provisioning_migration_applied (with duration_ms)
    - Write checkpoint: {step: 'migration_<version>_applied', ...}
    ↓
  COMMIT TRANSACTION
    ↓
  Verify schema_version table exists
  Read current_schema_version = '1.0.0'
    ↓
  Log: provisioning_schemas_initialized
    ↓
  Write checkpoint: {step: 'schema_initialized', schema_version: '1.0.0'}

Step 8: Baseline Data Seeding (Tenant DB)
  BEGIN TRANSACTION (REPEATABLE READ)
    ↓
  INSERT baseline data:
    - Roles (Admin, Student) via UPSERT
    - Permissions (default set) via UPSERT
    - Languages (en) via UPSERT
    - Division (Main) via UPSERT
    - Settings (defaults) via UPSERT
    ↓
  COMMIT TRANSACTION
    ↓
  Log: provisioning_seed_data_applied
    ↓
  Write checkpoint: {step: 'seed_completed', ...}

Step 9-10: Registry Entry & License Transition (Master DB) [ATOMIC]
  BEGIN TRANSACTION (REPEATABLE READ, master pool)
    ↓
  INSERT INTO tenants_registry:
    - workspace_slug: '<slug>'
    - license_id: <license_id>
    - database_name: 'workspace_<slug>'
    - expected_schema_version: '1.0.0'
    - created_at: SERVER_TIME
    - is_active: true
    ↓
  UPDATE licenses
    SET status = 'ACTIVE',
        schema_version = '1.0.0',
        provisioned_at = SERVER_TIME
    WHERE id = <license_id>
    ↓
  COMMIT TRANSACTION (both operations succeed or both roll back)
    ↓
  Log: provisioning_registry_and_license_transitioned (from_state: PROVISIONING, to_state: ACTIVE)
    ↓
  Write checkpoint: {step: 'registry_and_license_synchronized', ...}

**Atomicity Guarantee:** Registry entry and license status are synchronized in a single transaction. If insertion fails, license remains PROVISIONING, allowing safe retry. If update fails, registry transaction rolls back automatically.

Step 11: Pool Registration (Worker Memory)
  Register pool in worker's in-memory map:
    pools[workspace_slug] = ConnectionPool(workspace_<slug>, credentials)
    ↓
  Log: provisioning_pool_registered

Step 12: Release Lock & Completion
  REDIS DEL provisioning:<slug>
    ↓
  Log: provisioning_lock_released
    ↓
  Log: provisioning_completed (total_duration_ms: X)
    ↓
  Mark job as COMPLETED

Step 13: Subsequent API Request (Different Process)
  Request arrives: GET /workspace/<slug>/exams
    ↓
  Middleware: Tenant Resolver
    - Resolve workspace_slug from URL/subdomain
    - Query tenants_registry for database_name
    - Get pool from pools map (NOW EXISTS!)
    - Attach to request: request.tenant = {slug, db_name, pool, license_id}
    ↓
  Middleware: License Enforcement
    - Query master: SELECT * from licenses WHERE id = request.tenant.license_id
    - Validate status = ACTIVE (not SOFT_LOCKED, ARCHIVED)
    ↓
  Middleware: Schema Version Check
    - Query tenant: SELECT current_schema_version from schema_version
    - Validate: current_schema_version >= MIN_REQUIRED
    ↓
  Route Handler (uses request.tenant.pool)
    - All queries execute against tenant pool
    - No cross-tenant access possible (database level isolation)
```

### 2.3 Worker Interaction Model

```
License Service (in API or MMC)
  ├─ Receives license creation request
  ├─ Creates license in CREATED state
  ├─ Transitions to PROVISIONING
  └─ Enqueues job to redis provisioning_jobs queue
      ↓
      ↓ (Decoupled - async)
      ↓
Worker Process
  ├─ Polls redis queue continuously
  ├─ Dequeues job {license_id, workspace_slug, correlation_id}
  ├─ Validates license exists and is in PROVISIONING state
  ├─ Acquires distributed lock (redis)
  ├─ Executes provisioning pipeline (steps 5-12 above)
  ├─ On success: Updates license to ACTIVE, registers pool, releases lock
  ├─ On failure: Rolls back all changes, updates license to FAILED, releases lock
  ├─ On transient error: Releases lock, moves job to retry queue with backoff
  └─ Logs all events with correlation_id for tracing

Key Properties:
  - Asynchronous (no API blocking)
  - Recoverable (checkpoints allow resume)
  - Idempotent (migrations tagged with checksums)
  - Distributed-safe (lock prevents parallel provision of same slug)
  - Scalable (multiple workers can provision different slugs concurrently)
```

---

## 3. Schema & Database Design

### 3.1 Master Database (zidney_master) Changes

#### 3.1.1 Migration File: `add_provisioning_fields_to_licenses.sql`

```sql
-- Migration: 2026-02-18-add-provisioning-fields-to-licenses
-- Purpose: Add provisioning state tracking to licenses table
-- Rollback: DROP COLUMN status, schema_version, archived_at

SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

BEGIN;

-- Add status column (tracks provisioning states)
ALTER TABLE licenses
ADD COLUMN status VARCHAR(20) DEFAULT 'CREATED' NOT NULL
CHECK (status IN ('CREATED', 'PROVISIONING', 'ACTIVE', 'SOFT_LOCKED', 'ARCHIVED', 'FAILED', 'DELETED'));

-- Add schema_version tracking
ALTER TABLE licenses
ADD COLUMN schema_version VARCHAR(20);

-- Add archived_at timestamp for archive operations
ALTER TABLE licenses
ADD COLUMN archived_at TIMESTAMP;

-- Create index on status for efficient querying of licenses in specific states
CREATE INDEX idx_licenses_status ON licenses(status);

COMMIT;
```

#### 3.1.2 Migration File: `create_tenants_registry_table.sql`

```sql
-- Migration: 2026-02-18-create-tenants-registry
-- Purpose: Create master registry of all tenant databases
-- Rollback: DROP TABLE tenants_registry

SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

BEGIN;

CREATE TABLE tenants_registry (
  id BIGSERIAL PRIMARY KEY,
  workspace_slug VARCHAR(255) UNIQUE NOT NULL,
  license_id BIGINT NOT NULL UNIQUE REFERENCES licenses(id) ON DELETE RESTRICT,
  database_name VARCHAR(255) NOT NULL UNIQUE,
  expected_schema_version VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP,
  deleted_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true NOT NULL,

  -- Constraint: Slug format validation (lowercase, alphanumeric + dash, 3-50 chars)
  CONSTRAINT valid_slug_format
    CHECK (workspace_slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$')
);

-- Indexes for efficient queries
CREATE INDEX idx_tenants_registry_slug ON tenants_registry(workspace_slug);
CREATE INDEX idx_tenants_registry_license_id ON tenants_registry(license_id);
CREATE INDEX idx_tenants_registry_active ON tenants_registry(is_active)
  WHERE is_active = true AND deleted_at IS NULL;

COMMIT;
```

### 3.2 Tenant Database (workspace\_<slug>) Baseline Schema

#### 3.2.1 Baseline Migrations

**Location:** `apps/api/src/db/tenant/migrations/`

**Migration Execution Order:** Sequential by version number (e.g., 001, 002, 003, ...)

#### 3.2.2 Critical Table: `schema_version`

```sql
-- Migration: tenant-baseline-001-create-schema-version
-- Purpose: Track tenant schema version (essential for compatibility)

CREATE TABLE schema_version (
  id INTEGER PRIMARY KEY DEFAULT 1,
  current_schema_version VARCHAR(20) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64) NOT NULL,

  -- Constraint: Ensure only one row exists
  CONSTRAINT only_one_row CHECK (id = 1)
);

-- Insert baseline version
INSERT INTO schema_version
  (id, current_schema_version, checksum)
VALUES
  (1, '1.0.0', 'SHA256_HASH_OF_BASELINE_SCHEMA');
```

#### 3.2.3 Migration Tracking Table: `schema_migrations`

```sql
-- Migration: tenant-baseline-002-create-schema-migrations
-- Purpose: Track which migrations have been applied to this tenant

CREATE TABLE schema_migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL UNIQUE,
  description VARCHAR(255),
  installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64) NOT NULL UNIQUE,
  execution_time_ms INTEGER,

  CONSTRAINT valid_checksum_length CHECK (LENGTH(checksum) = 64)
);

-- Index for efficient lookups
CREATE INDEX idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX idx_schema_migrations_installed_on ON schema_migrations(installed_on DESC);
```

#### 3.2.4 Provisional State Tracking: `provisioning_checkpoints`

```sql
-- Migration: tenant-baseline-003-create-provisioning-checkpoints
-- Purpose: Track provisioning progress for crash recovery

CREATE TABLE provisioning_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step VARCHAR(50) NOT NULL,
  step_ordinal INTEGER NOT NULL,
  completed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload JSONB,
  correlation_id VARCHAR(255),

  CONSTRAINT valid_step_ordinal CHECK (step_ordinal >= 0)
);

-- Index for efficient recovery (find last completed step)
CREATE INDEX idx_provisioning_checkpoints_ordinal
  ON provisioning_checkpoints(step_ordinal DESC);

CREATE INDEX idx_provisioning_checkpoints_correlation_id
  ON provisioning_checkpoints(correlation_id);
```

#### 3.2.5 Core Application Tables (Structural Only)

```sql
-- Migration: tenant-baseline-004-create-core-tables

-- Users and authentication
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
  id BIGSERIAL PRIMARY KEY,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_code VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_role_permission UNIQUE (role_id, permission_code)
);

-- Organizational structure
CREATE TABLE divisions (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT non_empty_name CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE TABLE departments (
  id BIGSERIAL PRIMARY KEY,
  division_id BIGINT NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_department_per_division UNIQUE (division_id, name),
  CONSTRAINT non_empty_name CHECK (LENGTH(TRIM(name)) > 0)
);

-- Study groups and subscriptions
CREATE TABLE groups (
  id BIGSERIAL PRIMARY KEY,
  department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_group_per_department UNIQUE (department_id, name)
);

CREATE TABLE subscriptions (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  license_tier VARCHAR(50) NOT NULL,
  active_from TIMESTAMP NOT NULL,
  active_to TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Exam and attempt infrastructure
CREATE TABLE exams (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  passing_score DECIMAL(5,2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT positive_duration CHECK (duration_minutes > 0)
);

CREATE TABLE attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  started_at TIMESTAMP,
  submitted_at TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'not_started',
  score DECIMAL(5,2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_status CHECK (status IN ('not_started', 'in_progress', 'submitted', 'graded', 'cancelled'))
);

-- Question types
CREATE TABLE mcq_questions (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  points DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT positive_points CHECK (points > 0),
  CONSTRAINT positive_order CHECK (question_order >= 0)
);

CREATE TABLE traditional_questions (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_order INTEGER NOT NULL,
  points DECIMAL(5,2) NOT NULL,
  expected_answer_length_min INTEGER,
  expected_answer_length_max INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT positive_points CHECK (points > 0),
  CONSTRAINT positive_order CHECK (question_order >= 0)
);

-- Localization and settings
CREATE TABLE translations (
  id BIGSERIAL PRIMARY KEY,
  language_code VARCHAR(5) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  translated_value TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_translation
    UNIQUE (language_code, entity_type, entity_id, field_name)
);

CREATE TABLE certificates (
  id BIGSERIAL PRIMARY KEY,
  attempt_id BIGINT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  certificate_code VARCHAR(255) UNIQUE NOT NULL,
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,

  CONSTRAINT positive_code_length CHECK (LENGTH(certificate_code) > 0)
);

CREATE TABLE settings (
  id BIGSERIAL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_setting_type
    CHECK (setting_type IN ('string', 'integer', 'boolean', 'json'))
);

-- Master indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_external_id ON users(external_id);
CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_divisions_name ON divisions(name);
CREATE INDEX idx_exams_title ON exams(title);
CREATE INDEX idx_attempts_user_id ON attempts(user_id);
CREATE INDEX idx_attempts_exam_id ON attempts(exam_id);
CREATE INDEX idx_attempts_status ON attempts(status);
CREATE INDEX idx_certificates_attempt_id ON certificates(attempt_id);
CREATE INDEX idx_translations_language ON translations(language_code);
CREATE INDEX idx_settings_key ON settings(setting_key);
```

### 3.3 Baseline Data Seeding

#### 3.3.1 Seed Script: `seed-baseline-data.sql`

```sql
-- Baseline data seeding (all via UPSERT to ensure idempotency)
-- Executed in single transaction after all structural migrations

SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

BEGIN;

-- Seed default roles
INSERT INTO roles (id, name, description, is_system)
VALUES
  (1, 'Administrator', 'Full platform access', true),
  (2, 'Student', 'Student exam participant', true)
ON CONFLICT (name) DO NOTHING;

-- Seed default permissions
INSERT INTO role_permissions (role_id, permission_code)
SELECT 1, 'exam:read'
WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = 1 AND permission_code = 'exam:read')
UNION ALL
SELECT 1, 'exam:write'
WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = 1 AND permission_code = 'exam:write')
UNION ALL
SELECT 1, 'attempt:grade'
WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = 1 AND permission_code = 'attempt:grade')
UNION ALL
SELECT 2, 'exam:read'
WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = 2 AND permission_code = 'exam:read')
UNION ALL
SELECT 2, 'attempt:submit'
WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role_id = 2 AND permission_code = 'attempt:submit');

-- Seed default division
INSERT INTO divisions (id, name, description, is_system)
VALUES (1, 'Main Division', 'Default organizational division', true)
ON CONFLICT (name) DO NOTHING;

-- Seed default settings
INSERT INTO settings (setting_key, setting_value, setting_type)
VALUES
  ('timezone', 'UTC', 'string'),
  ('date_format', 'YYYY-MM-DD', 'string'),
  ('time_format', 'HH:mm:ss', 'string'),
  ('language_default', 'en', 'string'),
  ('exam_timeout_grace_seconds', '60', 'integer'),
  ('attempt_max_retries', '1', 'integer')
ON CONFLICT (setting_key) DO NOTHING;

COMMIT;
```

### 3.4 Database Design Summary

| Database                           | Tables                                                                                                                                      | Purpose                  | Isolation                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------- |
| **zidney_master** (singleton)      | licenses, tenants_registry, organizations, subscriptions (master level)                                                                     | Global platform metadata | N/A (master DB)                    |
| **workspace\_<slug>** (per-tenant) | users, roles, exams, attempts, questions, certificates, translations, settings, schema_version, schema_migrations, provisioning_checkpoints | Tenant-specific data     | Full isolation (separate database) |

---

## 4. Middleware & Integration Points

### 4.1 Middleware Execution Order (Post-Provisioning)

For all workspace-bound API requests:

```
1. REQUEST RECEIVED
   ↓
2. Correlation ID Middleware
   - Extract or generate correlation_id
   - Attach to request context
   - Propagate through all logs
   ↓
3. Tenant Resolver Middleware
   - Extract workspace_slug from subdomain/path
   - Query master DB: SELECT * FROM tenants_registry WHERE workspace_slug = $1
   - Get pool from in-memory map: pools[workspace_slug]
   - Attach to request: request.tenant = {slug, db_name, pool, license_id}
   - Return 503 if pool not registered (provisioning in progress)
   - Return 404 if slug not found
   ↓
4. License Enforcement Middleware
   - Query master DB: SELECT * FROM licenses WHERE id = request.tenant.license_id
   - Validate status = 'ACTIVE'
   - If SOFT_LOCKED: Return 423 (too_early_to_retry / locked)
   - If ARCHIVED: Return 403 Forbidden
   - If CREATED/PROVISIONING: Return 503 Service Unavailable
   - If DELETED: Return 404 Not Found
   ↓
5. Schema Version Check Middleware
   - Query tenant DB: SELECT current_schema_version FROM schema_version
   - Validate: current_schema_version >= runtime.MIN_SCHEMA_VERSION
   - If too old: Return 426 Upgrade Required
   - If too new: Return 503 Service Unavailable
   ↓
6. ROUTE HANDLER
   - Execute route logic with request.tenant.pool
   - All database access uses tenant pool (automatic isolation)
   ↓
7. RESPONSE
```

### 4.2 Tenant Resolver Integration

**File Location:** `packages/domain-core/provisioning/tenant-resolver.ts` (or similar)

```typescript
// Pseudo-code
interface TenantContext {
  workspace_slug: string;
  database_name: string;
  pool: ConnectionPool;
  license_id: number;
}

async function resolveTenant(slug: string): Promise<TenantContext | null> {
  // Query master DB for registry entry
  const registry = await masterPool.query(
    "SELECT license_id, database_name FROM tenants_registry WHERE workspace_slug = $1 AND is_active = true",
    [slug],
  );

  if (!registry.rows.length) {
    return null; // 404
  }

  // Get pool from in-memory map
  const pool = getTenantPool(slug);
  if (!pool) {
    throw new ServiceUnavailable("Provisioning in progress"); // 503
  }

  return {
    workspace_slug: slug,
    database_name: registry.rows[0].database_name,
    pool,
    license_id: registry.rows[0].license_id,
  };
}
```

### 4.3 License Middleware Integration

**File Location:** `apps/api/src/middleware/license-enforcement.ts` (or similar)

```typescript
// Pseudo-code
async function licenseEnforcementMiddleware(req, res, next) {
  const tenant = req.tenant; // From resolver

  const license = await masterPool.query(
    "SELECT status, schema_version FROM licenses WHERE id = $1",
    [tenant.license_id],
  );

  if (!license.rows.length) {
    return res.status(404).json(errorResponse("NOT_FOUND"));
  }

  const status = license.rows[0].status;

  switch (status) {
    case "ACTIVE":
      return next(); // Proceed
    case "SOFT_LOCKED":
      return res.status(423).json(errorResponse("SOFT_LOCKED"));
    case "ARCHIVED":
      return res.status(403).json(errorResponse("ARCHIVED"));
    case "PROVISIONING":
    case "CREATED":
      return res.status(503).json(errorResponse("SERVICE_UNAVAILABLE"));
    case "DELETED":
      return res.status(404).json(errorResponse("NOT_FOUND"));
    default:
      return res.status(503).json(errorResponse("UNKNOWN_LICENSE_STATE"));
  }
}
```

### 4.4 Worker Queue Integration

**Queue Name:** `provisioning_jobs` (Redis list)

**Job Message Format:**

```json
{
  "id": "<uuid>",
  "license_id": 12345,
  "workspace_slug": "acme-university",
  "organization_id": 54321,
  "correlation_id": "<uuid>",
  "enqueued_at": "2026-02-18T10:00:00Z",
  "attempt": 1,
  "max_attempts": 3
}
```

**Worker Processing Loop:**

```
while (true) {
  job = redis.LPOP('provisioning_jobs', 1 second timeout)

  if (job) {
    try {
      result = provisioning_service.provision(job)
      if (result.success) {
        log('provisioning_completed', correlation_id: job.correlation_id)
      } else {
        if (job.attempt < job.max_attempts) {
          backoff = exponential_backoff(job.attempt)
          redis.RPUSH('provisioning_jobs_retry', job, retry_at: now() + backoff)
        } else {
          redis.RPUSH('provisioning_jobs_dlq', job)
          log('provisioning_job_dlq', correlation_id: job.correlation_id)
        }
      }
    } catch (error) {
      log_error('provisioning_worker_error', error, correlation_id: job.correlation_id)
      if (job.attempt < job.max_attempts) {
        backoff = exponential_backoff(job.attempt)
        redis.RPUSH('provisioning_jobs_retry', job, retry_at: now() + backoff)
      } else {
        redis.RPUSH('provisioning_jobs_dlq', job)
      }
    }
  }
}
```

---

## 5. Worker Job Design

### 5.1 Job Structure & Lifecycle

```
Job Lifecycle:
  1. QUEUED → Job enqueued in provisioning_jobs
  2. PROCESSING → Job dequeued, worker started processing
  3. SUCCESS → All steps succeeded, job removed
  4. RETRY → Transient error, job moved to retry queue with backoff
  5. DLQ → Max retries exceeded, job moved to dead-letter queue (manual intervention)
  6. FAILED → Permanent error (not retryable), job logged as failed
```

### 5.2 Execution Lifecycle

**Worker Implementation: `apps/worker/src/provisioning-service.ts`**

```typescript
class ProvisioningService {
  async provision(job: ProvisioningJob): Promise<ProvisioningResult> {
    const { license_id, workspace_slug, correlation_id } = job;
    const context = {
      license_id,
      workspace_slug,
      correlation_id,
      startTime: now(),
    };

    try {
      // Step 1: Acquire distributed lock
      const lockAcquired = await this.acquireLock(workspace_slug, context);
      if (!lockAcquired) {
        throw new TransientError("PROV_006", "Lock collision");
      }

      // Step 2: Validate
      await this.validateLicense(license_id, context);
      await this.validateSlug(workspace_slug, context);

      // Step 3: Create database
      await this.createDatabase(workspace_slug, context);

      // Step 4: Initialize schema
      await this.initializeSchema(workspace_slug, context);

      // Step 5: Seed data
      await this.seedBaselineData(workspace_slug, context);

      // Step 6: Create registry entry
      await this.createRegistryEntry(license_id, workspace_slug, context);

      // Step 7: Transition license
      await this.transitionLicense(license_id, "ACTIVE", context);

      // Step 8: Register pool
      this.registerPool(workspace_slug, context);

      // Step 9: Release lock
      await this.releaseLock(workspace_slug, context);

      // Step 10: Log completion
      log("provisioning_completed", {
        correlation_id,
        workspace_slug,
        license_id,
        duration_ms: now() - context.startTime,
      });

      return { success: true, license_id, workspace_slug };
    } catch (error) {
      // Comprehensive error handling with rollback
      await this.rollback(workspace_slug, license_id, error, context);

      if (isTransient(error)) {
        throw new RetryableError(error.code, error.message);
      } else {
        throw new PermanentError(error.code, error.message);
      }
    }
  }
}
```

### 5.3 Retry Strategy

**Configuration:**

```
Max Retries: 3
Initial Backoff: 5 seconds
Backoff Multiplier: 2.0
Max Backoff: 60 seconds

Retry Schedule:
  Attempt 1: Fail → Wait 5 seconds → Retry
  Attempt 2: Fail → Wait 10 seconds → Retry
  Attempt 3: Fail → Wait 20 seconds → Retry
  Attempt 4 (fail): → Move to DLQ
```

**Retry Conditions (Transient Errors):**

- `PROV_002`: Database creation timeout (transient)
- `PROV_006`: Lock collision (transient)
- Network timeout to PostgreSQL (transient)

**No-Retry Conditions (Permanent Errors):**

- `PROV_001`: Slug already registered (business logic error)
- `PROV_007`: Invalid slug format (validation error)
- `PROV_008`: License not found (config error)
- `PROV_009`: License not in PROVISIONING state (state error)
- `PROV_010`: Migration checksum mismatch (data integrity error)

### 5.4 DLQ (Dead Letter Queue) Handling

**Queue Name:** `provisioning_jobs_dlq` (Redis list)

**DLQ Processing:**

```
Monitoring Job:
  Every 5 minutes:
    For each job in provisioning_jobs_dlq:
      - Log with EMERGENCY level
      - Include: license_id, workspace_slug, correlation_id, error details
      - Alert ops team for manual intervention

Manual Intervention Procedure:
  1. Inspect job details in DLQ
  2. Determine root cause (logs, database state)
  3. Fix root cause (e.g., create missing license, fix checksum)
  4. Manually move job back to provisioning_jobs queue
  5. Re-run provisioning with new attempt counter
```

### 5.5 Timeout Boundaries

| Operation                  | Timeout     | Handling                         |
| -------------------------- | ----------- | -------------------------------- |
| Lock wait                  | 5 seconds   | Abort, retry with backoff        |
| Database creation          | 30 seconds  | Abort, rollback, retry           |
| Migration execution (each) | 300 seconds | Abort, rollback, retry           |
| Total job                  | 600 seconds | Abort all, rollback, move to DLQ |
| Registry write             | 10 seconds  | Abort, retry                     |
| License update             | 10 seconds  | Abort, retry                     |

---

## 6. Error Handling & Recovery

### 6.1 Error Code to HTTP Status Mapping

| Error Code | HTTP Status               | Description                       | Retry | Action                         |
| ---------- | ------------------------- | --------------------------------- | ----- | ------------------------------ |
| `PROV_001` | 409 Conflict              | Slug already registered           | No    | Escalate (dupe workspace)      |
| `PROV_002` | 500 Internal Server Error | Database creation failed          | Yes   | Transient; retry               |
| `PROV_003` | 500 Internal Server Error | Migration execution failed        | Yes   | Rollback DB; retry             |
| `PROV_004` | 500 Internal Server Error | Registry write failed             | Yes   | Rollback; retry                |
| `PROV_005` | 500 Internal Server Error | License update failed             | Yes   | Rollback registry; retry       |
| `PROV_006` | 409 Conflict              | Lock collision                    | Yes   | Exponential backoff; retry     |
| `PROV_007` | 400 Bad Request           | Invalid slug format               | No    | Config error; escalate         |
| `PROV_008` | 404 Not Found             | License not found                 | No    | Data inconsistency; escalate   |
| `PROV_009` | 400 Bad Request           | License not in PROVISIONING state | No    | State error; escalate          |
| `PROV_010` | 500 Internal Server Error | Migration checksum mismatch       | No    | Data integrity error; escalate |
| `WS_001`   | 404 Not Found             | Workspace not found               | N/A   | User error (invalid tenant)    |
| `WS_002`   | 423 Locked                | License soft-locked               | N/A   | Tenant access blocked          |
| `WS_003`   | 403 Forbidden             | License archived                  | N/A   | Tenant access forbidden        |
| `WS_004`   | 426 Upgrade Required      | Schema version incompatible       | N/A   | Tenant upgrade required        |
| `WS_005`   | 426 Upgrade Required      | Product version incompatible      | N/A   | License upgrade required       |

### 6.2 Rollback Procedures

#### 6.2.1 Rollback on Database Creation Failure

```
Failure Point: Database creation failed (PostgreSQL error)
Actions:
  1. Log error with PROV_002 code
  2. Attempt cleanup: DROP DATABASE IF EXISTS workspace_<slug>
  3. Release lock immediately
  4. Increment retry counter
  5. If retries < max_retries:
       - Move job to retry queue with backoff
  6. Else:
       - Move job to DLQ
       - Log with EMERGENCY level
```

#### 6.2.2 Rollback on Schema Initialization Failure

```
Failure Point: Migration execution failed (SQL error)
Actions:
  1. ROLLBACK transaction (automatic in PostgreSQL)
  2. Log error with PROV_003 code
  3. Attempt cleanup: DROP DATABASE workspace_<slug> (full schema removal)
  4. Release lock immediately
  5. Increment retry counter
  6. If retries < max_retries:
       - Move job to retry queue with backoff
  7. Else:
       - Move job to DLQ
       - Alert ops: "Migration checksum or schema error; manual investigation required"
```

#### 6.2.3 Rollback on Registry/License Failure

```
Failure Point: Registry insert or license update fails
Actions:
  1. ROLLBACK transaction (if in progress)
  2. Drop database: DROP DATABASE workspace_<slug>
  3. Log error with PROV_004 or PROV_005 code
  4. Release lock immediately
  5. Increment retry counter
  6. If retries < max_retries:
       - Move job to retry queue with backoff
  7. Else:
       - Move job to DLQ
       - Log database cleanup inconsistency alert
```

### 6.3 Orphan Detection & Cleanup

**Orphan Types:**

1. **Database without registry entry:** Database exists but no tenants_registry row
2. **Registry without database:** Registry entry exists but database missing
3. **License without registry:** License in ACTIVE state but no registry entry

**Detection Job (background task, runs every 1 hour):**

```typescript
async function detectOrphans() {
  const context = { correlation_id: generateId() };

  // Type 1: Databases without registry entries
  const orphanDatabases = await masterPool.query(`
    SELECT datname FROM pg_database 
    WHERE datname LIKE 'workspace_%'
    AND datname NOT IN (SELECT database_name FROM tenants_registry WHERE is_active = true)
  `);

  for (const db of orphanDatabases.rows) {
    alert("ORPHAN_DATABASE", {
      database_name: db.datname,
      action: "Manual review; cleanup if confirmed orphan",
      correlation_id: context.correlation_id,
    });
  }

  // Type 2: Registry entries without databases
  const orphanRegistry = await masterPool.query(`
    SELECT workspace_slug, database_name FROM tenants_registry 
    WHERE is_active = true
    AND NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = database_name)
  `);

  for (const entry of orphanRegistry.rows) {
    alert("ORPHAN_REGISTRY", {
      workspace_slug: entry.workspace_slug,
      database_name: entry.database_name,
      action: "Manual review; mark deleted_at if cleaned",
      correlation_id: context.correlation_id,
    });
  }

  // Type 3: Active licenses without registry
  const orphanLicenses = await masterPool.query(`
    SELECT licenses.id FROM licenses 
    WHERE licenses.status = 'ACTIVE'
    AND licenses.id NOT IN (SELECT license_id FROM tenants_registry WHERE is_active = true)
  `);

  for (const license of orphanLicenses.rows) {
    alert("ORPHAN_LICENSE", {
      license_id: license.id,
      action: "Investigate provisioning failure; manual cleanup required",
      correlation_id: context.correlation_id,
    });
  }
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

**Location:** `apps/worker/tests/unit/provisioning-service.test.ts`

**Tests:**

1. **Slug Validation**
   - Valid slugs accepted
   - Invalid slugs rejected (special chars, capitals, too short)
   - SQL injection attempts blocked

2. **Lock Acquisition**
   - Lock acquired successfully
   - Lock collision detected
   - Lock released after job completion

3. **Checksum Validation**
   - Migration checksum matches
   - Checksum mismatch detected
   - Immutable checksum violation detected

4. **Idempotency**
   - Same job replayed twice succeeds
   - Migrations not re-applied
   - Registry not re-inserted
   - Seed operations safely replayed

5. **Error Classification**
   - Transient errors identified for retry
   - Permanent errors not retried
   - Error codes mapped correctly

### 7.2 Integration Tests

**Location:** `apps/worker/tests/integration/provisioning-flow.test.ts`

**Tests:**

1. **Happy Path**
   - Create license → Enqueue job → Provision → Verify pool registered
   - Assert: Database exists, all tables created, registry entry exists, license ACTIVE

2. **Concurrent Provisioning**
   - Two workers attempt to provision same workspace
   - Assert: Only one succeeds, other gets lock collision

3. **Crash Recovery**
   - Start provisioning, simulate crash after migration_003
   - Retry provisioning
   - Assert: No migrations re-applied, final state consistent

4. **Partial Failure Rollback**
   - Simulate schema initialization failure
   - Assert: Database dropped, lock released, registry empty, license not updated

5. **Retry with Backoff**
   - Simulate transient database error
   - Assert: Job moved to retry queue, exponential backoff calculated, retry succeeds

6. **Registry Consistency**
   - Provision workspace
   - Query registry, query license, query database
   - Assert: All three states aligned (registry exists ↔ DB exists ↔ License ACTIVE)

### 7.3 Snapshot/Regression Tests

**Location:** `apps/worker/tests/snapshot/baseline-schema.test.ts`

**Tests:**

1. **Schema Completeness**
   - Provision workspace
   - Query information_schema
   - Assert: All 15+ expected tables exist with correct columns

2. **Baseline Data**
   - Provision workspace
   - Query roles, permissions, divisions, settings
   - Assert: All baseline data present

3. **Isolation Verification**
   - Provision workspace_a and workspace_b concurrently
   - Attempt cross-database query from workspace_a to workspace_b
   - Assert: Query fails (database-level isolation enforced)

### 7.4 Concurrency Tests

**Location:** `apps/worker/tests/concurrency/lock-safety.test.ts`

**Tests:**

1. **Lock Collision Handling**
   - 5 workers attempt to provision same workspace
   - Assert: 1 succeeds, 4 get lock collision, 4 retry successfully

2. **Different Workspace Concurrency**
   - 5 workers attempt to provision 5 different workspaces
   - Assert: All 5 succeed in parallel (no lock contention)

3. **Lock Expiration Safety**
   - Worker acquires lock
   - Lock TTL expires (simulated)
   - Different worker acquires lock
   - Assert: Original worker detects lock lost, rolls back gracefully

---

## 8. Monitoring & Observability

### 8.1 Structured Logging

**All logs follow format:**

```json
{
  "timestamp": "ISO8601",
  "level": "info|warn|error|fatal|debug",
  "service": "provisioning-worker",
  "version": "1.0.0",
  "correlation_id": "<uuid>",
  "workspace_slug": "<slug>",
  "license_id": 12345,
  "organization_id": 54321,
  "event": "<event_name>",
  "details": {},
  "error": null | {"code": "...", "message": "...", "stack": "..."},
  "duration_ms": 1234
}
```

### 8.2 Critical Events Logged

```
1. provisioning_job_dequeued
   {event: "provisioning_job_dequeued", license_id, workspace_slug, attempt: 1}

2. provisioning_lock_acquired
   {event: "provisioning_lock_acquired", lock_key: "provisioning:<slug>"}

3. provisioning_database_created
   {event: "provisioning_database_created", database_name: "workspace_<slug>"}

4. provisioning_migration_applied
   {event: "provisioning_migration_applied", migration_version: "1.0.0.001", duration_ms: 450}

5. provisioning_schema_initialized
   {event: "provisioning_schema_initialized", tables_count: 15, duration_ms: 2300}

6. provisioning_seed_data_applied
   {event: "provisioning_seed_data_applied", rows_inserted: 42, duration_ms: 150}

7. provisioning_registry_entry_created
   {event: "provisioning_registry_entry_created", registry_id: 9876}

8. provisioning_license_transitioned
   {event: "provisioning_license_transitioned", from_state: "PROVISIONING", to_state: "ACTIVE"}

9. provisioning_pool_registered
   {event: "provisioning_pool_registered", workspace_slug: "<slug>"}

10. provisioning_completed
    {event: "provisioning_completed", status: "success", total_duration_ms: 8234}

11. provisioning_failed
    {event: "provisioning_failed", failed_step: "schema_initialization", error_code: "PROV_003", error_message: "..."}

12. provisioning_lock_released
    {event: "provisioning_lock_released"}

13. provisioning_job_retry
    {event: "provisioning_job_retry", attempt: 2, backoff_ms: 10000, reason: "PROV_002"}

14. provisioning_job_dlq
    {event: "provisioning_job_dlq", attempt: 3, total_duration_ms: 45000, reason: "PROV_003"}
```

### 8.3 Prometheus Metrics

```
# Timing
provisioning_duration_seconds{workspace_slug, status="success|failure"}
provisioning_migration_seconds{workspace_slug, migration_version}
provisioning_database_creation_seconds{workspace_slug}
provisioning_seed_seconds{workspace_slug}

# Counts
provisioning_job_total{status="success|failure|retry|dlq"}
provisioning_lock_collisions_total{workspace_slug}
provisioning_database_total{status="created|deleted|orphaned"}

# Latency
provisioning_job_duration_histogram_seconds{le=...}
```

### 8.4 Health Checks

**Provisioning Service Health:**

```
GET /health/provisioning

Response:
{
  "status": "healthy|degraded|unhealthy",
  "checks": {
    "master_db_connection": "ok|error",
    "redis_connection": "ok|error",
    "worker_process_alive": "ok|error",
    "job_queue_depth": 5,
    "dlq_queue_depth": 0
  }
}
```

**Alerting Rules:**

- DLQ queue depth > 5 → Alert ops
- Lock collision rate > 10/hour → Investigate provisioning bottleneck
- Provisioning duration > 60 seconds → Alert (SLA warning)
- Registry orphans detected → Alert for manual investigation

---

## 9. Performance & Scalability

### 9.1 Performance Targets

| Metric                   | Target       | Justification                                                                  |
| ------------------------ | ------------ | ------------------------------------------------------------------------------ |
| Provisioning duration    | < 30 seconds | User should see "provisioning in progress" notification, not wait indefinitely |
| Database creation        | < 5 seconds  | PostgreSQL CREATE DATABASE is fast unless system overloaded                    |
| Schema migration (total) | < 15 seconds | ~15 baseline migrations × ~1 second each                                       |
| Seed data                | < 2 seconds  | ~50-100 seed rows insert quickly                                               |
| Registry write           | < 1 second   | Single INSERT operation                                                        |
| License transition       | < 1 second   | Single UPDATE operation                                                        |
| Lock overhead            | < 1 second   | Redis SET/DEL operations are sub-millisecond                                   |

### 9.2 Throughput Targets

| Metric                                  | Target            | Method                                                                    |
| --------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| Single worker throughput                | 10-20 jobs/minute | Sequential job processing; depends on average job duration                |
| Multi-worker throughput                 | Linear scaling    | 3 workers: 30-60 jobs/minute (no lock contention between different slugs) |
| Concurrent provisions (different slugs) | 10+ simultaneous  | Lock is per-slug; different slugs don't contend                           |

### 9.3 Connection Pool Sizing

**Master Pool:**

- Size: 10-20 connections
- Purpose: Provisioning service only
- Usage: Low frequency (one connection per provisioning job)

**Tenant Pools (per-tenant):**

- Size: 5-10 connections per workspace
- Purpose: Application queries
- Usage: High frequency for active workspaces
- Scaling: Linear with number of active tenants

**Redis:**

- Connection pool: 5-10 connections
- Purpose: Job queue, locks, caching
- Usage: High frequency (every job + every lock operation)

### 9.4 Database Performance Considerations

**Indexes Created:**

- `tenants_registry(workspace_slug)` - Fast slug lookups
- `tenants_registry(license_id)` - Fast license lookups
- `licenses(status)` - Fast filtering by license state
- `schema_migrations(version)` - Fast migration lookups

**Constraints:**

- `tenants_registry(workspace_slug) UNIQUE` - Prevents duplicates
- `tenants_registry(license_id) UNIQUE` - 1:1 mapping enforced
- `schema_migrations(version) UNIQUE` - Immutable migration versions

**Transaction Isolation:**

- `REPEATABLE READ` for all critical operations
- Prevents phantom reads during concurrent modifications
- No SERIALIZABLE overhead

---

## 10. Security & Compliance

### 10.1 Credential Handling

**Storage Policy:**

- **Production:** Docker Secrets (mounted at `/run/secrets/`)
- **Development:** Environment variables (`.env` file, local only)
- **Transport:** Never logged, never exposed to frontend

**Credential Scope:**

- **Master DB:** Provisioning service account (full DDL + DML)
- **Tenant DB:** Tenant service account (application-scoped DML, no DDL)

**Example Credentials Flow:**

```
1. Worker startup:
   - Read /run/secrets/provisioning_db_user
   - Read /run/secrets/provisioning_db_password
   - Create master pool with these credentials

2. During provisioning:
   - Use master credentials to create new tenant database
   - Generate tenant-specific credentials (different user)
   - Store tenant credentials externally (not in code)
   - Tenant credentials used by subsequent API requests
```

### 10.2 Audit Trail Design

**Events Logged:**

- Provisioning lifecycle (all 14 events in Section 8.2)
- License state transitions
- Lock collisions
- Errors and retries
- Rollbacks

**Audit Entry Format:**

```json
{
  "timestamp": "ISO8601",
  "correlation_id": "<uuid>",
  "workspace_slug": "<slug>",
  "license_id": 12345,
  "event": "provisioning_started|provisioning_completed|provisioning_failed",
  "actor": "system",  // Always "system" for provisioning
  "details": {...}
}
```

**No PII in Logs:**

- Workspace slug is metadata (not sensitive)
- License ID is metadata (not sensitive)
- User data never logged during provisioning
- Credentials never logged
- Connection strings never logged

### 10.3 PII Protection

**Baseline Seed:**

- NO demo user accounts created
- NO email addresses seeded
- NO personal information in seed data
- Only structural scaffolding (roles, permissions, divisions)

**Future User Data:**

- Application layer handles user creation (after provisioning)
- Encryption at rest (handled by DevOps/infrastructure)
- Encryption in transit (TLS enforced)

### 10.4 Access Control Enforcement

**Application-Level:**

- API middleware validates JWT workspace scope
- User cannot access workspace outside their scope
- Role-based access control enforced for all operations

**Database-Level:**

- Tenant databases accessed only via tenant-specific pool
- Tenant connection credentials scoped to their database
- No cross-tenant SQL queries possible (database isolation)

**Provisioning-Level:**

- Worker runs with provisioning service account (elevated)
- Provisioning logic never exposed to untrusted input (no user-facing endpoint)
- License validation mandatory before provisioning starts

---

## 11. Dependency Graph

### 11.1 Provisioning Service Dependencies

```
Provisioning Service
├─ PostgreSQL (master DB)
│  ├─ licenses table (read/write)
│  └─ tenants_registry table (write)
├─ PostgreSQL (tenant DB)
│  ├─ schema_migrations table (write)
│  ├─ provisioning_checkpoints table (write)
│  └─ all baseline tables (initialize)
├─ Redis
│  ├─ provisioning_jobs queue (read)
│  ├─ provisioning_jobs_retry queue (write)
│  ├─ provisioning_jobs_dlq queue (write)
│  └─ distributed locks (distributed_lock:<slug>)
├─ packages/domain-core
│  └─ Tenant resolver, validation utilities
├─ packages/validation
│  └─ Slug format validation, checksum validation
└─ packages/config
   └─ Database connection strings, retry config
```

### 11.2 External Dependencies

- **PostgreSQL:** Schema creation, data management
- **Redis:** Job queue, distributed locks
- **Migration files:** Version-controlled in git (part of deployment)
- **Docker Secrets:** Runtime credential injection

### 11.3 Upstream Dependencies (Required Before Provisioning)

- **STAGE_02:** Multi-tenancy database isolation model
- **STAGE_02C:** Migration and versioning model
- **STAGE_04:** License engine (license creation)

### 11.4 Downstream Dependencies (Enable After Provisioning)

- **STAGE_06:** Attempt engine (depends on tenant DB existence + schema version)
- **All tenant-bound operations:** Depend on pool registration
- **Frontoffice:** Depends on provisioned tenant databases

---

## 12. Acceptance Criteria Mapping

### 12.1 Functional Acceptance Criteria

| Criterion                              | Measurement                                            | Validation                                                                          |
| -------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| **AC1: Async provisioning works**      | Job dequeued, processed, completed                     | Integration test: provision job successfully → Pool registered → DB queryable       |
| **AC2: Database isolation guaranteed** | No cross-tenant query possible                         | Static analysis: 0 cross-tenant JOINs; Runtime: attempt cross-DB query → Fails      |
| **AC3: Lock prevents duplicates**      | Two parallel provisions of same slug                   | Concurrency test: 2 workers → 1 succeeds, 1 lock collision → Retry succeeds         |
| **AC4: Idempotency proven**            | Replay same job 3 times                                | Integration test: Replay job → No-op on retries → Final state identical             |
| **AC5: Schema initialized**            | All baseline tables exist                              | Query tenants_registry → List all tables → Assert 15+ tables exist                  |
| **AC6: Registry consistency**          | Registry ↔ DB ↔ License aligned                        | Consistency test: Compare all three → All states aligned, 0 orphans                 |
| **AC7: Archive snapshot works**        | Take snapshot of provisioned workspace                 | (Deferred to STAGE_07)                                                              |
| **AC8: Restore from snapshot**         | Restore archived workspace                             | (Deferred to STAGE_07)                                                              |
| **AC9: Permanent deletion**            | Delete workspace, clean up                             | (Deferred to STAGE_07)                                                              |
| **AC10: Rollback on failure**          | Schema init fails → Cleanup → Retry succeeds           | Integration test: Simulate failure → Verify rollback → Retry succeeds               |
| **AC11: Version compatibility**        | Query schema version, matches expected                 | Query tenant DB schema_version → Assert '1.0.0'                                     |
| **AC12: License state transitions**    | License CREATED → PROVISIONING → ACTIVE                | Trace licensing flow → Assert state changes at expected points                      |
| **AC13: Distributed lock works**       | Lock acquisition, release, expiration                  | Unit test lock: acquire → hold → release; TTL expiration                            |
| **AC14: Retry with backoff**           | Transient error → Exponential backoff → Retry succeeds | Integration test: Simulate transient → Verify backoff timing → Verify retry success |

### 12.2 Non-Functional Acceptance Criteria

| Criterion                           | Measurement                          | Validation                                                             |
| ----------------------------------- | ------------------------------------ | ---------------------------------------------------------------------- |
| **AC15: Concurrency safety**        | Provision 10 workspaces concurrently | Concurrency test: 10 parallel jobs → All succeed, 0 collisions/orphans |
| **AC16: Retry resilience**          | 95%+ recovery rate after 2-3 retries | Integration test: 100 transient failures → 95%+ resolved after retries |
| **AC17: Performance < 30s**         | Provisioning duration                | Performance test: 10 provisions → All < 30 seconds                     |
| **AC18: Throughput 10-20 jobs/min** | Single worker jobs per minute        | Throughput test: 1 worker × 10 minutes → 100-200 jobs completed        |
| **AC19: Lock efficiency < 5s**      | Lock hold time                       | Concurrency test: Monitor lock hold time → Assert avg < 5 seconds      |

### 12.3 Security Acceptance Criteria

| Criterion                       | Measurement                       | Validation                                                                |
| ------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| **AC20: No credential leakage** | Log content analysis              | Audit logs: 0 credentials, connection strings, or PII                     |
| **AC21: Slug validation**       | Fuzzing with malicious input      | Security test: SQL injection, special chars → All rejected safely         |
| **AC22: License enforcement**   | Attempt provision without license | Security test: Missing license_id → Reject (PROV_008)                     |
| **AC23: Checksum integrity**    | Detect migration tampering        | Unit test: Modify migration content → Checksum mismatch → Fail (PROV_010) |
| **AC24: Audit trail complete**  | Correlation ID tracing            | Trace provisioning job → All 14 events have correlation_id                |

### 12.4 Architectural Acceptance Criteria

| Criterion                       | Measurement                   | Validation                                               |
| ------------------------------- | ----------------------------- | -------------------------------------------------------- |
| **AC25: ADR-0001 compliance**   | Database isolation verified   | Architecture review: Each tenant fully isolated database |
| **AC26: No cross-tenant joins** | Code review + static analysis | Grep codebase: 0 cross-tenant queries                    |

---

## 13. Implementation Phases & Milestones

### Phase 1: Schema & Migrations (Duration: 3-5 days)

**Objectives:**

- Implement master DB migrations (licenses table updates, tenants_registry creation)
- Implement tenant DB baseline migrations (all 15+ structural tables)
- Implement schema version and migration tracking tables
- Implement provisioning checkpoint table

**Deliverables:**

1. Migration files: `add_provisioning_fields_to_licenses.sql`
2. Migration files: `create_tenants_registry_table.sql`
3. Tenant baseline migrations: `001-create-schema-version.sql` through `005-create-core-tables.sql`
4. Seed script: `seed-baseline-data.sql`
5. Documentation: Schema design, migration strategy

**Testing:**

- Unit test: Validate migration syntax
- Integration test: Run migrations end-to-end
- Verify: All tables, indexes, constraints created

**Acceptance:** All migrations executable, no errors, schema_version table exists

### Phase 2: Worker Job Implementation (Duration: 5-7 days)

**Objectives:**

- Implement provisioning service class with all 9 steps
- Implement distributed lock acquisition/release (Redis)
- Implement retry strategy with exponential backoff
- Implement DLQ handling

**Deliverables:**

1. `ProvisioningService` class with provision() method
2. Lock manager with acquire/release logic
3. Retry queue manager with backoff calculation
4. DLQ monitoring and alerting
5. Comprehensive error handling

**Testing:**

- Unit tests: Lock logic, retry backoff, error classification
- Integration tests: Provision happy path, lock collision, retry flow
- Concurrency tests: Multiple workers provisioning different workspaces

**Acceptance:** Provisioning jobs process start-to-finish, lockups resolve, retries work

### Phase 3: Integration & Error Handling (Duration: 4-6 days)

**Objectives:**

- Integrate tenant resolver middleware into API
- Integrate license enforcement middleware
- Integrate worker queue dequeuing into worker process
- Implement comprehensive rollback logic
- Implement crash recovery via checkpoints

**Deliverables:**

1. Tenant resolver middleware
2. License enforcement middleware
3. Worker loop for continuous job dequeuing
4. Rollback procedures for each failure point
5. Checkpoint writing logic for crash recovery

**Testing:**

- Integration tests: Middleware stack, license validation
- Error handling tests: Rollback on DB creation failure, schema init failure, registry failure
- Crash recovery tests: Simulate & recover from crash at each step

**Acceptance:** Middleware properly ordered, rollback leaves no orphans, recovery works

### Phase 4: Testing & Stability (Duration: 5-7 days)

**Objectives:**

- Comprehensive unit test coverage
- Integration test coverage for all scenarios
- Concurrency testing (10+ parallel provisions)
- Crash recovery validation
- Load testing (throughput validation)

**Deliverables:**

1. Unit test suite (80%+ coverage of provisioning logic)
2. Integration test suite (all success/failure scenarios)
3. Concurrency test suite (parallel provisions)
4. Crash recovery test suite
5. Load test results (throughput, latency, scalability)

**Testing:**

- Coverage report: All critical paths covered
- Load test: Single worker handles 10-20 jobs/minute
- Concurrency test: 10 workers provisioning 100 workspaces simultaneously

**Acceptance:** All tests pass, coverage > 80%, load test targets met

### Phase 5: Monitoring & Operations (Duration: 3-4 days)

**Objectives:**

- Implement structured logging for all 14 events
- Implement Prometheus metrics
- Set up health checks and alerting
- Create operational runbooks
- Create monitoring dashboards

**Deliverables:**

1. Structured logger implementation
2. Prometheus metrics exporter
3. Health check endpoints
4. Alert rules (DLQ depth, lock collision rate, provisioning duration)
5. Operational runbook (DLQ recovery, orphan cleanup, troubleshooting)
6. Grafana dashboard (provisioning metrics, job flow)

**Testing:**

- Verify all events logged with correct format
- Verify metrics exported correctly
- Test alerts trigger at thresholds
- Verify runbook procedures work

**Acceptance:** Logs structured, metrics exported, alerts functional, runbook tested

**Total Duration:** 20-29 days (approximately 4-5 weeks)

---

## 14. Implementation Rationale & Best Practices

### 14.1 Architecture Decisions & Rationale

#### Decision 1: Database-per-Tenant Isolation

**Choice:** Separate PostgreSQL database per tenant (physical isolation)

**Rationale:**

- Maximum isolation guarantee (database-level, not row-level)
- No risk of cross-tenant queries due to programming error
- Simpler scaling model (can shard tenants across multiple PostgreSQL instances later)
- Aligns with ADR-0001

**Alternatives Considered:**

- Row-based multi-tenancy: Risk of cross-tenant data leakage via buggy queries
- Schema-per-tenant: Fewer databases, but same isolation risk as row-based
- Rejected: Row-level security provides weaker guarantees

#### Decision 2: Worker-Only Provisioning

**Choice:** Provisioning DDL/DML executes exclusively in Worker process

**Rationale:**

- Separates infrastructure creation (worker) from request handling (API)
- Worker process failure doesn't disrupt API availability
- Asynchronous provisioning doesn't block user requests
- Schema changes cannot accidentally run during API restart/crash

**Alternatives Considered:**

- Synchronous provisioning in API: Risk of API crashes losing partial state
- Background job + API completion: Decouples better, less coordin ation needed

#### Decision 3: Distributed Lock (Redis)

**Choice:** Redis-based TTL lock for concurrency safety

**Rationale:**

- Fast lock acquisition (sub-millisecond)
- TTL safety net (auto-release if worker crashes)
- Simple implementation vs. distributed consensus algorithms
- Sufficient for "provision different slugs in parallel" use case

**Alternatives Considered:**

- PostgreSQL advisory locks: Tied to database availability; slower
- ZooKeeper: Overkill for this use case; operational complexity

#### Decision 4: Explicit Checkpoints for Crash Recovery

**Choice:** Checkpoint table in tenant DB tracking provisioning progress

**Rationale:**

- No dependency on external state (checkpoints stored in tenant DB)
- Can resume from exact failure point (idempotency)
- Safe replay via migration checksums
- Durable (PostgreSQL transaction guarantees)

**Alternatives Considered:**

- Filesystem state: Risk of inconsistency if worker crashes mid-write
- JobQueue status field: Insufficient granularity for resume-from-point
- Re-detect state from schema_migrations table: Requires scanning; checkpoints faster

#### Decision 5: REPEATABLE READ Isolation Level

**Choice:** All provisioning transactions use REPEATABLE READ

**Rationale:**

- Prevents non-repeatable reads during concurrent modifications
- Avoids phantom read risk (not an issue with lock, but good practice)
- Standard OLTP isolation (not overly expensive like SERIALIZABLE)
- Forward-compatible with future schema versions

**Alternatives Considered:**

- READ COMMITTED: Risk of inconsistent reads mid-operation
- SERIALIZABLE: Performance overhead not justified for this use case

### 14.2 Alternative Approaches Considered & Rejected

#### Alternative 1: Synchronous Provisioning in API

**Approach:** Provision on-demand during POST /workspace/create API request

**Rationale for Rejection:**

- Blocks API request for 30+ seconds (poor UX)
- Database creation in request context risks losing partial state on exception
- API process restart could corrupt provisioning state
- Violates separation of concerns (API shouldn't do DDL)

#### Alternative 2: Row-Based Multi-Tenancy

**Approach:** Single database, row-level tenant filtering

**Rationale for Rejection:**

- Programming error can leak cross-tenant data
- Violates ADR-0001 (Database-per-Tenant)
- Harder to scale (single database bottleneck)
- Less operational flexibility

#### Alternative 3: Implicit Crash Recovery (Detect State)

**Approach:** On retry, query schema_migrations table to detect progress

**Rationale for Rejection:**

- Requires scanning schema_migrations table (slower)
- Less explicit; easier to miss edge cases
- Checkpoints table more maintainable

### 14.3 Risk Mitigation Strategies

#### Risk 1: Database Creation Fails Silently

**Mitigation:**

- Validate database creation success via: SELECT datname FROM pg_database
- If database doesn't exist after CREATE DATABASE command, treat as permanent error (DLQ)
- Log database validation status

#### Risk 2: Partial Schema Initialization

**Mitigation:**

- All baseline migrations in single transaction (auto-rollback on any failure)
- Each migration tagged with immutable checksum (detect tampering)
- Checkpoint after each migration (resume capability)

#### Risk 3: Lock Collision During Peak Provisioning

**Mitigation:**

- Lock TTL: 60 seconds (auto-release if holder dies)
- Exponential backoff for retries (5s, 10s, 20s, 60s)
- Monitor lock collision rate; alert if sustained > 10/hour

#### Risk 4: Cross-Tenant Data Access

**Mitigation:**

- Static code analysis: Grep for cross-database queries
- Integration test: Attempt cross-DB query from tenant pool → Assert fails
- Regular security audit of tenant resolver code

#### Risk 5: Credential Exposure in Logs

**Mitigation:**

- Credential strings never logged (use error codes instead)
- Log audit: Scan for password/connection_string patterns
- Code review: No logging of request/response bodies containing secrets

#### Risk 6: Orphan Databases After Rollback

**Mitigation:**

- Explicit cleanup on every failure path (DROP DATABASE <slug>)
- Background orphan detection job (run every 1 hour)
- Alerts on orphan detection (manual ops intervention)

---

## 15. Compliance Verification

### 15.1 Constitution Alignment Checklist

✅ **No cross-tenant access:** Pool isolation + database isolation enforced ✅ **No middleware
bypass:** All workspace requests go through tenant resolver + license check ✅ **No direct DB
instantiation:** All connections via resolver context or provisioning pool ✅ **No global DB
singleton:** Master pool for provisioning only; tenant pools per-workspace ✅ **Transaction
atomicity:** Critical writes transactional with REPEATABLE READ ✅ **Idempotency proven:**
Checksums + upserts + checkpoint table enable safe replay ✅ **Correlation ID propagation:** All 14
events logged with correlation_id ✅ **Structured logging only:** JSON format enforced; no
console.log in production code ✅ **Worker-only execution:** DDL/DML in worker, never in API process
✅ **Version enforcement:** Schema version tracked, validated at runtime ✅ **No weakening of
snapshot integrity:** Configuration snapshotting in STAGE_06 (not here)

### 15.2 ADR Compliance

| ADR      | Requirement                   | Compliance | Notes                                       |
| -------- | ----------------------------- | ---------- | ------------------------------------------- |
| ADR-0001 | Database-per-tenant isolation | ✅         | Each tenant gets separate database          |
| ADR-0007 | Product version compatibility | ✅         | License validation before pool registration |
| ADR-0008 | Semantic versioning           | ✅         | Schema version 1.0.0 baseline               |

### 15.3 Error Handling Standard

**All error responses follow format:**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PROV_001",
    "message": "Slug already registered"
  }
}
```

✅ **Format enforced:** All 10 error codes follow this format

### 15.4 Database Migration Policy

✅ **One migration per feature:** Master DB changes in 1 file, tenant baseline in multiple files ✅
**Never modify old migrations:** All migrations immutable-checksum enforced ✅ **Forward-only
migrations:** No rollback semantics; only restore-from-snapshot ✅ **Version alignment:** Migration
version = schema version (1.0.0)

---

## 16. Non-Goals & Assumptions

### 16.1 Out of Scope (Deferred to Future Stages)

- **Archive snapshots:** Handled by STAGE_07 (Backup & Recovery)
- **Restore from snapshot:** Handled by STAGE_07
- **User account creation:** Handled by frontoffice (STAGE_07+)
- **Exam configuration:** Handled by frontoffice
- **Attempt submission/grading:** Handled by STAGE_06 (Attempt Engine)
- **Email notifications:** Deferred to later stages
- **Certificate generation:** Deferred to later stages
- **Reporting system:** Out of scope for provisioning

### 16.2 Core Assumptions

1. **External Snapshot Storage Exists:** Assumes DevOps provisioned backup storage (S3, Azure Blob,
   etc.)
2. **PostgreSQL Configured:** Single PostgreSQL instance with `template0` database for cloning
3. **Redis Available:** Redis instance/cluster for job queue and distributed locks
4. **Server Clocks NTP-Synchronized:** Required for lock TTL reliability across servers
5. **Migration Checksums Immutable:** Once published, migration checksum never changes
6. **No Dynamic SQL:** Slug always parameterized, never string-interpolated
7. **Application Uses UPSERT Semantics:** Seed operations replay safely

---

## 17. Final Compliance Statement

> **Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.**
>
> ✅ **Architectural Scope:** All work confined to provisioning service; no boundary violations ✅
> **Trust Chain:** Isolation layer established; enables subsequent License → Authentication →
> Runtime layers ✅ **Multi-Tenancy:** Database-per-tenant isolation enforced at infrastructure
> level ✅ **Middleware Ordering:** Tenant Resolver → License Enforcement → Schema Version → Route
> Handler ✅ **Transaction Safety:** All critical writes atomic with REPEATABLE READ ✅
> **Idempotency:** Provisioning safely retryable via checkpoints + checksums ✅ **Logging:**
> Structured JSON format; correlation_id propagated to all events ✅ **Worker Authority:** All
> DDL/DML executes in worker; API process never touches schema ✅ **Error Handling:** All errors
> mapped to HTTP status codes; recovery paths defined ✅ **Version Enforcement:** Schema version
> tracked, validated pre-deployment ✅ **Security:** No credential leakage, no PII in logs, no
> cross-tenant access vectors ✅ **Testing:** Unit, integration, concurrency, and recovery tests
> defined

**Status:** ✅ **READY FOR IMPLEMENTATION**

---

## Appendix: Quick Reference

### Checklist Before Implementation

- [ ] Specification reviewed and clarifications resolved
- [ ] Plan reviewed by architecture team
- [ ] No conflicts with existing ADRs detected
- [ ] Database migrations syntax validated
- [ ] Test strategy reviewed and feasible
- [ ] Monitoring and alerting plan complete
- [ ] Operational runbook drafted
- [ ] Team capacity allocated for 20-29 day sprint
- [ ] Deployment checklist prepared
- [ ] Rollback strategy documented

### Key Files to Create/Modify

```
apps/api/src/db/master/migrations/
  ├─ 2026-02-18-add-provisioning-fields-to-licenses.sql
  └─ 2026-02-18-create-tenants-registry-table.sql

apps/api/src/db/tenant/migrations/
  ├─ 001-create-schema-version.sql
  ├─ 002-create-schema-migrations.sql
  ├─ 003-create-provisioning-checkpoints.sql
  ├─ 004-create-core-tables.sql
  └─ 005-seed-baseline-data.sql

apps/worker/src/
  ├─ provisioning-service.ts (Main service class)
  ├─ provisioning-worker.ts (Worker loop)
  ├─ lock-manager.ts (Distributed lock)
  └─ retry-manager.ts (Retry/DLQ logic)

apps/api/src/middleware/
  ├─ tenant-resolver.ts
  └─ license-enforcement.ts

apps/worker/tests/
  ├─ unit/*
  ├─ integration/*
  └─ concurrency/*
```

### Deployment Checklist

- [ ] All migrations tested in staging
- [ ] Worker code deployed and health checks passing
- [ ] Middleware integrated and tested end-to-end
- [ ] Monitoring/alerting configured and validated
- [ ] DLQ recovery procedure tested in staging
- [ ] Logging validated (no credential leakage)
- [ ] Performance tested (< 30s, 10-20 jobs/min)
- [ ] Rollback procedure documented and tested
- [ ] Ops team trained on runbook
- [ ] Go/No-Go decision from architecture team

---

**Plan Version:** 1.0.0  
**Created:** 2026-02-18  
**Status:** READY FOR IMPLEMENTATION  
**Authority:** Zidney Constitution v1.2.0

---

**End of Implementation Plan**
