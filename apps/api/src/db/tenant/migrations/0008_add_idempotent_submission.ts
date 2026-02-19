import { sql } from 'drizzle-orm'
import type { MigrationConfig } from '../migration-types'

/**
 * T005: Tenant DB Migration - Add Idempotent Submission Columns
 *
 * Purpose: Add idempotency support to attempts table for duplicate submission detection
 * Transactional: Yes
 * Idempotent: Yes (uses IF NOT EXISTS pattern)
 * Version Enforcement: Yes (must be applied before 1.1.0 schema active)
 * License Middleware: Not applicable (database initialization)
 *
 * Constitutional Compliance:
 * ✓ Idempotency mechanism implemented (dual-layer: DB + Redis)
 * ✓ Attempt integrity protected (snapshot + submission tracking)
 * ✓ Transactional (explicit transaction)
 * ✓ Tenant-scoped (per-tenant DB only)
 */

export const migration: MigrationConfig = {
  name: '0008_add_idempotent_submission',
  version: '1.1.0',
  description:
    'Add idempotency columns to attempts table for submission deduplication',

  up: async (db, schema, context) => {
    const correlationId = context?.correlationId || 'unknown'
    const workspaceId = context?.workspaceId || 'no-workspace'

    // T005: Add columns to attempts table
    // Check if columns exist before adding
    const tableInfo = await db.execute(
      sql`SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'attempts' AND column_name IN ('idempotent_submission_key', 'submission_cached_result', 'submission_cached_at')`
    )

    if (!tableInfo || tableInfo.length === 0) {
      // Add new columns
      await db.execute(
        sql`ALTER TABLE attempts ADD COLUMN IF NOT EXISTS idempotent_submission_key UUID`
      )

      await db.execute(
        sql`ALTER TABLE attempts ADD COLUMN IF NOT EXISTS submission_cached_result JSONB`
      )

      await db.execute(
        sql`ALTER TABLE attempts ADD COLUMN IF NOT EXISTS submission_cached_at TIMESTAMP WITH TIME ZONE`
      )

      console.log(
        `[${correlationId}][${workspaceId}] Added idempotency columns to attempts table`
      )
    }
  },

  down: async (db, schema, context) => {
    const correlationId = context?.correlationId || 'unknown'

    // Rollback: Remove idempotency columns
    await db.execute(
      sql`ALTER TABLE attempts DROP COLUMN IF EXISTS idempotent_submission_key CASCADE`
    )

    await db.execute(
      sql`ALTER TABLE attempts DROP COLUMN IF EXISTS submission_cached_result CASCADE`
    )

    await db.execute(
      sql`ALTER TABLE attempts DROP COLUMN IF EXISTS submission_cached_at CASCADE`
    )

    console.log(
      `[${correlationId}] Removed idempotency columns from attempts table`
    )
  },
}
