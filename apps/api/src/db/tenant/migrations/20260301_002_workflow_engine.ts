/**
 * Tenant Database Migration — Workflow Engine
 *
 * File: apps/api/src/db/tenant/migrations/20260301_002_workflow_engine.ts
 * Date: 2026-03-01
 * Stage: STAGE_20_STATUS_WORKFLOW_ENGINE
 *
 * Purpose:
 * Create `workflow_logs` table with all indexes, attach immutability
 * trigger (reusing existing prevent_audit_modification() function from
 * v1.0.0 baseline triggers.sql), and bump schema_version 1.2.0 → 1.3.0.
 *
 * Constitutional Compliance:
 * ✓ Tenant DB only — no master_db schema changes
 * ✓ Forward-only migration — down() throws per ADR-0008
 * ✓ All DDL in single transactional BEGIN/COMMIT block
 * ✓ CREATE ... IF NOT EXISTS for idempotency
 * ✓ Additive-only — no existing table modifications
 * ✓ Reuses existing prevent_audit_modification() trigger function
 * ✓ schema_version bumped from 1.2.0 to 1.3.0
 *
 * Note: Entity table status columns (status, status_updated_at,
 * status_updated_by) are NOT added here — they are added per-entity
 * in Stage 21+ migrations to avoid coupling this migration to entity
 * tables that do not yet exist.
 */

import type { PoolClient } from 'pg'

export const description =
  'Create workflow_logs table with indexes and immutability trigger; bump schema_version 1.2.0 → 1.3.0'

/**
 * Forward migration — single transactional DDL block.
 *
 * Transaction boundary:
 *   BEGIN → CREATE workflow_logs → indexes → immutability trigger
 *         → UPDATE schema_version → COMMIT
 *
 * Failure in any statement rolls back the entire transaction.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // ------------------------------------------------------------------
    // STEP 1: Create workflow_logs table
    // ------------------------------------------------------------------
    // CHECK constraints on previous_state and new_state enforce valid
    // state values at the DB level (Research R-007).
    // workspace_id is intentionally absent — in database-per-tenant
    // model, the database itself is the tenant identity.
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_logs (
        id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type    VARCHAR(100)  NOT NULL,
        entity_id      UUID          NOT NULL,
        previous_state VARCHAR(50)   NOT NULL
          CHECK (previous_state IN ('COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')),
        new_state      VARCHAR(50)   NOT NULL
          CHECK (new_state IN ('COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')),
        changed_by     UUID          NOT NULL,
        changed_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        reason         TEXT
      )
    `)

    // ------------------------------------------------------------------
    // STEP 2: Index — paginated audit history per entity (US-5, FR-007)
    // Covers queries: WHERE entity_type=$1 AND entity_id=$2 ORDER BY changed_at DESC
    // ------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wfl_entity_created
        ON workflow_logs (entity_type, entity_id, changed_at DESC, id DESC)
    `)

    // ------------------------------------------------------------------
    // STEP 3: Index — actor activity query (admin audit support)
    // Covers queries: WHERE changed_by=$1 ORDER BY changed_at DESC
    // ------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wfl_actor_created
        ON workflow_logs (changed_by, changed_at DESC)
    `)

    // ------------------------------------------------------------------
    // STEP 4: Index — bulk type-level reporting
    // Covers queries: WHERE entity_type=$1 ORDER BY changed_at DESC
    // ------------------------------------------------------------------
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wfl_entity_type_created
        ON workflow_logs (entity_type, changed_at DESC)
    `)

    // ------------------------------------------------------------------
    // STEP 5: Immutability trigger — prevent UPDATE or DELETE on workflow_logs
    // Reuses the prevent_audit_modification() function from v1.0.0 triggers.sql.
    // This function already exists in the tenant schema — no new trigger
    // function needs to be created.
    // ------------------------------------------------------------------
    await client.query(`
      DROP TRIGGER IF EXISTS prevent_workflow_log_modification
        ON workflow_logs
    `)

    await client.query(`
      CREATE TRIGGER prevent_workflow_log_modification
        BEFORE UPDATE OR DELETE ON workflow_logs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_audit_modification()
    `)

    // ------------------------------------------------------------------
    // STEP 6: Bump schema_version 1.2.0 → 1.3.0
    // ------------------------------------------------------------------
    await client.query(`
      UPDATE schema_version
        SET version    = '1.3.0',
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
 * Workflow engine migration is forward-only per ADR-0008.
 * Rollback must be performed via database snapshot restore.
 */
export async function down(_client: PoolClient): Promise<void> {
  throw new Error('Workflow engine migration is not reversible. Restore from snapshot.')
}
