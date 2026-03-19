import { sql } from 'drizzle-orm'
import type { MigrationMeta } from 'drizzle-orm/migrator'

/**
 * Migration: 20260319_003_add_hierarchy_node_id_to_users
 *
 * Purpose: Add staff hierarchy assignment support to users table.
 *
 * Changes:
 * - Add nullable `hierarchy_node_id` column to `users` table (for staff org assignment)
 * - Add FK constraint to `hierarchy_nodes` table (CASCADE delete when node is deleted)
 * - Create index on `hierarchy_node_id` for hierarchy staff lookups
 * - Bump schema_version from 1.8.0 to 1.9.0
 *
 * Schema Version: 1.8.0 → 1.9.0
 */

interface DrizzleDB {
  execute: (query: unknown) => Promise<unknown>
}

export async function up(db: DrizzleDB): Promise<void> {
  await db.execute(
    sql.raw(`
    -- Add hierarchy_node_id column to users table
    ALTER TABLE users
    ADD COLUMN hierarchy_node_id UUID REFERENCES hierarchy_nodes(id) ON DELETE CASCADE;
  `)
  )

  await db.execute(
    sql.raw(`
    -- Create index for hierarchy staff lookups
    CREATE INDEX idx_users_hierarchy_node_id
    ON users (hierarchy_node_id)
    WHERE hierarchy_node_id IS NOT NULL;
  `)
  )

  await db.execute(
    sql.raw(`
    -- Bump schema version
    UPDATE _schema_versions
    SET version = '1.9.0'
    WHERE name = 'schema_version'
  `)
  )
}

export async function down(): Promise<void> {
  // No rollback: use snapshot restore per ADR-0002
  // This migration is forward-only and irreversible via traditional rollback.
  throw new Error(
    'Reverse migration not supported. Use snapshot restore to rollback. ' +
      'See ADR-0002: Snapshot Immutability for Backward Compatibility.'
  )
}

export const meta: MigrationMeta = {
  name: '20260319_003_add_hierarchy_node_id_to_users',
}
