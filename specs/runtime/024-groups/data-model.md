# STAGE_24_GROUPS — Data Model

**Stage:** STAGE_24_GROUPS  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Date:** 2026-03-19

Drizzle ORM schema definitions for the Groups feature.  
All schemas follow the STAGE_23_DEPARTMENTS pattern exactly.

---

## 1. groups.schema.ts

**File:** `apps/api/src/db/tenant/schemas/groups.schema.ts`

```typescript
/**
 * Drizzle ORM Schema — Groups (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/groups.schema.ts
 * Stage: STAGE_24_GROUPS
 * Date: 2026-03-19
 *
 * Drizzle pgTable definition for the `groups` table.
 * Table created by migration 20260319_001_groups.ts.
 *
 * Functional unique index:
 *   UNIQUE (LOWER(name)) enforces workspace-scoped case-insensitive name uniqueness.
 *   Drizzle cannot express this functional index via uniqueIndex(); it is owned by
 *   the migration file only. No uniqueIndex() declaration here to avoid generating
 *   a conflicting plain UNIQUE constraint.
 *
 * Keyset pagination index (created_at, id):
 *   Created in migration as idx_groups_created_at_id.
 *   NOT declared via Drizzle index() to avoid conflicts with migration-managed index.
 *
 * Soft delete:
 *   `deleted_at` is null for active records. Non-null = soft-deleted.
 *   All application queries MUST add: AND deleted_at IS NULL.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { departments } from "./departments.schema";

// ---------------------------------------------------------------------------
// groups
// ---------------------------------------------------------------------------

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Group display name.
     * Unique within workspace (tenant-scoped, case-insensitive).
     * Enforced at DB layer by functional unique index `groups_name_lower_unique`
     * (LOWER(name)) — owned by migration, not declared here.
     */
    name: varchar("name", { length: 255 }).notNull(),

    /**
     * Optional department association (division boundary anchor).
     * Null = workspace-wide group (no division filtering at assignment time).
     * FK → departments(id) ON DELETE RESTRICT:
     *   blocks department deletion while groups are anchored to it.
     * When set, group inherits the department's division_id for division mismatch checks.
     */
    department_id: uuid("department_id").references(() => departments.id, {
      onDelete: "restrict",
    }),

    /**
     * Maximum number of students assignable to this group.
     * Null = unlimited.
     * Positive integer only — CHECK (max_members IS NULL OR max_members > 0) in migration.
     * Enforcement uses SELECT FOR UPDATE on groups row inside student assignment transaction.
     * Staff assignments DO NOT count toward max_members.
     */
    max_members: integer("max_members"),

    /** Optional description. Nullable — no default. */
    description: text("description"),

    /**
     * Group lifecycle status.
     * 'ENABLED'  → group is operational and accepting assignments.
     * 'DISABLED' → group is inactive; existing assignments preserved,
     *              new assignments rejected (GROUP_DISABLED error).
     *              Disabled groups must not appear in assignment selection lists.
     * CHECK constraint enforced at DB layer in migration.
     */
    status: varchar("status", { length: 20 }).notNull().default("ENABLED"),

    /**
     * Soft delete timestamp.
     * Null = active record.
     * Non-null = soft-deleted; excluded from all application queries.
     * Hard delete is NOT allowed (ADR compliance).
     */
    deleted_at: timestamp("deleted_at", { withTimezone: true }),

    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * Department-anchored filtering and FK guard
     * (GROUP_HAS_ASSIGNMENTS guard, department deletion FK scan).
     */
    departmentIdIdx: index("idx_groups_department_id").on(table.department_id),

    /** Status filter — list ENABLED/DISABLED groups; assignment-blocked check. */
    statusIdx: index("idx_groups_status").on(table.status),

    /**
     * Soft-delete exclusion pattern.
     * Partial index equivalent is not declared — plain index on deleted_at is sufficient
     * for IS NULL predicate filtering via index scan.
     */
    deletedAtIdx: index("idx_groups_deleted_at").on(table.deleted_at),

    /**
     * Keyset pagination composite index (created_at, id).
     * Created in migration as idx_groups_created_at_id.
     * NOT declared here to avoid conflicts with migration-managed index.
     */
  }),
);

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
```

---

## 2. staff-groups.schema.ts

**File:** `apps/api/src/db/tenant/schemas/staff-groups.schema.ts`

```typescript
/**
 * Drizzle ORM Schema — Staff Groups Join Table (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/staff-groups.schema.ts
 * Stage: STAGE_24_GROUPS
 * Date: 2026-03-19
 *
 * Drizzle pgTable definition for the `staff_groups` join table.
 * Table created by migration 20260319_001_groups.ts.
 *
 * Composite primary key: (staff_id, group_id).
 * FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE:
 *   deleting a staff member removes all their group assignments.
 * FK group_id → groups(id) ON DELETE CASCADE:
 *   deleting a group cascades to staff assignments (service guard
 *   checks GROUP_HAS_ASSIGNMENTS before soft-delete; CASCADE is safety net for
 *   any future direct DELETE that bypasses the service layer).
 *
 * Note on column name: spec defines `created_at` (not `assigned_at`).
 * This differs from staff_departments which uses `assigned_at`. Follow spec.
 *
 * No separate idx_staff_groups_staff_id — the composite PK (staff_id, group_id)
 * has staff_id as the leading column, so PostgreSQL uses it for all staff_id prefix
 * lookups without a redundant index.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

import { backofficeStaffUsers } from "./backoffice-staff-users.schema";
import { groups } from "./groups.schema";

// ---------------------------------------------------------------------------
// staff_groups
// ---------------------------------------------------------------------------

export const staffGroups = pgTable(
  "staff_groups",
  {
    /** FK → backoffice_staff_users(id) ON DELETE CASCADE */
    staff_id: uuid("staff_id")
      .notNull()
      .references(() => backofficeStaffUsers.id, { onDelete: "cascade" }),

    /** FK → groups(id) ON DELETE CASCADE */
    group_id: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),

    /** Server-set assignment timestamp (ADR-0006 — client time not trusted). */
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * Composite PK enforces uniqueness of (staff_id, group_id) at DB level.
     * Enables idempotent INSERT ON CONFLICT DO NOTHING at service layer (FR-020).
     */
    pk: primaryKey({ columns: [table.staff_id, table.group_id] }),

    /**
     * idx_staff_groups_staff_id is intentionally NOT declared here.
     * The composite PK (staff_id, group_id) has staff_id as leading column,
     * so PostgreSQL can use it for all staff_id prefix queries without a separate index.
     */

    /** Count/list staff members in a group (GROUP_HAS_ASSIGNMENTS guard). */
    groupIdIdx: index("idx_staff_groups_group_id").on(table.group_id),
  }),
);

export type StaffGroup = typeof staffGroups.$inferSelect;
export type NewStaffGroup = typeof staffGroups.$inferInsert;
```

---

## 3. students.schema.ts — Modification

**File:** `apps/api/src/db/tenant/schemas/students.schema.ts`

Add `group_id` column referencing the `groups` table. The column is added after `department_id`.

```typescript
// ADD to imports:
import { groups } from './groups.schema'

// ADD column inside pgTable definition (after department_id):
/**
 * Group assignment — added by migration 20260319_001_groups.ts (STAGE_24).
 * FK → groups(id) ON DELETE SET NULL:
 *   soft-deleting a group does NOT fire this; hard-deletion would cascade.
 *   Service-layer soft delete does not trigger ON DELETE behaviour.
 * NULLABLE: no backfill required; existing students start with group_id = null.
 * Single-group constraint: each student may belong to at most 1 group.
 *   Enforced by UPDATE (not INSERT) at the service layer.
 */
group_id: uuid('group_id').references(() => groups.id, { onDelete: 'setNull' }),

// ADD index inside pgTable factory function (after departmentIdIdx):
/** List all students in a group + max_members count query + FK traversal. */
groupIdIdx: index('idx_students_group_id').on(table.group_id),
```

---

## 4. Migration: 20260319_001_groups.ts

**File:** `apps/api/src/db/tenant/migrations/20260319_001_groups.ts`

```typescript
/**
 * Tenant Database Migration — Groups
 *
 * File: apps/api/src/db/tenant/migrations/20260319_001_groups.ts
 * Date: 2026-03-19
 * Stage: STAGE_24_GROUPS
 * Phase: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE
 *
 * Purpose:
 * 1. CREATE groups table (all columns, CHECK constraints, indexes)
 * 2. CREATE staff_groups join table (composite PK, FKs, index)
 * 3. ALTER students — ADD COLUMN group_id UUID nullable
 * 4. ADD FK constraint: students.group_id → groups(id) ON DELETE SET NULL
 * 5. CREATE index on students(group_id)
 * 6. UPDATE schema_version 1.6.0 → 1.7.0
 *
 * Hard Dependencies (must exist before this migration):
 *   - departments table (STAGE_23_DEPARTMENTS) — groups.department_id FK
 *   - backoffice_staff_users table — staff_groups.staff_id FK
 *   - students table — group_id column addition
 *
 * No backfill step: group_id on students is nullable; existing rows get NULL.
 *
 * Constitutional Compliance:
 * ✓ Tenant DB only — no master_db schema changes
 * ✓ Forward-only migration — down() throws per ADR-0008
 * ✓ All DDL in single transactional BEGIN/COMMIT block
 * ✓ CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for idempotency
 * ✓ Additive-only — no existing table or column is dropped
 * ✓ schema_version bumped from 1.6.0 to 1.7.0
 * ✓ Server-authoritative timestamps (NOW())
 *
 * ADR References:
 * - ADR-0001: Database-per-tenant isolation
 * - ADR-0006: Server-authoritative time
 * - ADR-0008: Semantic versioning / schema_version + forward-only migrations
 */

import type { PoolClient } from "pg";

export const description =
  "Create groups + staff_groups tables, add nullable group_id FK to students; " +
  "bump schema_version 1.6.0 → 1.7.0";

/**
 * Forward migration — single transactional DDL block.
 *
 * Transaction boundary:
 *   BEGIN
 *     → CREATE groups table + constraints + indexes
 *     → CREATE staff_groups join table + constraints + indexes
 *     → ALTER students (add group_id nullable)
 *     → ADD FK constraint on students.group_id
 *     → CREATE index on students(group_id)
 *     → UPDATE schema_version
 *   COMMIT
 *
 * Failure in any statement rolls back the entire transaction.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query("BEGIN");
  try {
    // -------------------------------------------------------------------------
    // STEP 1: CREATE groups table
    //
    // department_id FK → departments(id) ON DELETE RESTRICT:
    //   blocks department deletion while groups are anchored to it.
    //   Groups must be re-anchored (set department_id = NULL) or soft-deleted
    //   before the department can be removed.
    //
    // status uses VARCHAR + CHECK (not PG enum) — follows codebase convention.
    // max_members CHECK: must be positive integer when set.
    //
    // deleted_at is the soft delete marker. Null = active record.
    //   All queries MUST filter: WHERE deleted_at IS NULL.
    //
    // Functional unique index on LOWER(name) enforces workspace-scoped
    // case-insensitive name uniqueness. Created separately below.
    // Drizzle cannot express this; owned by this migration only.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id            UUID          NOT NULL DEFAULT gen_random_uuid(),
        name          VARCHAR(255)  NOT NULL,
        department_id UUID,
        max_members   INTEGER
                        CONSTRAINT groups_max_members_check
                          CHECK (max_members IS NULL OR max_members > 0),
        description   TEXT,
        status        VARCHAR(20)   NOT NULL DEFAULT 'ENABLED'
                        CONSTRAINT groups_status_check
                          CHECK (status IN ('ENABLED', 'DISABLED')),
        deleted_at    TIMESTAMPTZ,
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

        CONSTRAINT groups_pkey
          PRIMARY KEY (id),
        CONSTRAINT groups_department_id_fkey
          FOREIGN KEY (department_id)
            REFERENCES departments(id) ON DELETE RESTRICT
      )
    `);

    // Functional unique index: workspace-scoped case-insensitive name uniqueness.
    // Only applies to non-deleted groups (soft-deleted names are technically freed
    // but the application layer enforces name uniqueness against active groups only
    // via service-layer check, not this unique index).
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS groups_name_lower_unique
        ON groups (LOWER(name))
        WHERE deleted_at IS NULL
    `);

    // Index: department-anchored filtering and FK guard
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_groups_department_id
        ON groups (department_id)
    `);

    // Index: status filter (ENABLED/DISABLED); assignment blocked check
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_groups_status
        ON groups (status)
    `);

    // Index: soft-delete exclusion pattern
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_groups_deleted_at
        ON groups (deleted_at)
    `);

    // Composite index: keyset pagination cursor (created_at, id)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_groups_created_at_id
        ON groups (created_at ASC, id ASC)
    `);

    // -------------------------------------------------------------------------
    // STEP 2: CREATE staff_groups join table
    //
    // Composite PK (staff_id, group_id) enforces uniqueness at DB level,
    // enabling idempotent INSERT ON CONFLICT DO NOTHING at the service layer (FR-020).
    //
    // FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE:
    //   deleting a staff member removes all their group assignments.
    //
    // FK group_id → groups(id) ON DELETE CASCADE:
    //   safety net for direct hard-deletes; service-layer soft delete does not
    //   trigger ON DELETE behaviour (deleted_at update is not a row deletion).
    //
    // created_at is server-set (NOW()) — client time not trusted (ADR-0006).
    // Note: uses created_at (not assigned_at) per STAGE_24 spec definition.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_groups (
        staff_id    UUID        NOT NULL,
        group_id    UUID        NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT staff_groups_pkey
          PRIMARY KEY (staff_id, group_id),
        CONSTRAINT staff_groups_staff_id_fkey
          FOREIGN KEY (staff_id)
            REFERENCES backoffice_staff_users(id) ON DELETE CASCADE,
        CONSTRAINT staff_groups_group_id_fkey
          FOREIGN KEY (group_id)
            REFERENCES groups(id) ON DELETE CASCADE
      )
    `);

    // Composite PK (staff_id, group_id) already covers staff_id prefix queries.
    // Index: count/list staff members in a group (GROUP_HAS_ASSIGNMENTS guard)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_groups_group_id
        ON staff_groups (group_id)
    `);

    // -------------------------------------------------------------------------
    // STEP 3: ALTER students — add group_id column (nullable)
    //
    // group_id is nullable; existing rows get NULL automatically.
    // No backfill required (nullable, no NOT NULL constraint).
    // ADD COLUMN IF NOT EXISTS ensures idempotency.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS group_id UUID
    `);

    // -------------------------------------------------------------------------
    // STEP 4: ADD FK constraint: students.group_id → groups(id)
    //
    // ON DELETE SET NULL: hard-deleting a group sets students.group_id to null.
    // Service-layer soft delete (deleted_at update) does NOT trigger this FK.
    // Students retain their group_id reference after group soft-deletion.
    // ADD CONSTRAINT IF NOT EXISTS is supported in PG 9.6+.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE students
        ADD CONSTRAINT IF NOT EXISTS students_group_id_fkey
          FOREIGN KEY (group_id)
            REFERENCES groups(id) ON DELETE SET NULL
    `);

    // -------------------------------------------------------------------------
    // STEP 5: CREATE index on students(group_id)
    //
    // Covers: count students in group (max_members check); list students in group;
    // FK traversal path for group deletion guard; ON DELETE SET NULL maintenance path.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_group_id
        ON students (group_id)
    `);

    // -------------------------------------------------------------------------
    // STEP 6: Bump schema_version 1.6.0 → 1.7.0
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE schema_version
        SET version    = '1.7.0',
            applied_at = NOW()
      WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
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
 * STAGE_24 migration is forward-only per ADR-0008.
 * Rollback must be performed via database snapshot restore.
 */
export async function down(_client: PoolClient): Promise<void> {
  throw new Error(
    "STAGE_24_GROUPS migration is forward-only. " +
      "Rollback must be performed via database snapshot restore.",
  );
}
```

---

## 5. Entity Relationship Summary

```
divisions (STAGE_22)
  └── departments (STAGE_23) ──FK RESTRICT────► groups (STAGE_24)
                                                 │
                                       ┌─────────┴───────────┐
                                       │                     │
                               students.group_id      staff_groups
                               (ON DELETE SET NULL)   (ON DELETE CASCADE)
                               FK → groups(id)        FK staff_id → backoffice_staff_users(id)
                                                       FK group_id → groups(id)
```

**Key relationship rules:**

- 1 group may have 0..N students (capped by `max_members` if non-null)
- 1 student belongs to at most 1 group (`group_id` is a scalar FK on students)
- 1 staff member may belong to 0..N groups (no capacity constraint on staff)
- 1 group may have 0..N staff members
- 1 department may have 0..N anchored groups (blocked from deletion while any exist)
- Groups with `department_id = NULL` are workspace-wide (no division constraint)

---

## 6. schemas/index.ts — Required Additions

**File:** `apps/api/src/db/tenant/schemas/index.ts`

Add after existing exports:

```typescript
export * from "./groups.schema";
export * from "./staff-groups.schema";
```
