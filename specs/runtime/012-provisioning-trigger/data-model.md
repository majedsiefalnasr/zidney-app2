# Data Model: STAGE 12 – Provisioning Trigger

**Feature**: Tenant Provisioning Trigger System  
**Date**: 2026-02-24  
**Version**: 1.0.0

---

## Entity-Relationship Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Master Database (Shared)                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐          ┌──────────────────┐               │
│  │  licenses    │ 1───────∞│ tenants_registry │               │
│  │              │ (via id) │                  │               │
│  └──────────────┘          └──────────────────┘               │
│                                                                 │
│  Fields added:                                                  │
│  - status (PENDING_PROVISION, ACTIVE, PROVISION_FAILED)       │
│  - schema_version, product_version                             │
│  - retry_count, last_provision_error                           │
│  - provisioned_at, failed_at timestamps                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Tenant Database (Per Workspace)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ schema_versions  │  │     roles        │                   │
│  └──────────────────┘  └────────┬─────────┘                   │
│                                 │ 1                            │
│                      ┌──────────┴─────────┐                  │
│                      │ users        (1 user │ 1 role)         │
│                      │ (rel: role_id FK)   │                   │
│                      └─────────────────────┘                   │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ permissions      │  │ workspace_settings│                   │
│  └──────────────────┘  └──────────────────┘                   │
│                                                                 │
│  ┌──────────────────┐                                          │
│  │ divisions        │  (Optional, if uses_divisions=true)     │
│  └──────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Master Database Schema Changes

### Table: `licenses` (MODIFY)

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

-- Indexes for efficient state queries
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_workspace_slug ON licenses(workspace_slug);
CREATE INDEX idx_licenses_created_at ON licenses(created_at DESC);
```

**Fields**:

| Field                  | Type          | Default             | Nullable | Purpose                                                     |
| ---------------------- | ------------- | ------------------- | -------- | ----------------------------------------------------------- |
| `status`               | varchar(32)   | 'PENDING_PROVISION' | NO       | License provisioning state                                  |
| `schema_version`       | varchar(50)   | —                   | NO       | Frozen platform schema version at creation                  |
| `product_version`      | varchar(50)   | —                   | NO       | Frozen product version at creation                          |
| `retry_count`          | int           | 0                   | NO       | Count of failed retry attempts                              |
| `last_provision_error` | varchar(1024) | NULL                | YES      | Last error message (truncated to 1024 chars)                |
| `provisioned_at`       | timestamp     | NULL                | YES      | When Worker completed provisioning (set to now() by Worker) |
| `failed_at`            | timestamp     | NULL                | YES      | When Worker marked as PROVISION_FAILED                      |

**Lifecycle**:

1. License created: `status='PENDING_PROVISION'`, `provisioned_at=NULL`, `failed_at=NULL`
2. Provisioning succeeds: `status='ACTIVE'`, `provisioned_at=<server_time>`, `failed_at=NULL`
3. Provisioning fails: `status='PROVISION_FAILED'`, `failed_at=<server_time>`, `last_provision_error=<msg>`

---

### Table: `tenants_registry` (CREATE)

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

-- Indexes for efficient lookups
CREATE INDEX idx_tenants_registry_license_id ON tenants_registry(license_id);
CREATE INDEX idx_tenants_registry_workspace_slug ON tenants_registry(workspace_slug);
CREATE INDEX idx_tenants_registry_db_name ON tenants_registry(db_name);
```

**Purpose**: Central registry mapping license → workspace → database. Single source of truth for workspace existence.

**Fields**:

| Field            | Type         | Default           | Nullable | Uniqueness | Purpose                                        |
| ---------------- | ------------ | ----------------- | -------- | ---------- | ---------------------------------------------- |
| `id`             | uuid         | gen_random_uuid() | NO       | PK         | Record identifier                              |
| `license_id`     | uuid         | —                 | NO       | UNIQUE     | Foreign key to licenses; one entry per license |
| `workspace_slug` | varchar(255) | —                 | NO       | UNIQUE     | Tenant identifier (lowercase, hyphens)         |
| `db_name`        | varchar(255) | —                 | NO       | UNIQUE     | PostgreSQL database name (workspace\_<slug>)   |
| `schema_version` | varchar(50)  | —                 | NO       | —          | Tenant schema version at provisioning time     |
| `created_at`     | timestamp    | now()             | NO       | —          | Server timestamp when registry entry created   |
| `updated_at`     | timestamp    | now()             | NO       | —          | Server timestamp when last updated             |

**Constraints**:

- **Referential Integrity**: `license_id` → `licenses(id)` with ON DELETE CASCADE
- **Uniqueness**: One entry per `license_id`, `workspace_slug`, and `db_name`
- **Safe Deletion**: Deleting license cascades to registry (optional future cleanup task)

**Invariants**:

- ✅ Registry entry exists ⟺ Tenant database exists ⟺ License status = ACTIVE
- ✅ No orphaned registries (license deleted × database still exists)
- ✅ No orphaned databases (database exists × registry entry missing)

---

## Tenant Database Baseline Schema

Each tenant database created by Worker contains the following baseline tables:

### Table: `schema_versions`

```sql
CREATE TABLE schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version varchar(50) NOT NULL,
  applied_at timestamp NOT NULL DEFAULT now(),
  checksum varchar(128) NOT NULL,
  UNIQUE(version)
);
```

**Purpose**: Track which schema migrations have been applied. Prevents re-application and detects anomalies.

**Fields**:

| Field        | Type         | Default           | Purpose                                              |
| ------------ | ------------ | ----------------- | ---------------------------------------------------- |
| `id`         | uuid         | gen_random_uuid() | Record identifier                                    |
| `version`    | varchar(50)  | —                 | Migration version (e.g., '1.2.0')                    |
| `applied_at` | timestamp    | now()             | Server timestamp when migration applied              |
| `checksum`   | varchar(128) | —                 | SHA256 checksum of migration SQL (detects tampering) |

**Lifecycle**:

1. Worker fetches licenses.schema_version (e.g., '1.2.0')
2. For each migration ≤ '1.2.0': Execute SQL, then INSERT into schema_versions
3. Subsequent provisioning checks schema_versions before re-applying (idempotent)

---

### Table: `roles`

```sql
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  description varchar(500),
  created_at timestamp NOT NULL DEFAULT now()
);
```

**Purpose**: Define workspace role hierarchy. Used for RBAC.

**Baseline Roles** (inserted during seed):

- `ADMIN` - Workspace administrator with full permissions
- `STAFF` - Staff member with reduced permissions
- `STUDENT` - Student with minimal permissions
- `SUPPORT` - Support staff with read-only access

**Fields**:

| Field         | Type         | Default           | Purpose                          |
| ------------- | ------------ | ----------------- | -------------------------------- |
| `id`          | uuid         | gen_random_uuid() | Role identifier                  |
| `name`        | varchar(100) | —                 | Unique role name (e.g., 'ADMIN') |
| `description` | varchar(500) | NULL              | Human-readable description       |
| `created_at`  | timestamp    | now()             | Seed timestamp                   |

---

### Table: `permissions`

```sql
CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  description varchar(500),
  created_at timestamp NOT NULL DEFAULT now()
);
```

**Purpose**: Define granular permissions for role-based access control.

**Baseline Permissions** (inserted during seed):

- `CREATE_EXAM`
- `GRADE_EXAM`
- `VIEW_REPORTS`
- `MANAGE_STUDENTS`
- `MANAGE_STAFF`
- Additional permissions as per product spec

**Fields**:

| Field         | Type         | Default           | Purpose                   |
| ------------- | ------------ | ----------------- | ------------------------- |
| `id`          | uuid         | gen_random_uuid() | Permission identifier     |
| `name`        | varchar(100) | —                 | Unique permission name    |
| `description` | varchar(500) | NULL              | Description of permission |
| `created_at`  | timestamp    | now()             | Seed timestamp            |

---

### Table: `workspace_settings`

```sql
CREATE TABLE workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key varchar(255) NOT NULL UNIQUE,
  setting_value text NOT NULL,
  value_type varchar(50) NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
```

**Purpose**: Store workspace-level configuration. Tenant-specific settings from license.

**Baseline Settings** (inserted during seed):

| Key                | Type   | Value Source          | Example |
| ------------------ | ------ | --------------------- | ------- |
| `STUDENT_LIMIT`    | number | license.student_limit | 5000    |
| `STAFF_LIMIT`      | number | license.staff_limit   | 100     |
| `DEFAULT_LANGUAGE` | string | job.default_language  | 'en'    |
| `TIMEZONE`         | string | Platform default      | 'UTC'   |

**Fields**:

| Field           | Type         | Default           | Purpose                                     |
| --------------- | ------------ | ----------------- | ------------------------------------------- |
| `id`            | uuid         | gen_random_uuid() | Record identifier                           |
| `setting_key`   | varchar(255) | —                 | Unique setting name                         |
| `setting_value` | text         | —                 | Value (stored as string, type separate)     |
| `value_type`    | varchar(50)  | —                 | Type indicator (string/number/boolean/json) |
| `created_at`    | timestamp    | now()             | When created                                |
| `updated_at`    | timestamp    | now()             | When last modified                          |

---

### Table: `divisions` (Conditional)

```sql
CREATE TABLE divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  code varchar(50) UNIQUE,
  created_at timestamp NOT NULL DEFAULT now()
);
```

**Purpose**: Organizational hierarchy (e.g., departments, faculties). Only created if `uses_divisions=true`.

**Baseline Division** (if enabled):

- Name: 'Default Division'
- Code: 'DEFAULT'

**Fields**:

| Field        | Type         | Default           | Purpose                                  |
| ------------ | ------------ | ----------------- | ---------------------------------------- |
| `id`         | uuid         | gen_random_uuid() | Division identifier                      |
| `name`       | varchar(255) | —                 | Division name                            |
| `code`       | varchar(50)  | NULL              | Parent-identifier (e.g., 'STEM', 'HASS') |
| `created_at` | timestamp    | now()             | Seed timestamp                           |

---

### Table: `users`

```sql
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

**Purpose**: User accounts (admin, staff, students).

**Baseline Admin User** (inserted during seed):

| Field           | Value                                     |
| --------------- | ----------------------------------------- |
| `email`         | job.admin_email (e.g., 'admin@acme.edu')  |
| `first_name`    | 'Admin'                                   |
| `last_name`     | 'Placeholder'                             |
| `password_hash` | bcrypt(temporary_password, rounds=12)     |
| `role_id`       | (FK to ADMIN role)                        |
| `verified_at`   | NULL (set to now() after invite accepted) |

**Fields**:

| Field           | Type         | Default           | Purpose                                       |
| --------------- | ------------ | ----------------- | --------------------------------------------- |
| `id`            | uuid         | gen_random_uuid() | User identifier                               |
| `email`         | varchar(255) | —                 | Unique email address                          |
| `first_name`    | varchar(100) | NULL              | User first name                               |
| `last_name`     | varchar(100) | NULL              | User last name                                |
| `password_hash` | varchar(255) | —                 | bcrypt hash (12 rounds)                       |
| `role_id`       | uuid         | —                 | FK to roles(id)                               |
| `verified_at`   | timestamp    | NULL              | When user verified email (set by invite flow) |
| `created_at`    | timestamp    | now()             | Account creation timestamp                    |
| `updated_at`    | timestamp    | now()             | Last modification timestamp                   |

---

## Migration Files & Content Outlines

### Master Database Migrations

```text
apps/api/src/db/master/migrations/

001_add_provisioning_fields_to_licenses.sql
  ├─ Purpose: Add status, version fields to licenses table
  ├─ Changes:
  │  ├─ ADD COLUMN status varchar(32) CHECK (...)
  │  ├─ ADD COLUMN schema_version varchar(50)
  │  ├─ ADD COLUMN product_version varchar(50)
  │  ├─ ADD COLUMN retry_count int DEFAULT 0
  │  ├─ ADD COLUMN last_provision_error varchar(1024)
  │  ├─ ADD COLUMN provisioned_at timestamp
  │  └─ ADD COLUMN failed_at timestamp
  │
  └─ Idempotent: Uses IF NOT EXISTS pattern (or conditional logic)

002_create_tenants_registry.sql
  ├─ Purpose: Create registry table for license→workspace→database mapping
  ├─ Changes:
  │  ├─ CREATE TABLE tenants_registry (...)
  │  ├─ CREATE INDEX idx_tenants_registry_license_id
  │  ├─ CREATE INDEX idx_tenants_registry_workspace_slug
  │  └─ CREATE INDEX idx_tenants_registry_db_name
  │
  └─ Idempotent: CREATE TABLE IF NOT EXISTS

003_add_provisioning_indexes_to_licenses.sql
  ├─ Purpose: Create indexes for efficient state queries
  ├─ Changes:
  │  ├─ CREATE INDEX idx_licenses_status ON licenses(status)
  │  ├─ CREATE INDEX idx_licenses_workspace_slug ON licenses(workspace_slug)
  │  └─ CREATE INDEX idx_licenses_created_at ON licenses(created_at DESC)
  │
  └─ Idempotent: CREATE INDEX IF NOT EXISTS
```

### Tenant Database Baseline Migrations

```text
apps/api/src/db/tenant/migrations/

001_init_schema.sql (Idempotent Baseline)
  ├─ Purpose: Create all baseline tables in new tenant database
  ├─ Changes:
  │  ├─ CREATE TABLE IF NOT EXISTS schema_versions (...)
  │  ├─ CREATE TABLE IF NOT EXISTS roles (...)
  │  ├─ CREATE TABLE IF NOT EXISTS permissions (...)
  │  ├─ CREATE TABLE IF NOT EXISTS workspace_settings (...)
  │  ├─ CREATE TABLE IF NOT EXISTS users (...)
  │  └─ CREATE INDEX idx_users_email, idx_users_role_id
  │
  └─ Transaction: Wrapped in BEGIN/COMMIT for atomicity

002_add_divisions.sql (Conditional)
  ├─ Purpose: Create divisions table (if needed)
  ├─ Changes:
  │  ├─ CREATE TABLE IF NOT EXISTS divisions (...)
  │  └─ CREATE INDEX idx_divisions_code (if applicable)
  │
  └─ Applied: Only if job.uses_divisions = true

003_init_baseline_data.sql (Idempotent Seed)
  ├─ Purpose: Populate baseline roles, permissions, settings
  ├─ Changes:
  │  ├─ INSERT INTO roles (...) VALUES ('ADMIN', ...), ('STAFF', ...), ...
  │  │  ON CONFLICT (name) DO NOTHING (idempotent)
  │  │
  │  ├─ INSERT INTO permissions (...) VALUES ('CREATE_EXAM', ...), ...
  │  │  ON CONFLICT (name) DO NOTHING (idempotent)
  │  │
  │  ├─ INSERT INTO workspace_settings (...) VALUES (...)
  │  │  ON CONFLICT (setting_key) DO UPDATE SET setting_value = ...
  │  │
  │  └─ INSERT INTO divisions (...) IF uses_divisions = true
  │
  └─ Transaction: Part of provisioning transaction
```

---

## Seed Data Structure

### Seed Baseline Roles

```json
[
  {
    "name": "ADMIN",
    "description": "Workspace administrator with full permissions"
  },
  {
    "name": "STAFF",
    "description": "Staff member with operational permissions"
  },
  {
    "name": "STUDENT",
    "description": "Student with limited permissions"
  },
  {
    "name": "SUPPORT",
    "description": "Support staff with read-only access"
  }
]
```

### Seed Baseline Permissions

```json
[
  { "name": "CREATE_EXAM", "description": "Create new examinations" },
  { "name": "GRADE_EXAM", "description": "Grade student submissions" },
  { "name": "VIEW_REPORTS", "description": "View analytics and reports" },
  { "name": "MANAGE_STUDENTS", "description": "Manage student accounts" },
  { "name": "MANAGE_STAFF", "description": "Manage staff accounts" },
  { "name": "VIEW_SETTINGS", "description": "View workspace settings" },
  { "name": "EDIT_SETTINGS", "description": "Edit workspace settings" }
]
```

### Seed Workspace Settings

```json
[
  {
    "setting_key": "STUDENT_LIMIT",
    "setting_value": "<from license.student_limit>",
    "value_type": "number"
  },
  {
    "setting_key": "STAFF_LIMIT",
    "setting_value": "<from license.staff_limit>",
    "value_type": "number"
  },
  {
    "setting_key": "DEFAULT_LANGUAGE",
    "setting_value": "en",
    "value_type": "string"
  },
  {
    "setting_key": "TIMEZONE",
    "setting_value": "UTC",
    "value_type": "string"
  }
]
```

### Seed Default Division (if enabled)

```json
{
  "name": "Default Division",
  "code": "DEFAULT"
}
```

### Seed Admin User

```json
{
  "email": "<job.admin_email>",
  "first_name": "Admin",
  "last_name": "Placeholder",
  "password_hash": "<bcrypt(temporary_password, 12)>",
  "role_id": "<ADMIN role.id>",
  "verified_at": null
}
```

---

## Transaction Boundaries

### Provisioning Transaction (Atomic)

```sql
BEGIN TRANSACTION (in tenant_db);
  -- All following operations execute as one atomic unit

  -- Step 1: Apply migrations (via Worker code, not raw SQL)
  -- FOR each migration file:
  --   EXECUTE migration SQL
  --   INSERT INTO schema_versions (version, applied_at, checksum)

  -- Step 2: Seed baseline data
  INSERT INTO roles (...) VALUES (...) ON CONFLICT DO NOTHING;
  INSERT INTO permissions (...) VALUES (...) ON CONFLICT DO NOTHING;
  INSERT INTO workspace_settings (...) VALUES (...)
    ON CONFLICT (setting_key) DO UPDATE SET setting_value = ...;

  IF uses_divisions = true:
    INSERT INTO divisions (...) VALUES (...);

  -- Step 3: Create admin user
  INSERT INTO users (email, first_name, last_name, password_hash, role_id, created_at, updated_at)
    VALUES ($1, 'Admin', 'Placeholder', $2, $3, now(), now());

  -- Step 4: Insert registry entry (master DB operation, within transaction)
  INSERT INTO master_db.tenants_registry (license_id, workspace_slug, db_name, schema_version, created_at, updated_at)
    VALUES ($license_id, $workspace_slug, $db_name, $schema_version, now(), now());

COMMIT TRANSACTION;

-- Post-commit (if COMMIT successful):
UPDATE master_db.licenses SET status = 'ACTIVE', provisioned_at = now()
  WHERE id = $license_id;

-- If ROLLBACK (any step fails):
-- All changes to tenant_db rolled back automatically
-- Worker then: DROP DATABASE workspace_<slug>
-- Master DB: UPDATE licenses SET status = 'PROVISION_FAILED', failed_at = now(), ...
```

---

## Invariants & Constraints

### Consistency Guarantees

✅ **One-to-One Mapping** (license ↔ workspace):

- Each license_id has at most one registry entry
- Each workspace_slug maps to exactly one database
- Each database_name is unique

✅ **Referential Integrity**:

- All users.role_id → roles(id)
- tenants_registry.license_id → licenses(id) with CASCADE DELETE

✅ **No Orphans**:

- Registry entry exists ⟹ database exists
- License ACTIVE ⟹ registry entry exists
- Database exists ⟹ license ACTIVE

✅ **Idempotent Migrations**:

- schema_versions is append-only (uniqueness on version)
- Baseline data uses UPSERT patterns (INSERT ... ON CONFLICT)
- Retry-safe: re-running same version is safe

✅ **Transaction Atomicity**:

- All provisioning steps (schema + seed + admin + registry) in **single transaction**
- Rollback entire provision if **any** step fails
- No partial databases or partial registries

---

## Version Compatibility

### Schema Version Evolution

**Current**: schema_version = '1.2.0' (platform at provisioning time)

**Migration Sequence**:

1. Platform is at version 1.2.0
2. License created: schema_version = '1.2.0' (frozen)
3. Worker queries: "Apply all migrations ≤ 1.2.0"
4. Tenant DB gets all migrations up to 1.2.0

**Future Upgrade Scenario**:

1. Platform upgrades to 2.0.0 (new license creation)
2. Old licenses remain at schema_version = '1.2.0'
3. New licenses created at schema_version = '2.0.0'
4. Resolver middleware validates schema compatibility

**Backward Compatibility**:

- All migrations are forward-only
- No schema downgrades
- Version stored in license acts as schema guarantor

---

## Deployment Checklist

### Master Database Pre-Deployment

- [ ] Backup production master_db
- [ ] Apply migration 001_add_provisioning_fields_to_licenses.sql
- [ ] Apply migration 002_create_tenants_registry.sql
- [ ] Apply migration 003_add_provisioning_indexes_to_licenses.sql
- [ ] Verify: `SELECT status, schema_version FROM licenses LIMIT 1` (has new columns)
- [ ] Verify: `SELECT * FROM tenants_registry LIMIT 1` (table exists)

### Tenant Database Pre-Deployment

- [ ] No pre-deployment (baseline created by Worker during provisioning)

### Worker Pre-Deployment

- [ ] Migrations must be deployed to Worker binary (embedded or fetched)
- [ ] Redis queue available (connection test)
- [ ] Master DB connection pool configured
- [ ] Logging configuration validated

---

## Appendix: Entity Definitions

### License Entity (Domain Model)

```typescript
interface License {
  id: string // UUID
  workspace_slug: string // Unique tenant identifier
  product_id: string // UUID to product definition
  status: 'PENDING_PROVISION' | 'ACTIVE' | 'PROVISION_FAILED'
  schema_version: string // Semantic version (e.g., '1.2.0')
  product_version: string // Semantic version
  student_limit: number // Configuration limit
  staff_limit: number // Configuration limit
  retry_count: number // Number of provision attempts
  last_provision_error?: string // Error message (if PROVISION_FAILED)
  provisioned_at?: Date // When transitioned to ACTIVE
  failed_at?: Date // When transitioned to PROVISION_FAILED
  created_at: Date
  updated_at: Date
}
```

### Tenant Registry Entity

```typescript
interface TenantRegistry {
  id: string // UUID
  license_id: string // UUID (FK to licenses)
  workspace_slug: string // Unique identifier
  db_name: string // PostgreSQL database name
  schema_version: string // Version when provisioned
  created_at: Date
  updated_at: Date
}
```

### Tenant DB Entities

```typescript
interface Role {
  id: string
  name: string // ADMIN, STAFF, STUDENT, SUPPORT
  description?: string
  created_at: Date
}

interface Permission {
  id: string
  name: string // CREATE_EXAM, etc.
  description?: string
  created_at: Date
}

interface WorkspaceSetting {
  id: string
  setting_key: string // STUDENT_LIMIT, DEFAULT_LANGUAGE, etc.
  setting_value: string // Stored as string
  value_type: 'string' | 'number' | 'boolean' | 'json'
  created_at: Date
  updated_at: Date
}

interface User {
  id: string
  email: string
  first_name?: string
  last_name?: string
  password_hash: string // bcrypt(password, 12)
  role_id: string // FK to roles(id)
  verified_at?: Date // Set after invite acceptance
  created_at: Date
  updated_at: Date
}

interface Division {
  id: string
  name: string
  code?: string
  created_at: Date
}

interface SchemaVersion {
  id: string
  version: string // e.g., '1.2.0'
  applied_at: Date
  checksum: string // SHA256(migration_sql)
}
```
