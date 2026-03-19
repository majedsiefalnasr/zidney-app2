/**
 * Tenant Database Migration — Hierarchy Nodes
 *
 * File: apps/api/src/db/tenant/migrations/20260319_002_hierarchy_nodes.ts
 * Stage: STAGE_25_HIERARCHY_TREE
 * Date: 2026-03-19
 *
 * Purpose:
 * 1. CREATE hierarchy_nodes table
 * 2. CREATE traversal and status indexes
 * 3. CREATE partial unique indexes for root and sibling name scopes
 * 4. UPDATE schema_version 1.7.0 → 1.8.0
 */

import type { PoolClient } from 'pg'

export const description =
  'Create hierarchy_nodes table with traversal indexes and scoped unique indexes; ' +
  'bump schema_version 1.7.0 → 1.8.0'

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS hierarchy_nodes (
        id          UUID         NOT NULL DEFAULT gen_random_uuid(),
        name        VARCHAR(255) NOT NULL,
        parent_id   UUID,
        description TEXT,
        status      VARCHAR(20)  NOT NULL DEFAULT 'ENABLED'
                      CONSTRAINT hierarchy_nodes_status_check
                        CHECK (status IN ('ENABLED', 'DISABLED')),
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

        CONSTRAINT hierarchy_nodes_pkey
          PRIMARY KEY (id),
        CONSTRAINT hierarchy_nodes_parent_id_fkey
          FOREIGN KEY (parent_id)
            REFERENCES hierarchy_nodes(id) ON DELETE RESTRICT,
        CONSTRAINT hierarchy_nodes_no_self_ref
          CHECK (parent_id IS NULL OR parent_id <> id)
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hierarchy_nodes_parent_id
        ON hierarchy_nodes (parent_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hierarchy_nodes_status
        ON hierarchy_nodes (status)
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS hierarchy_nodes_parent_name_unique
        ON hierarchy_nodes (parent_id, LOWER(name))
        WHERE parent_id IS NOT NULL
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS hierarchy_nodes_root_name_unique
        ON hierarchy_nodes (LOWER(name))
        WHERE parent_id IS NULL
    `)

    await client.query(`
      UPDATE schema_version
         SET version = '1.8.0',
             applied_at = NOW()
       WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

export async function down(_client: PoolClient): Promise<void> {
  throw new Error(
    'STAGE_25_HIERARCHY_TREE migration is forward-only. ' +
      'Rollback must be performed via database snapshot restore.'
  )
}
