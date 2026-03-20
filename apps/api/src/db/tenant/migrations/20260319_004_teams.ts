/**
 * Tenant Database Migration — Teams & Team Types
 *
 * File: apps/api/src/db/tenant/migrations/20260319_004_teams.ts
 * Date: 2026-03-19
 * Stage: STAGE_26_TEAMS
 * Phase: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE
 *
 * Purpose:
 * 1. CREATE team_types table (all columns, CHECK constraints, indexes, partial unique index)
 * 2. CREATE teams table (FK → team_types ON DELETE SET NULL, indexes, partial unique index)
 * 3. CREATE staff_teams join table (composite PK, FK cascades, index)
 * 4. UPDATE schema_version 1.9.0 → 1.10.0
 *
 * Hard Dependencies (must exist before this migration):
 *   - backoffice_staff_users table — staff_teams.staff_id FK
 *   - _schema_versions table — schema version record
 *
 * No existing tables or columns are modified.
 *
 * Constitutional Compliance:
 * ✓ Tenant DB only — no master_db schema changes
 * ✓ Forward-only migration — down() throws per ADR-0008
 * ✓ All DDL in single transactional BEGIN/COMMIT block
 * ✓ CREATE ... IF NOT EXISTS for idempotency
 * ✓ Additive-only — no existing table or column is dropped
 * ✓ schema_version bumped from 1.9.0 to 1.10.0
 * ✓ Server-authoritative timestamps (NOW())
 *
 * ADR References:
 * - ADR-0001: Database-per-tenant isolation
 * - ADR-0006: Server-authoritative time
 * - ADR-0008: Semantic versioning / schema_version + forward-only migrations
 */

import type { PoolClient } from 'pg'

export const description =
  'Create team_types + teams + staff_teams tables; bump schema_version 1.9.0 → 1.10.0'

/**
 * Forward migration — single transactional DDL block.
 *
 * Transaction boundary:
 *   BEGIN
 *     → CREATE team_types table + constraints + indexes
 *     → CREATE teams table + constraints + indexes
 *     → CREATE staff_teams join table + constraints + indexes
 *     → UPDATE schema_version
 *   COMMIT
 *
 * Failure in any statement rolls back the entire transaction.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // -------------------------------------------------------------------------
    // STEP 1: CREATE team_types table
    //
    // status uses VARCHAR + CHECK (not PG enum) — follows codebase convention.
    //
    // deleted_at nullable — NULL = active; NOT NULL = soft-deleted.
    //
    // Partial functional unique index on LOWER(name) WHERE deleted_at IS NULL
    // is created separately below — enforces case-insensitive name uniqueness
    // across active team types only.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_types (
        id            UUID         NOT NULL DEFAULT gen_random_uuid(),
        name          VARCHAR(255) NOT NULL,
        description   TEXT,
        status        VARCHAR(20)  NOT NULL DEFAULT 'ENABLED'
                        CONSTRAINT team_types_status_check
                          CHECK (status IN ('ENABLED', 'DISABLED')),
        deleted_at    TIMESTAMPTZ,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

        CONSTRAINT team_types_pkey PRIMARY KEY (id)
      )
    `)

    // Partial functional unique index:
    //   Enforces case-insensitive name uniqueness among active (non-soft-deleted) team types.
    //   Deleted records are excluded so their names can be reused.
    //   Drizzle cannot express a partial functional index; owned by this migration only.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS team_types_name_lower_unique_active
        ON team_types (LOWER(name))
        WHERE deleted_at IS NULL
    `)

    // Index: status filter (ENABLED/DISABLED)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_team_types_status
        ON team_types (status)
    `)

    // Index: soft-delete filter — list/lookup queries filter WHERE deleted_at IS NULL
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_team_types_deleted_at
        ON team_types (deleted_at)
    `)

    // Composite index: keyset pagination cursor (created_at, id)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_team_types_created_at_id
        ON team_types (created_at ASC, id ASC)
    `)

    // -------------------------------------------------------------------------
    // STEP 2: CREATE teams table
    //
    // team_type_id FK → team_types(id) ON DELETE SET NULL:
    //   Hard-deleting a team_types row sets team_type_id to null.
    //   In normal operation team_types use soft-delete; this FK fires only for manual cleanup.
    //
    // max_members CHECK: must be a positive integer when set. NULL = uncapped.
    //
    // status uses VARCHAR + CHECK (not PG enum) — follows codebase convention.
    //
    // Partial functional unique index on LOWER(name) WHERE deleted_at IS NULL
    // is created separately below.
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id            UUID         NOT NULL DEFAULT gen_random_uuid(),
        name          VARCHAR(255) NOT NULL,
        team_type_id  UUID,
        max_members   INTEGER
                        CONSTRAINT teams_max_members_check
                          CHECK (max_members IS NULL OR max_members > 0),
        description   TEXT,
        status        VARCHAR(20)  NOT NULL DEFAULT 'ENABLED'
                        CONSTRAINT teams_status_check
                          CHECK (status IN ('ENABLED', 'DISABLED')),
        deleted_at    TIMESTAMPTZ,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

        CONSTRAINT teams_pkey
          PRIMARY KEY (id),
        CONSTRAINT teams_team_type_id_fkey
          FOREIGN KEY (team_type_id)
            REFERENCES team_types(id) ON DELETE SET NULL
      )
    `)

    // Partial functional unique index:
    //   Enforces case-insensitive name uniqueness among active (non-soft-deleted) teams.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS teams_name_lower_unique_active
        ON teams (LOWER(name))
        WHERE deleted_at IS NULL
    `)

    // Index: team type filter — list teams scoped to a type + TEAM_TYPE_HAS_TEAMS guard scan
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_teams_team_type_id
        ON teams (team_type_id)
    `)

    // Index: status filter (ENABLED/DISABLED)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_teams_status
        ON teams (status)
    `)

    // Index: soft-delete filter
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_teams_deleted_at
        ON teams (deleted_at)
    `)

    // Composite index: keyset pagination cursor (created_at, id)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_teams_created_at_id
        ON teams (created_at ASC, id ASC)
    `)

    // -------------------------------------------------------------------------
    // STEP 3: CREATE staff_teams join table
    //
    // Composite PK (staff_id, team_id) enforces uniqueness at DB level,
    // enabling idempotent ON CONFLICT DO NOTHING upsert at the service layer.
    //
    // FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE:
    //   deleting a staff member removes all their team assignments.
    //
    // FK team_id → teams(id) ON DELETE CASCADE:
    //   ARCHITECTURAL NOTE: teams use soft-delete (deleted_at). This CASCADE
    //   will not fire in normal operation because teams rows are never hard-deleted.
    //   The CASCADE exists solely as a safety net for manual DB maintenance.
    //   Service-layer logic must rely on soft-delete guards, not this FK cascade.
    //
    // No separate idx_staff_teams_staff_id is needed:
    //   The composite PK (staff_id, team_id) has staff_id as the leading column,
    //   so PostgreSQL can use it for all staff_id prefix queries without a redundant index.
    //
    // created_at is server-set (NOW()) — client time not trusted (ADR-0006).
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_teams (
        staff_id   UUID        NOT NULL,
        team_id    UUID        NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT staff_teams_pkey
          PRIMARY KEY (staff_id, team_id),
        CONSTRAINT staff_teams_staff_id_fkey
          FOREIGN KEY (staff_id)
            REFERENCES backoffice_staff_users(id) ON DELETE CASCADE,
        CONSTRAINT staff_teams_team_id_fkey
          FOREIGN KEY (team_id)
            REFERENCES teams(id) ON DELETE CASCADE
      )
    `)

    // Index: team member count queries and TEAM_HAS_ASSIGNMENTS deletion guard.
    // Composite PK covers staff_id prefix queries — no additional index needed there.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staff_teams_team_id
        ON staff_teams (team_id)
    `)

    // -------------------------------------------------------------------------
    // STEP 4: Bump schema_version 1.9.0 → 1.10.0
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE _schema_versions
        SET version = '1.10.0'
        WHERE name = 'schema_version'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

/**
 * Down migration — not supported.
 * Rollback requires restoring from a pre-migration database snapshot.
 * See ADR-0008 for the forward-only migration policy.
 */
export function down(): never {
  throw new Error('Down migration not supported. Restore from snapshot.')
}
