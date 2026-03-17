# STAGE_23_DEPARTMENTS — Data Model

**Stage**: STAGE_23_DEPARTMENTS  
**Phase**: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Date**: 2026-03-17  
**Author**: speckit.plan (AI)  
**Status**: REFERENCE — implementation source for all data-layer files

---

## 1. Drizzle Schema: `departments` table

**File**: `apps/api/src/db/tenant/schemas/departments.schema.ts` _(NEW)_

```typescript
/**
 * Drizzle ORM Schema — Departments (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/departments.schema.ts
 * Stage: STAGE_23_DEPARTMENTS
 * Date: 2026-03-17
 *
 * Drizzle pgTable definition for the `departments` table.
 * Table created by migration 20260317_001_departments.ts.
 *
 * Self-referencing parent_id:
 *   Uses the `(): AnyPgColumn =>` deferred lambda to satisfy TypeScript strict
 *   mode while allowing the self-reference forward declaration.
 *
 * Functional composite unique index:
 *   UNIQUE (LOWER(name), COALESCE(parent_id, uuid_sentinel)) is owned by the
 *   migration (`departments_name_parent_lower_unique`). Drizzle cannot express
 *   this functional index via uniqueIndex(); no uniqueIndex() declaration here
 *   to avoid generating a conflicting plain UNIQUE constraint.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { divisions } from "./divisions.schema";

// ---------------------------------------------------------------------------
// departments
// ---------------------------------------------------------------------------

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Department display name. Unique within same parent scope (functional composite index). */
    name: varchar("name", { length: 255 }).notNull(),

    /**
     * Department classification type.
     * Allowed values: 'MAIN' | 'SUB' | 'SIMPLE'.
     * CHECK constraint enforced at DB layer in migration.
     */
    type: varchar("type", { length: 20 }).notNull(),

    /**
     * Self-referencing parent FK.
     * Null = root-level department (no parent).
     * FK → departments(id) ON DELETE RESTRICT: prevents parent deletion while children exist.
     * Uses AnyPgColumn deferred lambda for TypeScript self-reference forward declaration.
     */
    parent_id: uuid("parent_id").references((): AnyPgColumn => departments.id, {
      onDelete: "restrict",
    }),

    /**
     * Optional division association.
     * Null = cross-division department (accessible from any division).
     * FK → divisions(id) ON DELETE RESTRICT: division cannot be deleted while departments reference it.
     */
    division_id: uuid("division_id").references(() => divisions.id, { onDelete: "restrict" }),

    /**
     * Maximum number of students assignable to this department.
     * Null = unlimited.
     * Positive integer only — CHECK (max_users IS NULL OR max_users > 0) enforced in migration.
     * Enforcement uses SELECT FOR UPDATE on departments row inside student assignment transaction.
     */
    max_users: integer("max_users"),

    /** Optional description. Nullable — no default. */
    description: text("description"),

    /**
     * Department lifecycle status.
     * 'ENABLED'  → department is operational and accepting assignments.
     * 'DISABLED' → department is inactive; existing assignments preserved,
     *              new assignments rejected (DEPARTMENT_DISABLED error).
     * CHECK constraint enforced at DB layer in migration.
     */
    status: varchar("status", { length: 20 }).notNull().default("ENABLED"),

    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * Hierarchy traversal index — used by GET /:id/children and tree build.
     * Also serves the parent deletion guard (FK scan on parent_id).
     */
    parentIdIdx: index("idx_departments_parent_id").on(table.parent_id),

    /**
     * Division-scoped filter — used by list endpoint division_id filter.
     * Also serves the division deletion guard (FK scan on division_id).
     */
    divisionIdIdx: index("idx_departments_division_id").on(table.division_id),

    /** Status filter — list ENABLED/DISABLED departments. */
    statusIdx: index("idx_departments_status").on(table.status),

    /** Type filter — list MAIN/SUB/SIMPLE departments. */
    typeIdx: index("idx_departments_type").on(table.type),

    /**
     * Keyset pagination composite index (created_at, id).
     * Handled by migration:
     *   CREATE INDEX idx_departments_created_at_id ON departments (created_at ASC, id ASC)
     * Not declared via Drizzle index() to avoid conflicts with the migration-managed index.
     */
  }),
);

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
```

---

## 2. Drizzle Schema: `staff_departments` join table

**File**: `apps/api/src/db/tenant/schemas/staff-departments.schema.ts` _(NEW)_

```typescript
/**
 * Drizzle ORM Schema — Staff Departments Join Table (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/staff-departments.schema.ts
 * Stage: STAGE_23_DEPARTMENTS
 * Date: 2026-03-17
 *
 * Drizzle pgTable definition for the `staff_departments` join table.
 * Table created by migration 20260317_001_departments.ts.
 *
 * Composite primary key: (staff_id, department_id).
 * FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE.
 * FK department_id → departments(id) ON DELETE CASCADE.
 *   Cascade (not RESTRICT): department deletion cascades to staff assignments
 *   once the service guard confirms no active assignments remain.
 *
 * Key difference from staff_divisions:
 *   staff_divisions.division_id uses ON DELETE RESTRICT (divisions are first-class boundaries).
 *   staff_departments.department_id uses ON DELETE CASCADE (departments are secondary segmentation).
 *
 * No separate idx_staff_departments_staff_id — the composite PK (staff_id, department_id)
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
import { departments } from "./departments.schema";

// ---------------------------------------------------------------------------
// staff_departments
// ---------------------------------------------------------------------------

export const staffDepartments = pgTable(
  "staff_departments",
  {
    /** FK → backoffice_staff_users(id) ON DELETE CASCADE */
    staff_id: uuid("staff_id")
      .notNull()
      .references(() => backofficeStaffUsers.id, { onDelete: "cascade" }),

    /** FK → departments(id) ON DELETE CASCADE */
    department_id: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),

    /** Server-set assignment timestamp (ADR-0006 — client time not trusted). */
    assigned_at: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** Composite PK enforces uniqueness of (staff_id, department_id) at DB level. */
    pk: primaryKey({ columns: [table.staff_id, table.department_id] }),

    /**
     * idx_staff_departments_staff_id is intentionally NOT declared here.
     * The composite PK (staff_id, department_id) has staff_id as leading column,
     * so PostgreSQL can use it for all staff_id prefix queries without a separate index.
     */

    /** Count/list staff members in a department (DEPARTMENT_HAS_ASSIGNMENTS guard). */
    departmentIdIdx: index("idx_staff_departments_department_id").on(table.department_id),
  }),
);

export type StaffDepartment = typeof staffDepartments.$inferSelect;
export type NewStaffDepartment = typeof staffDepartments.$inferInsert;
```

---

## 3. Modified Schema: `students` table (add `department_id`)

**File**: `apps/api/src/db/tenant/schemas/students.schema.ts` _(UPDATE)_

The field to add to the existing `students` pgTable definition:

```typescript
// ADD this import at the top:
import { departments } from './departments.schema'

// ADD this column inside the pgTable columns object:
/**
 * Department assignment — added by migration 20260317_001_departments.ts (STAGE_23).
 * FK → departments(id) ON DELETE SET NULL:
 *   deleting a department sets this column to null for previously assigned students.
 * NULLABLE: no backfill required; existing students start with department_id = null.
 */
department_id: uuid('department_id').references(() => departments.id, { onDelete: 'setNull' }),

// ADD this index inside the pgTable (table) => ({}) callback:
/** List all students in a department + FK traversal path. */
departmentIdIdx: index('idx_students_department_id').on(table.department_id),
```

**Full updated shape** (columns only — all existing columns retained, `department_id` appended):

| Column          | Drizzle type                     | Changes               |
| --------------- | -------------------------------- | --------------------- |
| `id`            | `uuid` PK                        | No change             |
| `external_id`   | `varchar(255)` nullable          | No change             |
| `email`         | `varchar(255)` notNull           | No change             |
| `first_name`    | `varchar(255)` nullable          | No change             |
| `last_name`     | `varchar(255)` nullable          | No change             |
| `division_id`   | `uuid` notNull FK → divisions    | No change (STAGE_22)  |
| `department_id` | `uuid` nullable FK → departments | **ADDED in STAGE_23** |
| `created_at`    | `timestamp` notNull              | No change             |
| `updated_at`    | `timestamp` notNull              | No change             |

---

## 4. Migration File

**File**: `apps/api/src/db/tenant/migrations/20260317_001_departments.ts` _(NEW)_

```typescript
/**
 * Tenant Database Migration — Departments
 *
 * File: apps/api/src/db/tenant/migrations/20260317_001_departments.ts
 * Date: 2026-03-17
 * Stage: STAGE_23_DEPARTMENTS
 * Phase: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE
 *
 * Purpose:
 * 1. CREATE departments table (all columns, CHECK constraints, indexes)
 * 2. CREATE staff_departments join table (composite PK, FKs, index)
 * 3. ALTER students — ADD COLUMN department_id UUID nullable
 * 4. ADD FK constraint: students.department_id → departments(id) ON DELETE SET NULL
 * 5. CREATE index on students(department_id)
 * 6. UPDATE schema_version 1.5.0 → 1.6.0
 *
 * Hard Dependencies (must exist before this migration):
 *   - divisions table (STAGE_22_DIVISIONS) — departments.division_id FK
 *   - backoffice_staff_users table — staff_departments.staff_id FK
 *   - students table — department_id column addition
 *
 * No backfill step: department_id on students is nullable; existing rows get NULL.
 *
 * Constitutional Compliance:
 * ✓ Tenant DB only — no master_db schema changes
 * ✓ Forward-only migration — down() throws per ADR-0008
 * ✓ All DDL in single transactional BEGIN/COMMIT block
 * ✓ CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for idempotency
 * ✓ Additive-only — no existing table or column is dropped
 * ✓ schema_version bumped from 1.5.0 to 1.6.0
 * ✓ Server-authoritative timestamps (NOW())
 *
 * ADR References:
 * - ADR-0001: Database-per-tenant isolation
 * - ADR-0006: Server-authoritative time
 * - ADR-0008: Semantic versioning / schema_version + forward-only migrations
 */

import type { PoolClient } from "pg";

export const description =
  "Create departments + staff_departments tables, add nullable department_id FK to students; " +
  "bump schema_version 1.5.0 → 1.6.0";

/**
 * Forward migration — single transactional DDL block.
 *
 * Transaction boundary:
 *   BEGIN
 *     → CREATE departments table + constraints + indexes
 *     → CREATE staff_departments join table + constraints + indexes
 *     → ALTER students (add department_id nullable)
 *     → ADD FK constraint on students.department_id
 *     → CREATE index on students(department_id)
 *     → UPDATE schema_version
 *   COMMIT
 *
 * Failure in any statement rolls back the entire transaction.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query("BEGIN");
  try {
    // -------------------------------------------------------------------------
    // STEP 1: CREATE departments table
    //
    // Self-referencing: parent_id FK → departments(id) ON DELETE RESTRICT
    //   blocks parent deletion while any child departments reference it.
    //
    // division_id FK → divisions(id) ON DELETE RESTRICT
    //   blocks division deletion while departments are scoped to it.
    //
    // status uses VARCHAR + CHECK (not PG enum) — follows codebase convention.
    // type  uses VARCHAR + CHECK — enforces MAIN|SUB|SIMPLE at DB layer.
    // max_users CHECK: must be positive integer when set.
    //
    // Functional composite unique index on (LOWER(name), COALESCE(parent_id, sentinel))
    // is created separately below — enforces case-insensitive name uniqueness within
    // parent scope; NULL parent_id rows use a sentinel UUID for COALESCE comparison
    // so that two root-level departments cannot share a name.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id           UUID          NOT NULL DEFAULT gen_random_uuid(),
        name         VARCHAR(255)  NOT NULL,
        type         VARCHAR(20)   NOT NULL
                       CONSTRAINT departments_type_check
                         CHECK (type IN ('MAIN', 'SUB', 'SIMPLE')),
        parent_id    UUID,
        division_id  UUID,
        max_users    INTEGER
                       CONSTRAINT departments_max_users_check
                         CHECK (max_users IS NULL OR max_users > 0),
        description  TEXT,
        status       VARCHAR(20)   NOT NULL DEFAULT 'ENABLED'
                       CONSTRAINT departments_status_check
                         CHECK (status IN ('ENABLED', 'DISABLED')),
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

        CONSTRAINT departments_pkey
          PRIMARY KEY (id),
        CONSTRAINT departments_parent_id_fkey
          FOREIGN KEY (parent_id)
            REFERENCES departments(id) ON DELETE RESTRICT,
        CONSTRAINT departments_division_id_fkey
          FOREIGN KEY (division_id)
            REFERENCES divisions(id) ON DELETE RESTRICT
      )
    `);

    // Composite functional unique index:
    //   Enforces case-insensitive name uniqueness within the same parent scope.
    //   COALESCE(parent_id, '00000000-0000-0000-0000-000000000000') maps NULL parent_id
    //   to a sentinel UUID so two root departments cannot share a name.
    //   Drizzle cannot express this functional index; it is owned by this migration only.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS departments_name_parent_lower_unique
        ON departments (
          LOWER(name),
          COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
        )
    `);

    // Index: hierarchy traversal and /:id/children queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_parent_id
        ON departments (parent_id)
    `);

    // Index: division-scoped list filter
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_division_id
        ON departments (division_id)
    `);

    // Index: status filter (ENABLED/DISABLED)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_status
        ON departments (status)
    `);

    // Index: type filter (MAIN/SUB/SIMPLE)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_type
        ON departments (type)
    `);

    // Composite index: keyset pagination cursor (created_at, id)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_created_at_id
        ON departments (created_at ASC, id ASC)
    `);

    // -------------------------------------------------------------------------
    // STEP 2: CREATE staff_departments join table
    //
    // Composite PK (staff_id, department_id) enforces uniqueness at DB level,
    // enabling idempotent ON CONFLICT DO NOTHING upsert at the service layer.
    //
    // FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE:
    //   deleting a staff member removes all their department assignments.
    //
    // FK department_id → departments(id) ON DELETE CASCADE:
    //   deleting a department cascades to staff assignments (service guard
    //   checks for active assignments before the DELETE; CASCADE is safety net).
    //
    // assigned_at is server-set (NOW()) — client time not trusted (ADR-0006).
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_departments (
        staff_id      UUID        NOT NULL,
        department_id UUID        NOT NULL,
        assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT staff_departments_pkey
          PRIMARY KEY (staff_id, department_id),
        CONSTRAINT staff_departments_staff_id_fkey
          FOREIGN KEY (staff_id)
            REFERENCES backoffice_staff_users(id) ON DELETE CASCADE,
        CONSTRAINT staff_departments_department_id_fkey
          FOREIGN KEY (department_id)
            REFERENCES departments(id) ON DELETE CASCADE
      )
    `);

    // Composite PK (staff_id, department_id) already covers all staff_id prefix queries.
    // Index: count/list staff members in a department (DEPARTMENT_HAS_ASSIGNMENTS guard)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_departments_department_id
        ON staff_departments (department_id)
    `);

    // -------------------------------------------------------------------------
    // STEP 3: ALTER students — add department_id column (nullable)
    //
    // department_id is nullable; existing rows get NULL automatically.
    // No backfill required (unlike division_id in STAGE_22 which was NOT NULL).
    // ADD COLUMN IF NOT EXISTS ensures idempotency.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS department_id UUID
    `);

    // -------------------------------------------------------------------------
    // STEP 4: ADD FK constraint: students.department_id → departments(id)
    //
    // ON DELETE SET NULL: deleting a department sets students.department_id to null.
    // This preserves student records without orphaning them.
    // ADD CONSTRAINT IF NOT EXISTS is supported in PG 9.6+.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE students
        ADD CONSTRAINT IF NOT EXISTS students_department_id_fkey
          FOREIGN KEY (department_id)
            REFERENCES departments(id) ON DELETE SET NULL
    `);

    // -------------------------------------------------------------------------
    // STEP 5: CREATE index on students(department_id)
    //
    // Covers: list students in a department; FK traversal path for assignment
    // count queries; ON DELETE SET NULL maintenance path.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_department_id
        ON students (department_id)
    `);

    // -------------------------------------------------------------------------
    // STEP 6: Bump schema_version 1.5.0 → 1.6.0
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE schema_version
        SET version    = '1.6.0',
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
 * STAGE_23 migration is forward-only per ADR-0008.
 * Rollback must be performed via database snapshot restore.
 */
export async function down(_client: PoolClient): Promise<void> {
  throw new Error(
    "STAGE_23_DEPARTMENTS migration is forward-only. " +
      "Rollback must be performed via database snapshot restore.",
  );
}
```

---

## 5. Schema Index Barrel Update

**File**: `apps/api/src/db/tenant/schemas/index.ts` _(UPDATE — add two new exports)_

Add the following exports to the existing barrel:

```typescript
export * from "./departments.schema";
export * from "./staff-departments.schema";
```

The barrel already exports `students.schema` — no additional export needed for the students
modification (only the file content changes, the export stays the same).

---

## 6. Migration Steps Summary

| Step | SQL Operation                                                                   | Idempotency Guard                   |
| ---- | ------------------------------------------------------------------------------- | ----------------------------------- |
| 1    | `CREATE TABLE IF NOT EXISTS departments`                                        | IF NOT EXISTS                       |
| 1a   | `CREATE UNIQUE INDEX` departments_name_parent_lower_unique                      | IF NOT EXISTS                       |
| 1b   | `CREATE INDEX` idx_departments_parent_id                                        | IF NOT EXISTS                       |
| 1c   | `CREATE INDEX` idx_departments_division_id                                      | IF NOT EXISTS                       |
| 1d   | `CREATE INDEX` idx_departments_status                                           | IF NOT EXISTS                       |
| 1e   | `CREATE INDEX` idx_departments_type                                             | IF NOT EXISTS                       |
| 1f   | `CREATE INDEX` idx_departments_created_at_id                                    | IF NOT EXISTS                       |
| 2    | `CREATE TABLE IF NOT EXISTS staff_departments`                                  | IF NOT EXISTS                       |
| 2a   | `CREATE INDEX` idx_staff_departments_department_id                              | IF NOT EXISTS                       |
| 3    | `ALTER TABLE students ADD COLUMN IF NOT EXISTS department_id UUID`              | IF NOT EXISTS                       |
| 4    | `ALTER TABLE students ADD CONSTRAINT IF NOT EXISTS students_department_id_fkey` | IF NOT EXISTS                       |
| 5    | `CREATE INDEX IF NOT EXISTS idx_students_department_id`                         | IF NOT EXISTS                       |
| 6    | `UPDATE schema_version SET version = '1.6.0'`                                   | Row update (idempotent re-run safe) |

**Version Bump**: `1.5.0` → `1.6.0`

**Total DDL statements in transaction**: 14 (all idempotent).

**Rollback**: Forward-only. `down()` throws. Rollback = restore DB snapshot.
