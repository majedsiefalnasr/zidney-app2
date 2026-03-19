/**
 * Tenant Database Migration — Groups
 *
 * File: apps/api/src/db/tenant/migrations/20260319_001_groups.ts
 * Date: 2026-03-19
 * Stage: STAGE_24_GROUPS
 * Phase: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE
 *
 * Purpose:
 * 1. CREATE groups table (all columns, CHECK constraints, indexes, partial unique index)
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

import type { PoolClient } from 'pg'

export const description =
  'Create groups + staff_groups tables, add nullable group_id FK to students; ' +
  'bump schema_version 1.6.0 → 1.7.0'

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
  await client.query('BEGIN')
  try {
    // -------------------------------------------------------------------------
    // STEP 1: CREATE groups table
    //
    // department_id FK → departments(id) ON DELETE RESTRICT:
    //   prevents deleting a department that still has active groups.
    //   Soft-deleted groups (deleted_at IS NOT NULL) are ignored by service-layer
    //   guards before this constraint triggers.
    //
    // status uses VARCHAR + CHECK (not PG enum) — follows codebase convention.
    // max_members CHECK: must be positive integer when set.
    //
    // deleted_at nullable — NULL = active; NOT NULL = soft-deleted.
    //
    // Partial functional unique index on LOWER(name) WHERE deleted_at IS NULL
    // is created separately below — enforces case-insensitive name uniqueness
    // across active groups only.
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
    `)

    // Partial functional unique index:
    //   Enforces case-insensitive name uniqueness among active (non-soft-deleted) groups.
    //   Deleted groups are excluded so their names can be reused.
    //   Drizzle cannot express a partial functional index; owned by this migration only.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS groups_name_lower_unique_active
        ON groups (LOWER(name))
        WHERE deleted_at IS NULL
    `)

    // Index: department-scoped list filter + FK traversal path
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_groups_department_id
        ON groups (department_id)
    `)

    // Index: status filter (ENABLED/DISABLED)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_groups_status
        ON groups (status)
    `)

    // Index: soft-delete filter — most list/lookup queries filter WHERE deleted_at IS NULL
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_groups_deleted_at
        ON groups (deleted_at)
    `)

    // Composite index: keyset pagination cursor (created_at, id)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_groups_created_at_id
        ON groups (created_at ASC, id ASC)
    `)

    // -------------------------------------------------------------------------
    // STEP 2: CREATE staff_groups join table
    //
    // Composite PK (staff_id, group_id) enforces uniqueness at DB level,
    // enabling idempotent ON CONFLICT DO NOTHING upsert at the service layer.
    //
    // FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE:
    //   deleting a staff member removes all their group assignments.
    //
    // FK group_id → groups(id) ON DELETE CASCADE:
    //   ARCHITECTURAL NOTE: Groups use soft-delete (deleted_at). This CASCADE
    //   will not fire in normal operation because groups rows are never hard-deleted.
    //   The CASCADE exists solely as a safety net in case of manual DB maintenance.
    //   Service-layer logic must rely on soft-delete guards, not this FK cascade.
    //
    // created_at is server-set (NOW()) — client time not trusted (ADR-0006).
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_groups (
        staff_id   UUID        NOT NULL,
        group_id   UUID        NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT staff_groups_pkey
          PRIMARY KEY (staff_id, group_id),
        CONSTRAINT staff_groups_staff_id_fkey
          FOREIGN KEY (staff_id)
            REFERENCES backoffice_staff_users(id) ON DELETE CASCADE,
        CONSTRAINT staff_groups_group_id_fkey
          FOREIGN KEY (group_id)
            REFERENCES groups(id) ON DELETE CASCADE
      )
    `)

    // Composite PK (staff_id, group_id) already covers all staff_id prefix queries.
    // Index: count/list staff members in a group (GROUP_HAS_ASSIGNMENTS guard)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_groups_group_id
        ON staff_groups (group_id)
    `)

    // -------------------------------------------------------------------------
    // STEP 3: ALTER students — add group_id column (nullable)
    //
    // group_id is nullable; existing rows get NULL automatically.
    // No backfill required.
    // ADD COLUMN IF NOT EXISTS ensures idempotency.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE students
        ADD COLUMN IF NOT EXISTS group_id UUID
    `)

    // -------------------------------------------------------------------------
    // STEP 4: ADD FK constraint: students.group_id → groups(id)
    //
    // ON DELETE SET NULL: deleting a groups row sets students.group_id to null.
    // Since groups use soft-delete this constraint fires only on manual hard-delete;
    // it preserves student records without orphaning them.
    // ADD CONSTRAINT IF NOT EXISTS is supported in PG 9.6+.
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE students
        ADD CONSTRAINT IF NOT EXISTS students_group_id_fkey
          FOREIGN KEY (group_id)
            REFERENCES groups(id) ON DELETE SET NULL
    `)

    // -------------------------------------------------------------------------
    // STEP 5: CREATE index on students(group_id)
    //
    // Covers: list students in a group; FK traversal path for assignment
    // count queries inside SELECT FOR UPDATE transactions.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_group_id
        ON students (group_id)
    `)

    // -------------------------------------------------------------------------
    // STEP 6: Bump schema_version 1.6.0 → 1.7.0
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE schema_version
        SET version    = '1.7.0',
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
 * STAGE_24 migration is forward-only per ADR-0008.
 * Rollback must be performed via database snapshot restore.
 */
export async function down(_client: PoolClient): Promise<void> {
  throw new Error(
    'STAGE_24_GROUPS migration is forward-only. ' +
      'Rollback must be performed via database snapshot restore.'
  )
}
