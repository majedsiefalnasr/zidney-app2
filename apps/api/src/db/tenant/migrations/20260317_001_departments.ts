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

import type { PoolClient } from 'pg'

export const description =
  'Create departments + staff_departments tables, add nullable department_id FK to students; ' +
  'bump schema_version 1.5.0 → 1.6.0'

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
  await client.query('BEGIN')
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
    `)

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
    `)

    // Index: hierarchy traversal and /:id/children queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_parent_id
        ON departments (parent_id)
    `)

    // Index: division-scoped list filter
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_division_id
        ON departments (division_id)
    `)

    // Index: status filter (ENABLED/DISABLED)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_status
        ON departments (status)
    `)

    // Index: type filter (MAIN/SUB/SIMPLE)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_type
        ON departments (type)
    `)

    // Composite index: keyset pagination cursor (created_at, id)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_departments_created_at_id
        ON departments (created_at ASC, id ASC)
    `)

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
    `)

    // Composite PK (staff_id, department_id) already covers all staff_id prefix queries.
    // Index: count/list staff members in a department (DEPARTMENT_HAS_ASSIGNMENTS guard)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_departments_department_id
        ON staff_departments (department_id)
    `)

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
    `)

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
    `)

    // -------------------------------------------------------------------------
    // STEP 5: CREATE index on students(department_id)
    //
    // Covers: list students in a department; FK traversal path for assignment
    // count queries; ON DELETE SET NULL maintenance path.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_department_id
        ON students (department_id)
    `)

    // -------------------------------------------------------------------------
    // STEP 6: Bump schema_version 1.5.0 → 1.6.0
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE schema_version
        SET version    = '1.6.0',
            applied_at = NOW()
      WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
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
    'STAGE_23_DEPARTMENTS migration is forward-only. ' +
      'Rollback must be performed via database snapshot restore.'
  )
}
