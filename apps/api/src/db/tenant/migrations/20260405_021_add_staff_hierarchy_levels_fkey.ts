/**
 * Migration: Add Foreign Key Constraint to staff_hierarchy_levels
 *
 * File: apps/api/src/db/tenant/migrations/20260405_021_add_staff_hierarchy_levels_fkey.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 *
 * Purpose:
 * Add the missing DB-level foreign key constraint on staff_hierarchy_levels
 * table to enforce referential integrity between staff_hierarchy_levels and
 * hierarchy_nodes. The Drizzle schema references hierarchyNodes.id with
 * ON DELETE CASCADE, but the database lacked the constraint.
 *
 * Impact:
 * - Enforces that every hierarchy_node_id in staff_hierarchy_levels exists in hierarchy_nodes
 * - Cascades deletion when a hierarchy_node is removed
 * - Prevents orphaned staff_hierarchy_levels rows
 *
 * Safety:
 * - Idempotent: Uses "IF EXISTS" patterns to allow re-runs
 * - No data loss: Only adds constraint to existing data
 * - Backward compatible: Constraint only prevents future invalid inserts
 *
 * References:
 * - ADR-0003: Database schema evolution
 * - AGENTS.md (apps/api): Migration governance
 * - Drizzle schema: hierarchy-nodes.schema.ts
 * - Previous migration: 20260404_020_staff_management.ts (created staff_hierarchy_levels)
 */

import type { PoolClient } from 'pg'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // ── 1. Add foreign key constraint on hierarchy_node_id ────────────────
    // Constraint name: staff_hierarchy_levels_hierarchy_node_id_fkey
    // References: hierarchy_nodes(id)
    // On delete cascade: Removes staff_hierarchy_levels rows when hierarchy node deleted
    await client.query(`
      ALTER TABLE staff_hierarchy_levels
      ADD CONSTRAINT IF NOT EXISTS staff_hierarchy_levels_hierarchy_node_id_fkey
        FOREIGN KEY (hierarchy_node_id)
        REFERENCES hierarchy_nodes(id)
        ON DELETE CASCADE
    `)

    // ── 2. Bump schema version ────────────────────────────────────────────
    await client.query(`
      UPDATE workspace_schema_versions
        SET version = '1.27.0',
            updated_at = NOW()
        WHERE 1=1
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

// ---------------------------------------------------------------------------
// Migration Down (reverse — informational only, never run automatically)
// ---------------------------------------------------------------------------

export async function down(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // ── 1. Drop foreign key constraint ────────────────────────────────────
    await client.query(`
      ALTER TABLE staff_hierarchy_levels
      DROP CONSTRAINT IF EXISTS staff_hierarchy_levels_hierarchy_node_id_fkey
    `)

    // ── 2. Restore schema version ────────────────────────────────────────
    await client.query(`
      UPDATE workspace_schema_versions
        SET version = '1.26.0',
            updated_at = NOW()
        WHERE 1=1
    `)

    await client.query('ROLLBACK')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
