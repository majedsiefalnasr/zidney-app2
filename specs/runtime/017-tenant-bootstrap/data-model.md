# Data Model — STAGE_17: Tenant Bootstrap

**Date:** 2026-02-28  
**Stage:** STAGE_17_TENANT_BOOTSTRAP  
**Phase:** 03 – Backoffice Core / 01 – Foundation  
**Target Database:** Tenant DB only (no master_db changes)

---

## Migration File

**File name:** `20260228_001_tenant_rbac_skeleton.ts`  
**Full path:** `apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts`

**Migration metadata:**

- Stage: STAGE_17_TENANT_BOOTSTRAP
- Description: Create RBAC skeleton tables — roles, role_permissions, staff_users, staff_user_roles
- Transaction: Single DDL `BEGIN`/`COMMIT` wrapping all 4 `CREATE TABLE` statements
- Idempotency: `CREATE TABLE IF NOT EXISTS` on all tables
- Direction: Forward-only; `down()` throws — rollback via snapshot restore

---

## Migration Source (Complete)

```typescript
/**
 * Tenant Database Migration — RBAC Skeleton
 *
 * File: apps/api/src/db/tenant/migrations/20260228_001_tenant_rbac_skeleton.ts
 * Date: 2026-02-28
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 * Phase: 03 – Backoffice Core / 01 – Foundation
 *
 * Purpose:
 * Establish the RBAC table skeleton in the tenant DB for Backoffice access control.
 * Creates: roles, role_permissions, staff_users, staff_user_roles.
 *
 * Constitutional Compliance:
 * ✓ Tenant DB only — no master_db schema changes
 * ✓ Forward-only migration — down() throws
 * ✓ Single DDL transaction — all 4 tables or none
 * ✓ Server-authoritative timestamps (NOW())
 * ✓ Idempotent (IF NOT EXISTS)
 *
 * ADR References:
 * - ADR-0001: Database-per-tenant isolation
 * - ADR-0006: Server-authoritative time
 * - ADR-0008: Semantic versioning / schema_version
 */

import { PoolClient } from "pg";

export const description = "Create RBAC skeleton tables for STAGE_17 Tenant Bootstrap";

/**
 * Forward migration — creates all 4 RBAC tables in a single DDL transaction.
 *
 * Transaction boundary: BEGIN → 4× CREATE TABLE IF NOT EXISTS → COMMIT
 * Failure in any statement rolls back the entire transaction.
 * Provisioning worker retries up to 3 times before routing to DLQ.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query("BEGIN");
  try {
    // -----------------------------------------------------------------------
    // TABLE 1: roles
    // Workspace-scoped role definitions.
    // workspace_id is denormalized here (tenant DB is already workspace-scoped,
    // but stored for cross-query safety and future audit trace).
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id           UUID         NOT NULL DEFAULT gen_random_uuid(),
        workspace_id UUID         NOT NULL,
        name         VARCHAR(128) NOT NULL,
        description  TEXT,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

        CONSTRAINT roles_pkey        PRIMARY KEY (id),
        CONSTRAINT roles_name_unique UNIQUE (workspace_id, name)
      )
    `);

    // -----------------------------------------------------------------------
    // TABLE 2: role_permissions
    // Module-scoped permission assignments per role.
    // module  ← one of: MCQ | TRADITIONAL_EXAMS | EXERCISES | LIBRARY | LIVES | FORUM
    // action  ← one of: view | create | edit | delete
    // Unique constraint prevents duplicate (role, module, action) triples.
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id         UUID         NOT NULL DEFAULT gen_random_uuid(),
        role_id    UUID         NOT NULL,
        module     VARCHAR(64)  NOT NULL,
        action     VARCHAR(16)  NOT NULL,

        CONSTRAINT role_permissions_pkey               PRIMARY KEY (id),
        CONSTRAINT role_permissions_role_id_fkey       FOREIGN KEY (role_id)    REFERENCES roles(id)    ON DELETE CASCADE,
        CONSTRAINT role_permissions_module_action_ck   CHECK (action IN ('view', 'create', 'edit', 'delete')),
        CONSTRAINT role_permissions_unique             UNIQUE (role_id, module, action)
      )
    `);

    // -----------------------------------------------------------------------
    // TABLE 3: staff_users
    // Backoffice staff accounts scoped to this tenant.
    // Separate from frontoffice student accounts.
    // token_version provides forced-logout / credential-change invalidation.
    // password_hash stores bcrypt hash only — plaintext never stored.
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_users (
        id             UUID         NOT NULL DEFAULT gen_random_uuid(),
        workspace_id   UUID         NOT NULL,
        email          VARCHAR(320) NOT NULL,
        name           VARCHAR(256) NOT NULL,
        password_hash  VARCHAR(72)  NOT NULL,
        token_version  INTEGER      NOT NULL DEFAULT 0,
        is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

        CONSTRAINT staff_users_pkey         PRIMARY KEY (id),
        CONSTRAINT staff_users_email_unique UNIQUE (workspace_id, email),
        CONSTRAINT staff_users_tv_min       CHECK (token_version >= 0)
      )
    `);

    // -----------------------------------------------------------------------
    // TABLE 4: staff_user_roles
    // Junction: many-to-many between staff_users and roles.
    // Composite PK (staff_user_id, role_id) — no surrogate key needed.
    // Cascade deletes to auto-remove assignments when user or role is deleted.
    // -----------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_user_roles (
        staff_user_id UUID        NOT NULL,
        role_id       UUID        NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT staff_user_roles_pkey             PRIMARY KEY (staff_user_id, role_id),
        CONSTRAINT staff_user_roles_staff_user_fkey  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE,
        CONSTRAINT staff_user_roles_role_fkey        FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE
      )
    `);

    // -----------------------------------------------------------------------
    // INDEXES
    // -----------------------------------------------------------------------

    // roles — lookup by workspace
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_roles_workspace_id
        ON roles (workspace_id)
    `);

    // role_permissions — lookup by role_id (permission check hot path)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id
        ON role_permissions (role_id)
    `);

    // role_permissions — lookup by (role_id, module) for module-specific permission checks
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_role_permissions_role_module
        ON role_permissions (role_id, module)
    `);

    // staff_users — lookup by workspace_id + email (login)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_users_workspace_email
        ON staff_users (workspace_id, email)
    `);

    // staff_users — lookup by workspace_id (list all staff)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_users_workspace_id
        ON staff_users (workspace_id)
    `);

    // staff_user_roles — reverse lookup by role_id (which users have this role?)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_user_roles_role_id
        ON staff_user_roles (role_id)
    `);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

/**
 * Reverse migration — NOT IMPLEMENTED.
 *
 * STAGE_17 is forward-only per platform migration policy.
 * Rollback requires snapshot restore (ADR-0008).
 */
export async function down(_client: PoolClient): Promise<void> {
  throw new Error(
    "STAGE_17_TENANT_BOOTSTRAP migration is forward-only. " +
      "Rollback must be performed via database snapshot restore.",
  );
}
```

---

## Entity Definitions

### Table 1: `roles`

**Purpose:** Workspace-scoped role definitions, used for RBAC assignment.

| Column         | Type           | Constraints                     | Notes                                                     |
| -------------- | -------------- | ------------------------------- | --------------------------------------------------------- |
| `id`           | `UUID`         | PK, `DEFAULT gen_random_uuid()` | Server-generated                                          |
| `workspace_id` | `UUID`         | NOT NULL                        | Denormalized tenant scope (tenant DB is already isolated) |
| `name`         | `VARCHAR(128)` | NOT NULL, UNIQUE per workspace  | e.g. `"admin"`, `"grader"`, `"viewer"`                    |
| `description`  | `TEXT`         | NULLABLE                        | Human-readable description                                |
| `created_at`   | `TIMESTAMPTZ`  | NOT NULL, `DEFAULT NOW()`       | Server-authoritative                                      |
| `updated_at`   | `TIMESTAMPTZ`  | NOT NULL, `DEFAULT NOW()`       | Server-authoritative                                      |

**Constraints:**

- `roles_pkey` — PK on `id`
- `roles_name_unique` — UNIQUE on `(workspace_id, name)`

**Indexes:**

- `idx_roles_workspace_id` — on `workspace_id` (list all roles for workspace)

**Notes:**

- `workspace_id` is stored for cross-query safety, but all queries against this table are already
  within the tenant-scoped pool
- `updated_at` must be set via application-layer `NOW()` on updates (no trigger in this stage)

---

### Table 2: `role_permissions`

**Purpose:** Module-scoped permission assignments. Each row grants a role the ability to perform a
specific action on a specific module.

| Column    | Type          | Constraints                                       | Notes                       |
| --------- | ------------- | ------------------------------------------------- | --------------------------- |
| `id`      | `UUID`        | PK, `DEFAULT gen_random_uuid()`                   | Server-generated            |
| `role_id` | `UUID`        | NOT NULL, FK → `roles.id`                         | Cascading delete            |
| `module`  | `VARCHAR(64)` | NOT NULL                                          | One of `Module` enum values |
| `action`  | `VARCHAR(16)` | NOT NULL, CHECK (`view`/`create`/`edit`/`delete`) | One of `ActionEnum` values  |

**Constraints:**

- `role_permissions_pkey` — PK on `id`
- `role_permissions_role_id_fkey` — FK `role_id` → `roles(id)` ON DELETE CASCADE
- `role_permissions_module_action_ck` — CHECK: `action IN ('view', 'create', 'edit', 'delete')`
- `role_permissions_unique` — UNIQUE on `(role_id, module, action)`

**Indexes:**

- `idx_role_permissions_role_id` — on `role_id` (all permissions for a role)
- `idx_role_permissions_role_module` — on `(role_id, module)` (hot-path: "does role X have
  permission on module Y?")

**Notes:**

- No `created_at` on this table — permission assignment is atomic and not tracked temporally in this
  stage
- `module` values are constrained by application-layer `Module` enum; no DB-level enum to keep
  migration simple and allow future enum extension without DDL changes

---

### Table 3: `staff_users`

**Purpose:** Backoffice staff accounts within this tenant. Separate from frontoffice student
accounts.

| Column          | Type           | Constraints                         | Notes                                                        |
| --------------- | -------------- | ----------------------------------- | ------------------------------------------------------------ |
| `id`            | `UUID`         | PK, `DEFAULT gen_random_uuid()`     | Server-generated                                             |
| `workspace_id`  | `UUID`         | NOT NULL                            | Denormalized tenant scope                                    |
| `email`         | `VARCHAR(320)` | NOT NULL, UNIQUE per workspace      | RFC 5321 max 320 chars                                       |
| `name`          | `VARCHAR(256)` | NOT NULL                            | Display name                                                 |
| `password_hash` | `VARCHAR(72)`  | NOT NULL                            | bcrypt output (60 chars + safety margin)                     |
| `token_version` | `INTEGER`      | NOT NULL, `DEFAULT 0`, CHECK `>= 0` | Forced-logout counter; increment invalidates all active JWTs |
| `is_active`     | `BOOLEAN`      | NOT NULL, `DEFAULT TRUE`            | Soft-disable; inactive users cannot authenticate             |
| `created_at`    | `TIMESTAMPTZ`  | NOT NULL, `DEFAULT NOW()`           | Server-authoritative                                         |
| `updated_at`    | `TIMESTAMPTZ`  | NOT NULL, `DEFAULT NOW()`           | Server-authoritative                                         |

**Constraints:**

- `staff_users_pkey` — PK on `id`
- `staff_users_email_unique` — UNIQUE on `(workspace_id, email)`
- `staff_users_tv_min` — CHECK: `token_version >= 0`

**Indexes:**

- `idx_staff_users_workspace_email` — on `(workspace_id, email)` — login hot path
- `idx_staff_users_workspace_id` — on `workspace_id` — list staff

**Notes:**

- `password_hash` column renamed from spec's `hashed_password` to `password_hash` to match the
  pattern already established in `20260217_001_add_auth_to_users.ts`
- `is_active = FALSE` does not delete the record; session invalidation flow increments
  `token_version`
- Plaintext passwords must never be stored or logged — only `password_hash`

---

### Table 4: `staff_user_roles`

**Purpose:** Many-to-many junction between staff users and roles.

| Column          | Type          | Constraints                     | Notes                |
| --------------- | ------------- | ------------------------------- | -------------------- |
| `staff_user_id` | `UUID`        | NOT NULL, FK → `staff_users.id` | Cascading delete     |
| `role_id`       | `UUID`        | NOT NULL, FK → `roles.id`       | Cascading delete     |
| `created_at`    | `TIMESTAMPTZ` | NOT NULL, `DEFAULT NOW()`       | Server-authoritative |

**Constraints:**

- `staff_user_roles_pkey` — Composite PK on `(staff_user_id, role_id)`
- `staff_user_roles_staff_user_fkey` — FK `staff_user_id` → `staff_users(id)` ON DELETE CASCADE
- `staff_user_roles_role_fkey` — FK `role_id` → `roles(id)` ON DELETE CASCADE

**Indexes:**

- `idx_staff_user_roles_role_id` — on `role_id` (reverse: which users have a specific role?)

**Notes:**

- No surrogate `id` — composite PK enforces "a user can only have each role once"
- Cascade deletes ensure referential integrity when users or roles are removed

---

## Type Definitions (packages/types)

**New file:** `packages/types/src/tenant-rbac.ts`

```typescript
/**
 * Tenant RBAC Types — STAGE_17
 *
 * File: packages/types/src/tenant-rbac.ts
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * Defines types for Backoffice RBAC within the tenant DB.
 * Separate from MMC-layer RBAC (rbac.ts / MasterDBPermission).
 */

import { Module } from "./enums/Module";

/**
 * Actions that can be performed on a module.
 * Maps to the `action` column CHECK constraint in role_permissions.
 */
export enum ActionEnum {
  VIEW = "view",
  CREATE = "create",
  EDIT = "edit",
  DELETE = "delete",
}

/**
 * A single permission entry: the ability to perform `action` on `module`.
 */
export interface TenantRBACPermission {
  module: Module;
  action: ActionEnum;
}

/**
 * The runtime context object injected into every Backoffice request.
 * Produced by the License Enforcement middleware, consumed read-only by Backoffice.
 * Never recomputed inside Backoffice; always treated as authoritative for the request lifetime.
 */
export interface BackofficeContext {
  workspace_id: string;
  workspace_slug: string;
  license_status: "ACTIVE" | "SOFT_LOCKED" | "ARCHIVED";
  enabled_modules: Module[];
  student_limit: number | null; // null = unlimited
  staff_limit: number | null; // null = unlimited
  product_version: string; // semver, e.g. "2.1.0"
  schema_version: number; // integer version counter
  request_id: string; // correlation ID
}

/**
 * Staff user context as set in Hono `c.set('staff_user', ...)` by Authentication middleware.
 */
export interface StaffUserContext {
  user_id: string;
  workspace_id: string;
  email: string;
  role_id: string;
  permissions: TenantRBACPermission[];
  token_version: number;
}
```

**Update `packages/types/src/index.ts`:** Add the following export:

```typescript
export * from "./tenant-rbac";
```

---

## DDL Transaction Boundary Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  BEGIN                                                          │
│    CREATE TABLE IF NOT EXISTS roles (...)             ← Step 1  │
│    CREATE TABLE IF NOT EXISTS role_permissions (...)  ← Step 2  │
│    CREATE TABLE IF NOT EXISTS staff_users (...)       ← Step 3  │
│    CREATE TABLE IF NOT EXISTS staff_user_roles (...)  ← Step 4  │
│    CREATE INDEX IF NOT EXISTS idx_roles_*             ← Step 5  │
│    CREATE INDEX IF NOT EXISTS idx_role_permissions_*  ← Step 6  │
│    CREATE INDEX IF NOT EXISTS idx_staff_users_*       ← Step 7  │
│    CREATE INDEX IF NOT EXISTS idx_staff_user_roles_*  ← Step 8  │
│  COMMIT                                                         │
│  ─────────────────────────────────────────────────────────────  │
│  ON ERROR → ROLLBACK (worker retries up to 3×, then DLQ)       │
└─────────────────────────────────────────────────────────────────┘
```

**Foreign key dependency order:**

1. `roles` — no dependencies
2. `role_permissions` — depends on `roles`
3. `staff_users` — no dependencies
4. `staff_user_roles` — depends on both `staff_users` and `roles`

The order above respects this dependency chain.

---

## Index Strategy Summary

| Index                              | Table              | Columns                 | Justification                          |
| ---------------------------------- | ------------------ | ----------------------- | -------------------------------------- |
| `idx_roles_workspace_id`           | `roles`            | `workspace_id`          | List all roles in workspace (admin UI) |
| `idx_role_permissions_role_id`     | `role_permissions` | `role_id`               | Fetch all permissions for a role       |
| `idx_role_permissions_role_module` | `role_permissions` | `(role_id, module)`     | Hot-path: per-request permission check |
| `idx_staff_users_workspace_email`  | `staff_users`      | `(workspace_id, email)` | Login authentication hot-path          |
| `idx_staff_users_workspace_id`     | `staff_users`      | `workspace_id`          | Staff list queries                     |
| `idx_staff_user_roles_role_id`     | `staff_user_roles` | `role_id`               | Reverse lookup: users per role         |

**RBAC Permission Check Query Pattern (hot-path — must use `idx_role_permissions_role_module`):**

```sql
SELECT 1
FROM   staff_user_roles sur
JOIN   role_permissions rp ON rp.role_id = sur.role_id
WHERE  sur.staff_user_id = $1    -- from JWT user_id
AND    rp.module          = $2    -- from route definition
AND    rp.action          = $3    -- from route definition
LIMIT  1
```

---

## Schema Version Note

The tenant `schema_version` entry for STAGE_17 must be recorded in the provisioning system after
this migration completes successfully. The provisioning worker is responsible for updating
`schema_versions` with a new record for STAGE_17. The migration file itself does not write to
`schema_versions` directly — that is handled by the migration runner infrastructure established in
STAGE_05.
