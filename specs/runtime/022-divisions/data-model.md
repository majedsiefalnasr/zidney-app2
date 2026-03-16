# STAGE_22_DIVISIONS — Data Model

**Stage**: `STAGE_22_DIVISIONS`  
**Schema version before migration**: `1.4.0`  
**Schema version after migration**: `1.5.0`  
**Migration file**: `apps/api/src/db/tenant/migrations/20260316_001_divisions.ts`

---

## 1. Migration: `20260316_001_divisions.ts`

Full DDL for the forward-only migration. Every statement uses `IF NOT EXISTS` / `ADD COLUMN IF NOT
EXISTS` for idempotency. All DDL executes inside a single `BEGIN / COMMIT` block; any failure rolls
back the entire migration.

```typescript
/**
 * Tenant Database Migration — Divisions
 *
 * File: apps/api/src/db/tenant/migrations/20260316_001_divisions.ts
 * Date: 2026-03-16
 * Stage: STAGE_22_DIVISIONS
 * Phase: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE
 *
 * Purpose:
 * 1. CREATE divisions table (id, name, description, is_default, status, created_at, updated_at)
 * 2. CREATE staff_divisions join table (staff_id, division_id, assigned_at; composite PK)
 * 3. ALTER workspace_settings — ADD divisions_enabled BOOLEAN NOT NULL DEFAULT true
 * 4. ALTER students — ADD division_id UUID (nullable initially)
 * 5. Backfill students.division_id with the default division ID
 * 6. ALTER students.division_id — SET NOT NULL
 * 7. ADD FK: students.division_id REFERENCES divisions(id) ON DELETE RESTRICT
 * 8. UPDATE schema_version 1.4.0 → 1.5.0
 *
 * Constitutional Compliance:
 * ✓ Tenant DB only — no master_db schema changes
 * ✓ Forward-only migration — down() throws per ADR-0008
 * ✓ All DDL in single transactional BEGIN/COMMIT block
 * ✓ CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS for idempotency
 * ✓ Additive-only — no existing table or column is dropped
 * ✓ schema_version bumped from 1.4.0 to 1.5.0
 * ✓ Server-authoritative timestamps (NOW())
 * ✓ Backfill uses default division (STAGE_17_TENANT_BOOTSTRAP guarantee)
 *
 * ADR References:
 * - ADR-0001: Database-per-tenant isolation
 * - ADR-0006: Server-authoritative time
 * - ADR-0008: Semantic versioning / schema_version + forward-only migrations
 *
 * Dependencies:
 * - Default division row MUST exist (created by STAGE_17_TENANT_BOOTSTRAP)
 * - students table MUST exist from prior bootstrap stage
 * - This migration MUST run before STAGE_23_DEPARTMENTS migrations
 */

import type { PoolClient } from "pg";

export const description =
  "Create divisions + staff_divisions tables, add divisions_enabled to workspace_settings, " +
  "add division_id FK to students with backfill; bump schema_version 1.4.0 → 1.5.0";

/**
 * Forward migration — single transactional DDL block.
 *
 * Transaction boundary:
 *   BEGIN
 *     → CREATE divisions table + constraints + indexes
 *     → CREATE staff_divisions join table + constraints + indexes
 *     → ALTER workspace_settings (add divisions_enabled)
 *     → ALTER students (add division_id nullable)
 *     → UPDATE students (backfill division_id = default division)
 *     → ALTER students (set division_id NOT NULL)
 *     → ADD FK constraint on students.division_id
 *     → UPDATE schema_version
 *   COMMIT
 *
 * Failure in any statement rolls back the entire transaction.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query("BEGIN");
  try {
    // -------------------------------------------------------------------------
    // STEP 1: CREATE divisions table
    // status uses VARCHAR + CHECK constraint (not a PG enum) — follows RBAC pattern.
    // is_default uses BOOLEAN — application invariant: exactly one row is true.
    // Both created_at and updated_at are set to NOW() by DB default.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS divisions (
        id          UUID          NOT NULL DEFAULT gen_random_uuid(),
        name        VARCHAR(255)  NOT NULL,
        description TEXT,
        is_default  BOOLEAN       NOT NULL DEFAULT false,
        status      VARCHAR(20)   NOT NULL DEFAULT 'ENABLED'
                      CONSTRAINT divisions_status_check
                        CHECK (status IN ('ENABLED', 'DISABLED')),
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

        CONSTRAINT divisions_pkey
          PRIMARY KEY (id)
      )
    `);

    // Case-insensitive functional unique index on divisions.name.
    // Replaces a plain UNIQUE(name) constraint — prevents concurrent case-variant duplicates
    // such as "Grade 10A" and "GRADE 10A" that a case-sensitive unique index cannot catch.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS divisions_name_lower_unique
        ON divisions (LOWER(name))
    `);

    // Index: filter by status (list enabled/disabled divisions)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_divisions_status
        ON divisions (status)
    `);

    // Index: fast lookup of the default division (used by disable-divisions + backfill)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_divisions_is_default
        ON divisions (is_default)
    `);

    // Composite index: keyset pagination cursor (created_at, id) used by listDivisions.
    // Required for the (created_at, id) > ($cursor_ts, $cursor_id) row-value condition.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_divisions_created_at_id
        ON divisions (created_at ASC, id ASC)
    `);

    // -------------------------------------------------------------------------
    // STEP 2: CREATE staff_divisions join table
    // Composite PK (staff_id, division_id) enforces uniqueness at DB level.
    // FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE:
    //   deleting a staff member removes all their division assignments.
    // FK division_id → divisions(id) ON DELETE RESTRICT:
    //   deleting a division is blocked if any staff assignment exists.
    // assigned_at is server-set (NOW()) — client time not trusted (ADR-0006).
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_divisions (
        staff_id    UUID        NOT NULL,
        division_id UUID        NOT NULL,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT staff_divisions_pkey
          PRIMARY KEY (staff_id, division_id),
        CONSTRAINT staff_divisions_staff_id_fkey
          FOREIGN KEY (staff_id)
            REFERENCES backoffice_staff_users(id) ON DELETE CASCADE,
        CONSTRAINT staff_divisions_division_id_fkey
          FOREIGN KEY (division_id)
            REFERENCES divisions(id) ON DELETE RESTRICT
      )
    `);

    // Composite PK (staff_id, division_id) already provides a B-tree index with staff_id
    // as the leading column — a separate idx_staff_divisions_staff_id is redundant and adds
    // unnecessary write overhead. The composite PK covers all staff_id prefix queries.
    // (No separate staff_id index created.)

    // Index: count/list staff members in a division (used by DIVISION_IN_USE guard)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_divisions_division_id
        ON staff_divisions (division_id)
    `);

    // -------------------------------------------------------------------------
    // STEP 3: ALTER workspace_settings — add divisions_enabled flag
    // Default true: existing tenants are in divisions-enabled mode.
    // The disable-divisions operation sets this to false.
    // ADD COLUMN IF NOT EXISTS ensures idempotency.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE workspace_settings
        ADD COLUMN IF NOT EXISTS divisions_enabled BOOLEAN NOT NULL DEFAULT true
    `);

    // -------------------------------------------------------------------------
    // STEP 4: ALTER students — add division_id column (nullable initially)
    // Must be nullable first to allow backfill in STEP 5.
    // NOT NULL constraint is added in STEP 6 after backfill.
    // ADD COLUMN IF NOT EXISTS ensures idempotency.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS division_id UUID
    `);

    // -------------------------------------------------------------------------
    // STEP 5: Backfill students.division_id with the default division ID
    // Relies on STAGE_17_TENANT_BOOTSTRAP guarantee: exactly one row in
    // divisions has is_default = true at this point in the migration.
    // All students without a division_id receive the default division.
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE students
        SET division_id = (
          SELECT id FROM divisions WHERE is_default = true LIMIT 1
        )
      WHERE division_id IS NULL
    `);

    // -------------------------------------------------------------------------
    // STEP 6: ALTER students.division_id — SET NOT NULL
    // All rows now have a division_id (from STEP 5); the constraint is safe.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE students
        ALTER COLUMN division_id SET NOT NULL
    `);

    // -------------------------------------------------------------------------
    // STEP 7: ADD FK constraint: students.division_id → divisions(id)
    // ON DELETE RESTRICT: prevents deleting a division that has students.
    // ADD CONSTRAINT IF NOT EXISTS is supported in PG 9.6+.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE students
        ADD CONSTRAINT IF NOT EXISTS students_division_id_fkey
          FOREIGN KEY (division_id)
            REFERENCES divisions(id) ON DELETE RESTRICT
    `);

    // Index: list all students in a division + FK enforce path
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_division_id
        ON students (division_id)
    `);

    // -------------------------------------------------------------------------
    // STEP 8: Bump schema_version 1.4.0 → 1.5.0
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE schema_version
        SET version    = '1.5.0',
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
 * STAGE_22 migration is forward-only per ADR-0008.
 * Rollback must be performed via database snapshot restore.
 */
export async function down(_client: PoolClient): Promise<void> {
  throw new Error(
    "STAGE_22_DIVISIONS migration is forward-only. " +
      "Rollback must be performed via database snapshot restore.",
  );
}
```

---

## 2. Drizzle Schema: `divisions.schema.ts`

**File:** `apps/api/src/db/tenant/schemas/divisions.schema.ts`

```typescript
/**
 * Drizzle ORM Schema — Divisions (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/divisions.schema.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Drizzle pgTable definition for the `divisions` table.
 * Table created by migration 20260316_001_divisions.ts.
 *
 * Status uses VARCHAR (not pgEnum) — follows codebase convention established in
 * backoffice-roles.schema.ts / backoffice-staff-users.schema.ts.
 * CHECK constraint is enforced at DB layer in the migration.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 * ✓ password_hash / sensitive columns never exposed (not applicable here)
 */

import { boolean, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// divisions
// ---------------------------------------------------------------------------

export const divisions = pgTable(
  "divisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Division display name. Unique per tenant workspace. */
    name: varchar("name", { length: 255 }).notNull(),
    /** Optional description. Nullable — no default. */
    description: text("description"),
    /**
     * True for exactly one row per tenant: the default division.
     * Immutable after row creation (application-level invariant).
     * Default division always has status = ENABLED.
     */
    is_default: boolean("is_default").notNull().default(false),
    /**
     * Division lifecycle status.
     * 'ENABLED'  → division is operational and assignable.
     * 'DISABLED' → division is inactive; existing assignments are preserved
     *              but new assignments are rejected.
     * CHECK constraint enforced at DB level in migration.
     */
    status: varchar("status", { length: 20 }).notNull().default("ENABLED"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * Case-insensitive functional unique index — handled by migration (LOWER(name)).
     * Drizzle does not generate the functional index; the migration step creates
     * `CREATE UNIQUE INDEX divisions_name_lower_unique ON divisions (LOWER(name))`.
     * No uniqueIndex() declared here to avoid Drizzle generating a conflicting constraint.
     */
    /** Filter divisions by status (list active/disabled). */
    statusIdx: index("idx_divisions_status").on(table.status),
    /** Fast lookup of the single default division row. */
    isDefaultIdx: index("idx_divisions_is_default").on(table.is_default),
    /**
     * Keyset pagination composite index (created_at, id).
     * Handled by migration: `CREATE INDEX idx_divisions_created_at_id ON divisions (created_at ASC, id ASC)`.
     * Not declared via Drizzle index() to keep the Drizzle definition clean and avoid conflicts.
     */
  }),
);

export type Division = typeof divisions.$inferSelect;
export type NewDivision = typeof divisions.$inferInsert;
```

---

## 3. Drizzle Schema: `staff-divisions.schema.ts`

**File:** `apps/api/src/db/tenant/schemas/staff-divisions.schema.ts`

```typescript
/**
 * Drizzle ORM Schema — Staff Divisions Join Table (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/staff-divisions.schema.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Drizzle pgTable definition for the `staff_divisions` join table.
 * Table created by migration 20260316_001_divisions.ts.
 *
 * Composite primary key: (staff_id, division_id).
 * FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE.
 * FK division_id → divisions(id) ON DELETE RESTRICT.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

import { backofficeStaffUsers } from "./backoffice-staff-users.schema";
import { divisions } from "./divisions.schema";

// ---------------------------------------------------------------------------
// staff_divisions
// ---------------------------------------------------------------------------

export const staffDivisions = pgTable(
  "staff_divisions",
  {
    /** FK → backoffice_staff_users(id) ON DELETE CASCADE */
    staff_id: uuid("staff_id")
      .notNull()
      .references(() => backofficeStaffUsers.id, { onDelete: "cascade" }),
    /** FK → divisions(id) ON DELETE RESTRICT */
    division_id: uuid("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "restrict" }),
    /** Server-set assignment timestamp (ADR-0006 — client time not trusted). */
    assigned_at: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** Composite PK enforces uniqueness of (staff_id, division_id) at DB level. */
    pk: primaryKey({ columns: [table.staff_id, table.division_id] }),
    /**
     * idx_staff_divisions_staff_id is intentionally NOT declared here.
     * The composite PK (staff_id, division_id) has staff_id as leading column,
     * so PostgreSQL can use it for all staff_id lookups without a separate index.
     */
    /** Count/list staff members in a division (DIVISION_IN_USE guard). */
    divisionIdIdx: index("idx_staff_divisions_division_id").on(table.division_id),
  }),
);

export type StaffDivision = typeof staffDivisions.$inferSelect;
export type NewStaffDivision = typeof staffDivisions.$inferInsert;
```

---

## 4. Schema Update: `workspace-settings.schema.ts` (additive)

**File:** `apps/api/src/db/tenant/schemas/workspace-settings.schema.ts`

Add the following field to the `workspaceSettings` pgTable column map (after `security_settings`):

```typescript
    /**
     * Feature flag for multi-division mode.
     * true  → workspace is in divisions-enabled mode (default).
     * false → workspace is in single-division mode (set by disable-divisions operation).
     * Once set to false, cannot be re-enabled via API (requires operator migration).
     */
    divisions_enabled: boolean('divisions_enabled').notNull().default(true),
```

No index is needed — the flag is read once per request from the settings singleton row.

---

## 5. Existing Schema to Verify: `students` table

**Action required before migration runs:**

The migration executes `ALTER TABLE students ADD COLUMN IF NOT EXISTS division_id UUID`.
Verify that the `students` table exists in the tenant DB from the prior bootstrap stage
(STAGE_17_TENANT_BOOTSTRAP). If a Drizzle schema file exists at
`apps/api/src/db/tenant/schemas/students.schema.ts`, add the following field to it:

```typescript
    /**
     * FK → divisions(id) ON DELETE RESTRICT.
     * NOT NULL — every student must belong to exactly one division.
     * Set by migration 20260316_001_divisions.ts; backfilled to default division.
     */
    division_id: uuid('division_id')
      .notNull()
      .references(() => divisions.id, { onDelete: 'restrict' }),
```

And add this index to the table callback:

```typescript
    divisionIdIdx: index('idx_students_division_id').on(table.division_id),
```

If no Drizzle schema file exists for `students`, create one following the same pattern as
`backoffice-staff-users.schema.ts`. The migration itself is self-contained raw SQL and will run
regardless.

---

## 6. Entity Relationship Diagram

```
workspace_settings (singleton)
  └── divisions_enabled: boolean

divisions
  ├── id (PK)
  ├── name (UNIQUE via LOWER(name) functional idx — NOT a plain UNIQUE constraint)
  ├── description
  ├── is_default (exactly one true)
  ├── status (ENABLED | DISABLED)
  ├── created_at
  └── updated_at
       │
       ├──< staff_divisions >──── backoffice_staff_users
       │     ├── staff_id (FK → backoffice_staff_users, CASCADE)
       │     ├── division_id (FK → divisions, RESTRICT)
       │     └── assigned_at
       │
       └──< students
             └── division_id (FK → divisions, RESTRICT, NOT NULL)
```

---

## 7. Index Summary

| Table             | Index name                        | Columns                    | Purpose                              |
| ----------------- | --------------------------------- | -------------------------- | ------------------------------------ |
| `divisions`       | `divisions_name_lower_unique`     | `(LOWER(name))`            | Case-insensitive uniqueness (unique) |
| `divisions`       | `idx_divisions_status`            | `(status)`                 | Filter by ENABLED/DISABLED           |
| `divisions`       | `idx_divisions_is_default`        | `(is_default)`             | Default division lookup              |
| `divisions`       | `idx_divisions_created_at_id`     | `(created_at ASC, id ASC)` | Keyset pagination cursor             |
| `staff_divisions` | composite PK                      | `(staff_id, division_id)`  | Uniqueness + PK + staff_id prefix    |
| `staff_divisions` | `idx_staff_divisions_division_id` | `(division_id)`            | Division's staff list                |
| `students`        | `idx_students_division_id`        | `(division_id)`            | Students in division                 |

---

## 8. Migration Risk Notes

| Risk                                                           | Mitigation                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `students` table may not exist                                 | Verify existence before deploying; migration fails fast with FK error       |
| Backfill in STEP 5 fails if no default division exists         | STAGE_17 bootstrap must have run first; verify before deploy                |
| Concurrent `ALTER TABLE students ALTER COLUMN SET NOT NULL`    | Takes `ACCESS EXCLUSIVE` lock on students; deploy during low-traffic window |
| STEP 7 `ADD CONSTRAINT IF NOT EXISTS` requires PostgreSQL 9.6+ | All Zidney deployments use compatible PG version                            |
