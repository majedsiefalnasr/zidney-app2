# Data Model: STAGE_21 — Role & Permission System

**Branch**: `021-role-permission-system`  
**Date**: 2026-03-02  
**Phase 1 output of** `/speckit.plan`  
**Schema Version Transition**: `1.3.0 → 1.4.0`

---

## Overview

STAGE_21 introduces the following tenant DB changes:

| Operation    | Table                                | Notes                             |
| ------------ | ------------------------------------ | --------------------------------- |
| ALTER TABLE  | `backoffice_roles`                   | ADD `status` column               |
| CREATE TABLE | `backoffice_role_module_permissions` | Boolean-flags permission model    |
| ALTER TABLE  | `backoffice_staff_users`             | ADD `role_id` FK + `division_ids` |
| CREATE TABLE | `rbac_audit_logs`                    | Immutable RBAC audit trail        |
| UPDATE       | `schema_version`                     | Bump `1.3.0 → 1.4.0`              |

All changes are **tenant DB only**. No master DB modifications.  
All changes are **additive** — no existing tables or columns are dropped.

---

## 1. Extended Table: `backoffice_roles`

**Source table**: Created in migration `20260228_001_tenant_rbac_skeleton.ts` (STAGE_17).  
**STAGE_21 adds**: `status` column only.

### Existing columns (STAGE_17, unchanged)

| Column         | Type         | Constraints                       |
| -------------- | ------------ | --------------------------------- |
| `id`           | UUID         | PK, `DEFAULT gen_random_uuid()`   |
| `workspace_id` | UUID         | NOT NULL                          |
| `name`         | VARCHAR(128) | NOT NULL, UNIQUE per workspace_id |
| `description`  | TEXT         | NULLABLE                          |
| `created_at`   | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()           |
| `updated_at`   | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()           |

### New column (STAGE_21)

| Column   | Type        | Constraints                                                       |
| -------- | ----------- | ----------------------------------------------------------------- |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT `'ACTIVE'`, CHECK IN (`'ACTIVE'`, `'DISABLED'`) |

### Drizzle Schema (extended)

```typescript
// apps/api/src/db/tenant/schemas/backoffice-roles.schema.ts
import { pgTable, uuid, varchar, text, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const backofficeRoles = pgTable(
  "backoffice_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id").notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    status_check: check(
      "backoffice_roles_status_check",
      sql`${table.status} IN ('ACTIVE', 'DISABLED')`,
    ),
  }),
);

export type BackofficeRole = typeof backofficeRoles.$inferSelect;
export type NewBackofficeRole = typeof backofficeRoles.$inferInsert;
```

---

## 2. New Table: `backoffice_role_module_permissions`

**Purpose**: Maps each role to a module with explicit boolean permission flags. One row per
`(role_id, module)` pair. Absent row = full denial.  
**Why new table**: The STAGE_17 `backoffice_role_permissions` table uses a triplet model
`(role_id, module, action)` — incompatible with the boolean-flags model required by this spec. The
STAGE_17 table is preserved (forward-only policy).

### Columns

| Column       | Type         | Constraints                                             |
| ------------ | ------------ | ------------------------------------------------------- |
| `id`         | UUID         | PK, `DEFAULT gen_random_uuid()`                         |
| `role_id`    | UUID         | NOT NULL, FK → `backoffice_roles(id)` ON DELETE CASCADE |
| `module`     | VARCHAR(100) | NOT NULL                                                |
| `can_view`   | BOOLEAN      | NOT NULL, DEFAULT false                                 |
| `can_create` | BOOLEAN      | NOT NULL, DEFAULT false                                 |
| `can_edit`   | BOOLEAN      | NOT NULL, DEFAULT false                                 |
| `can_delete` | BOOLEAN      | NOT NULL, DEFAULT false                                 |
| `created_at` | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                                 |
| `updated_at` | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                                 |

**Indexes**:

- `UNIQUE (role_id, module)` — prevents duplicate permission rows per role per module
- `idx_brmp_role_id` on `(role_id)` — permission evaluation hot path
- `idx_brmp_role_module` on `(role_id, module)` — per-module permission lookup

**Extension contract**: New permission flags (`can_approve`, `can_review`) are added as additional
nullable boolean columns in a future additive migration. No schema redesign required. See FR-019.

### Drizzle Schema

```typescript
// apps/api/src/db/tenant/schemas/backoffice-role-module-permissions.schema.ts
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { backofficeRoles } from "./backoffice-roles.schema";

export const backofficeRoleModulePermissions = pgTable(
  "backoffice_role_module_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role_id: uuid("role_id")
      .notNull()
      .references(() => backofficeRoles.id, { onDelete: "cascade" }),
    module: varchar("module", { length: 100 }).notNull(),
    can_view: boolean("can_view").notNull().default(false),
    can_create: boolean("can_create").notNull().default(false),
    can_edit: boolean("can_edit").notNull().default(false),
    can_delete: boolean("can_delete").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    unique_role_module: uniqueIndex("backoffice_role_module_permissions_unique").on(
      table.role_id,
      table.module,
    ),
    idx_role_id: index("idx_brmp_role_id").on(table.role_id),
    idx_role_module: index("idx_brmp_role_module").on(table.role_id, table.module),
  }),
);

export type BackofficeRoleModulePermission = typeof backofficeRoleModulePermissions.$inferSelect;
export type NewBackofficeRoleModulePermission = typeof backofficeRoleModulePermissions.$inferInsert;
```

---

## 3. Extended Table: `backoffice_staff_users`

**Source table**: Created in migration `20260228_001_tenant_rbac_skeleton.ts` (STAGE_17).  
**STAGE_21 adds**: `role_id` FK column + `division_ids` UUID array column.

### Existing columns (STAGE_17, unchanged)

| Column          | Type         | Constraints                       |
| --------------- | ------------ | --------------------------------- |
| `id`            | UUID         | PK                                |
| `workspace_id`  | UUID         | NOT NULL                          |
| `email`         | VARCHAR(320) | NOT NULL, UNIQUE per workspace_id |
| `name`          | VARCHAR(256) | NOT NULL                          |
| `password_hash` | VARCHAR(72)  | NOT NULL                          |
| `token_version` | INTEGER      | NOT NULL, DEFAULT 0               |
| `is_active`     | BOOLEAN      | NOT NULL, DEFAULT true            |
| `created_at`    | TIMESTAMPTZ  | NOT NULL                          |
| `updated_at`    | TIMESTAMPTZ  | NOT NULL                          |

**Note on `is_active`**: The spec refers to `user.status == ACTIVE`. In this codebase, that maps to
`is_active = true`. No schema change for this column — permission guard logic maps
`is_active = true → ACTIVE`.

### New columns (STAGE_21)

| Column         | Type   | Constraints                                              |
| -------------- | ------ | -------------------------------------------------------- |
| `role_id`      | UUID   | NULLABLE, FK → `backoffice_roles(id)` ON DELETE SET NULL |
| `division_ids` | UUID[] | NOT NULL, DEFAULT `'{}'`                                 |

**`role_id` is nullable**: Supports migration without data loss. A null `role_id` is treated as
no-access (FR-018). Existing rows automatically receive `role_id = NULL` after migration.

### Drizzle Schema (extended)

```typescript
// apps/api/src/db/tenant/schemas/backoffice-staff-users.schema.ts
import { pgTable, uuid, varchar, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { backofficeRoles } from "./backoffice-roles.schema";

export const backofficeStaffUsers = pgTable(
  "backoffice_staff_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id").notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    password_hash: varchar("password_hash", { length: 72 }).notNull(),
    token_version: integer("token_version").notNull().default(0),
    is_active: boolean("is_active").notNull().default(true),
    // Added STAGE_21: single-role FK
    role_id: uuid("role_id").references(() => backofficeRoles.id, {
      onDelete: "set null",
    }),
    // Added STAGE_21: division membership
    division_ids: uuid("division_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idx_role_id: index("idx_bsu_role_id").on(table.role_id),
    idx_workspace_email: index("idx_bsu_workspace_email").on(table.workspace_id, table.email),
  }),
);

export type BackofficeStaffUser = typeof backofficeStaffUsers.$inferSelect;
export type NewBackofficeStaffUser = typeof backofficeStaffUsers.$inferInsert;
```

---

## 4. New Table: `rbac_audit_logs`

**Purpose**: Immutable audit trail for all destructive RBAC operations (role create, update,
disable, delete; permission replace). Separate from `audit_logs` (STAGE_03) because the existing
table's `event_type` CHECK constraint is a forward-only artifact that cannot be modified.  
**Pattern**: Identical to `translation_audit_logs` introduced in STAGE_19.

### Columns

| Column           | Type         | Constraints                                             |
| ---------------- | ------------ | ------------------------------------------------------- |
| `id`             | UUID         | PK, `DEFAULT gen_random_uuid()`                         |
| `user_id`        | UUID         | NULLABLE (preserved after user deletion per GDPR model) |
| `role_id`        | UUID         | NULLABLE (preserved after role deletion)                |
| `module`         | VARCHAR(100) | NULLABLE (null for non-permission-specific actions)     |
| `action`         | VARCHAR(50)  | NOT NULL, CHECK IN valid action values                  |
| `request_id`     | VARCHAR(50)  | NOT NULL (= correlation_id from request context)        |
| `workspace_slug` | VARCHAR(100) | NOT NULL                                                |
| `timestamp`      | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                                 |
| `is_immutable`   | BOOLEAN      | NOT NULL, DEFAULT true                                  |
| `metadata`       | JSONB        | NULLABLE — additional context (old/new values, etc.)    |

**Valid `action` values**: `CREATE_ROLE`, `UPDATE_ROLE`, `DISABLE_ROLE`, `DELETE_ROLE`,
`UPDATE_PERMISSIONS`, `ASSIGN_ROLE`

**Immutability**: Protected by the existing `prevent_audit_modification()` trigger function (created
in v1.0.0 baseline). No UPDATEs or DELETEs allowed.

**Indexes**:

- `idx_rbac_al_role_id` on `(role_id)` — role audit history
- `idx_rbac_al_user_id` on `(user_id)` — actor history
- `idx_rbac_al_timestamp` on `(timestamp DESC)` — time-series queries

### Drizzle Schema

```typescript
// apps/api/src/db/tenant/schemas/rbac-audit-logs.schema.ts
import { pgTable, uuid, varchar, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const RBAC_AUDIT_ACTIONS = [
  "CREATE_ROLE",
  "UPDATE_ROLE",
  "DISABLE_ROLE",
  "DELETE_ROLE",
  "UPDATE_PERMISSIONS",
  "ASSIGN_ROLE",
] as const;

export type RbacAuditAction = (typeof RBAC_AUDIT_ACTIONS)[number];

export const rbacAuditLogs = pgTable(
  "rbac_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id"), // nullable — preserved after user deletion
    role_id: uuid("role_id"), // nullable — preserved after role deletion
    module: varchar("module", { length: 100 }),
    action: varchar("action", { length: 50 }).notNull(),
    request_id: varchar("request_id", { length: 50 }).notNull(),
    workspace_slug: varchar("workspace_slug", { length: 100 }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
    is_immutable: boolean("is_immutable").notNull().default(true),
    metadata: jsonb("metadata"),
  },
  (table) => ({
    idx_role_id: index("idx_rbac_al_role_id").on(table.role_id),
    idx_user_id: index("idx_rbac_al_user_id").on(table.user_id),
    idx_timestamp: index("idx_rbac_al_timestamp").on(table.timestamp),
  }),
);

export type RbacAuditLog = typeof rbacAuditLogs.$inferSelect;
export type NewRbacAuditLog = typeof rbacAuditLogs.$inferInsert;
```

---

## 5. Entity Relationships

```
backoffice_roles (1)
  ├── (∞) backoffice_role_module_permissions
  │         role_id → backoffice_roles.id ON DELETE CASCADE
  │
  ├── (∞) backoffice_staff_users
  │         role_id → backoffice_roles.id ON DELETE SET NULL
  │
  └── (∞) rbac_audit_logs
            role_id → nullable (no FK constraint — preserves log after deletion)
```

---

## 6. Valid Module Keys (Phase 3)

Stored as `varchar` in `backoffice_role_module_permissions.module`. Application layer validates
against this list. No database enum — extensible without migration.

| Module Key               | Display Name             |
| ------------------------ | ------------------------ |
| `academic_structure`     | Academic Structure       |
| `content_classification` | Content Classification   |
| `exam_engine`            | Exam Engine              |
| `users`                  | Users (Staff & Students) |
| `commercial`             | Commercial Layer         |
| `media_assets`           | Media & Assets           |
| `communication`          | Communication            |
| `ads`                    | Ads                      |
| `dashboard`              | Dashboard                |
| `settings`               | Settings                 |

---

## 7. State Transitions

### backoffice_roles.status

```
          ┌──────────┐
  CREATE  │  ACTIVE  │◄──── PATCH (re-enable)
 ────────►│          │
          └──────────┘
               │
          PATCH (disable)
               │
               ▼
          ┌──────────┐
          │ DISABLED │
          └──────────┘
               │
          (no further transitions in Phase 3)
```

- `DISABLED` roles cannot be assigned to staff users (FR-016)
- Deleting a role is only allowed when no active users are assigned (FR-017)

---

## 8. Permission Evaluation Default Table

When `backoffice_role_module_permissions` has no row for `(role_id, module)`:

| Flag         | Evaluated as |
| ------------ | ------------ |
| `can_view`   | `false`      |
| `can_create` | `false`      |
| `can_edit`   | `false`      |
| `can_delete` | `false`      |

No error is raised — the absent row is the normal "deny all" path (FR-018, A7).
