import { sql } from 'drizzle-orm'
import type { MigrationConfig } from '../migration-types'

/**
 * T006: Create Index Migration for Attempt Idempotency Lookup
 *
 * Purpose: Create UNIQUE and covering indexes for efficient idempotency detection
 * Transactional: Yes
 * Idempotent: Yes
 * Version Enforcement: Yes
 * License Middleware: Not applicable
 *
 * Constitutional Compliance:
 * ✓ Idempotency mechanism enforced at DB level (UNIQUE constraint)
 * ✓ Performance optimized (covering indexes for common queries)
 * ✓ Attempt integrity protected
 */

export const migration: MigrationConfig = {
  name: '0009_add_idempotent_indexes',
  version: '1.1.0',
  description:
    'Create UNIQUE index for idempotency and covering index for cached results',

  up: async (db, schema, context) => {
    const correlationId = context?.correlationId || 'unknown'

    // T006: Create composite UNIQUE index on (id, idempotent_submission_key)
    // This enforces exactly one cached result per submission key
    await db.execute(
      sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_attempt_idempotent_key 
          ON attempts (id, idempotent_submission_key) 
          WHERE idempotent_submission_key IS NOT NULL`
    )

    // Create covering index for cached result lookups
    // Includes all columns needed for query without table access
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_attempt_cached_result 
          ON attempts (workspace_id, created_at DESC) 
          INCLUDE (submission_cached_result, submission_cached_at)
          WHERE submission_cached_at IS NOT NULL`
    )

    console.log(
      `[${correlationId}] Created idempotency indexes on attempts table`
    )
  },

  down: async (db, schema, context) => {
    const correlationId = context?.correlationId || 'unknown'

    await db.execute(
      sql`DROP INDEX IF EXISTS idx_attempt_idempotent_key CASCADE`
    )
    await db.execute(
      sql`DROP INDEX IF EXISTS idx_attempt_cached_result CASCADE`
    )

    console.log(
      `[${correlationId}] Dropped idempotency indexes from attempts table`
    )
  },
}
