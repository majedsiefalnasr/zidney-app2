# Data Model: Master Database Schema

**Feature**: 002A-master-db-schema  
**Stage**: STAGE_02A_MASTER_DATABASE_SCHEMA  
**Created**: 2026-02-16

---

## Entity: Product

Represents a sellable product type with versioning and module configuration.

**Purpose**: Enable Zidney to define multiple product SKUs, each with different enabled features.

**Fields**:

| Field           | Type         | Constraints             | Description                                                           |
| --------------- | ------------ | ----------------------- | --------------------------------------------------------------------- |
| id              | UUID         | PK                      | Unique product identifier                                             |
| name            | VARCHAR(255) | NOT NULL                | Product display name                                                  |
| slug            | VARCHAR(100) | NOT NULL, UNIQUE        | URL-safe product identifier                                           |
| description     | TEXT         | NULLABLE                | Product description                                                   |
| version         | VARCHAR(20)  | NOT NULL                | Semantic version (e.g., 1.0.0)                                        |
| enabled_modules | JSONB        | NOT NULL                | Set of enabled features (e.g., {"exams": true, "certificates": true}) |
| created_at      | TIMESTAMP    | NOT NULL, DEFAULT NOW() | Creation timestamp (server time)                                      |
| updated_at      | TIMESTAMP    | NOT NULL, DEFAULT NOW() | Last update timestamp (server time)                                   |

**Relationships**:

- One-to-Many: `products` → `licenses` (one product can have many licenses)

**Indices**:

- Unique index on `slug` (product lookup)

**Validation Rules**:

- `version` must follow semantic versioning (X.Y.Z, e.g., 1.0.0, 2.1.3)
- `slug` must be lowercase alphanumeric with hyphens
- `enabled_modules` must be valid JSON object
- `name` must not be empty

**State**: Static (created by admins, rarely changed)

---

## Entity: License

Represents a purchased product instance bound to a workspace with lifecycle management.

**Purpose**: Control workspace access, enforce usage limits, and manage product version
compatibility.

**Fields**:

| Field           | Type         | Constraints                | Description                                  |
| --------------- | ------------ | -------------------------- | -------------------------------------------- |
| id              | UUID         | PK                         | Unique license identifier                    |
| product_id      | UUID         | FK → products, NOT NULL    | Reference to purchased product               |
| workspace_slug  | VARCHAR(100) | NOT NULL, UNIQUE           | Workspace identifier                         |
| student_limit   | INTEGER      | NULLABLE                   | Max students (null = unlimited)              |
| staff_limit     | INTEGER      | NULLABLE                   | Max staff (null = unlimited)                 |
| status          | ENUM         | NOT NULL, DEFAULT 'ACTIVE' | License state: ACTIVE, SOFT_LOCKED, ARCHIVED |
| starts_at       | TIMESTAMP    | NOT NULL                   | License validity start (server time)         |
| expires_at      | TIMESTAMP    | NOT NULL                   | License validity end (server time)           |
| product_version | VARCHAR(20)  | NOT NULL                   | Frozen product version at purchase           |
| schema_version  | VARCHAR(20)  | NOT NULL                   | Frozen schema version at purchase            |
| soft_lock_until | TIMESTAMP    | NULLABLE                   | Temporary lock deadline (server time)        |
| archived_at     | TIMESTAMP    | NULLABLE                   | Archival timestamp (server time)             |
| deleted_at      | TIMESTAMP    | NULLABLE                   | Soft deletion timestamp (server time)        |
| created_at      | TIMESTAMP    | NOT NULL, DEFAULT NOW()    | Creation timestamp (server time)             |
| updated_at      | TIMESTAMP    | NOT NULL, DEFAULT NOW()    | Last update timestamp (server time)          |

**Relationships**:

- Many-to-One: `licenses` → `products` (many licenses reference one product)
- One-to-One: `licenses` ← `tenants_registry` (one license has one tenant registry entry)

**Indices**:

- Unique index on `workspace_slug` (fast license lookup)
- Index on `status` (fast status filtering for SOFT_LOCK, ARCHIVED)

**Validation Rules**:

- `expires_at` > `starts_at`
- `product_version` and `schema_version` must follow semantic versioning
- `student_limit` and `staff_limit` must be positive integers (if not null)
- `status` values: ACTIVE, SOFT_LOCKED, ARCHIVED only
- `soft_lock_until` only meaningful when `status` = SOFT_LOCKED
- `archived_at` only meaningful when `status` = ARCHIVED
- `deleted_at` only meaningful when license is logically deleted

**State Transitions**:

```
ACTIVE
  ↓ (manual soft-lock) → SOFT_LOCKED (with soft_lock_until deadline)
  ↓ (manual archive) → ARCHIVED (with archived_at)
  ↓ (soft-lock expires) → back to ACTIVE

SOFT_LOCKED
  ↓ (unlock) → ACTIVE
  ↓ (archive) → ARCHIVED

ARCHIVED
  ↓ (unarchive) → ACTIVE
```

**Authority Rule**: `licenses` is the single source of truth for lifecycle state. No other table
duplicates status.

---

## Entity: Tenant Registry

Stores infrastructure metadata for tenant database connectivity. Does NOT hold lifecycle state (that
is in `licenses`).

**Purpose**: Enable tenant resolver to connect to correct database instance without reading business
logic.

**Fields**:

| Field                 | Type         | Constraints             | Description                            |
| --------------------- | ------------ | ----------------------- | -------------------------------------- |
| id                    | UUID         | PK                      | Unique registry identifier             |
| license_id            | UUID         | FK → licenses, NOT NULL | Reference to license (for lookup)      |
| workspace_slug        | VARCHAR(100) | NOT NULL, UNIQUE        | Workspace identifier (matches license) |
| db_name               | VARCHAR(100) | NOT NULL                | Tenant database name                   |
| db_host               | VARCHAR(255) | NOT NULL                | Database host/IP                       |
| db_port               | INTEGER      | NOT NULL                | Database port (typically 5432)         |
| db_user               | VARCHAR(100) | NOT NULL                | Database user for tenant connection    |
| db_password_encrypted | VARCHAR(512) | NOT NULL                | Encrypted database password            |
| schema_version        | VARCHAR(20)  | NOT NULL                | Tenant's current schema version        |
| product_version       | VARCHAR(20)  | NOT NULL                | Tenant's current product version       |
| created_at            | TIMESTAMP    | NOT NULL, DEFAULT NOW() | Creation timestamp (server time)       |
| updated_at            | TIMESTAMP    | NOT NULL, DEFAULT NOW() | Last update timestamp (server time)    |

**Relationships**:

- Many-to-One: `tenants_registry` → `licenses` (many registry entries reference licenses)

**Indices**:

- Unique index on `workspace_slug` (primary lookup key for resolver)

**Validation Rules**:

- `workspace_slug` must match format of corresponding license
- `db_host` must be valid IP or hostname
- `db_port` must be valid port number (1-65535)
- `schema_version` and `product_version` must follow semantic versioning
- `db_password_encrypted` must be encrypted (never stored in plain text)

**Architectural Rule**: This table stores ONLY infrastructure metadata. It does NOT store lifecycle
state. The resolver:

1. Looks up `tenants_registry` by `workspace_slug` for connection details
2. Looks up `licenses` by `workspace_slug` for status enforcement
3. Reads status ONLY from `licenses` table

---

## Entity: MMC User

Represents platform-internal users for MMC (Master Management Console) with RBAC.

**Purpose**: Control access to master database operations (product management, license
provisioning).

**Fields**:

| Field         | Type         | Constraints             | Description                           |
| ------------- | ------------ | ----------------------- | ------------------------------------- |
| id            | INTEGER      | PK, AUTO_INCREMENT      | User identifier                       |
| email         | VARCHAR(255) | NOT NULL, UNIQUE        | User email (login credential)         |
| password_hash | VARCHAR(255) | NOT NULL                | Bcrypt hashed password                |
| role          | VARCHAR(50)  | NOT NULL                | RBAC role: admin, operator, read_only |
| is_active     | BOOLEAN      | NOT NULL, DEFAULT true  | Soft deletion flag                    |
| created_at    | TIMESTAMP    | NOT NULL, DEFAULT NOW() | Account creation time (server time)   |

**Relationships**:

- No foreign keys (top-level entity)

**Indices**:

- Unique index on `email` (login lookup)

**Validation Rules**:

- `email` must be valid email format
- `password_hash` must never be null or empty
- `role` values: admin, operator, read_only only
- `is_active` true/false only

**Roles**:

- `admin`: Full access (create/update/delete products, licenses, users)
- `operator`: Limited access (manage licenses, view analytics)
- `read_only`: View-only access (reports, audit logs)

**State**: User account can be soft-deleted by setting `is_active` = false

---

## Entity: Platform Schema Version

Single-row control table managing platform-wide schema and product version compatibility.

**Purpose**: Enforce minimum version requirements for runtime clients and tenants.

**Fields**:

| Field                     | Type        | Constraints             | Description                              |
| ------------------------- | ----------- | ----------------------- | ---------------------------------------- |
| id                        | INTEGER     | PK, FIXED (1)           | Always 1 (single-row table)              |
| current_version           | VARCHAR(20) | NOT NULL                | Current platform schema version          |
| minimum_supported_version | VARCHAR(20) | NOT NULL                | Minimum schema version for compatibility |
| updated_at                | TIMESTAMP   | NOT NULL, DEFAULT NOW() | Last update timestamp (server time)      |

**Relationships**:

- No foreign keys (top-level entity)

**Validation Rules**:

- `id` must always equal 1
- `current_version` must follow semantic versioning
- `minimum_supported_version` must follow semantic versioning
- `minimum_supported_version` <= `current_version` (always)

**Usage Pattern**:

```sql
-- Runtime startup: Check compatibility
SELECT current_version, minimum_supported_version FROM platform_schema_version WHERE id = 1;

-- If runtime_version < minimum_supported_version → BLOCK access (426 Upgrade Required)
-- If runtime_version >= minimum_supported_version and backwards compatible → ALLOW
```

**State**: Updated only during platform upgrades (rare)

---

## Summary: Table Relationships

```
products (1)
    ↓ (PK = product_id)
    ↓
licenses (N)
    ↓ (PK = license_id)
    ↓
tenants_registry (1)

mmc_users (standalone)

platform_schema_version (standalone, single row)
```

**Isolation**: Master DB contains NO tenant runtime data (students, attempts, exams, etc.). These
tables are control plane only.

---

## Architectural Integrity

✓ `licenses` is single source of truth for lifecycle state  
✓ `tenants_registry` reads status from `licenses`, does not duplicate  
✓ No business logic allowed in master DB (only data structure)  
✓ All timestamps use server-authoritative time  
✓ All sensitive data (db_password_encrypted) marked for encryption  
✓ Unique constraints prevent duplicate workspaces  
✓ Foreign keys prevent orphaning
