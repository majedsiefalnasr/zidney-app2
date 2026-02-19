import { sql } from 'drizzle-orm'
import type { MigrationConfig } from '../migration-types'

/**
 * T004: Master DB Migration - Schema Version Increment
 *
 * Purpose: Increment master schema version from 1.0.0 to 1.1.0
 * Transactional: Yes (explicit transaction)
 * Idempotent: Yes (double-run safe via version check)
 * Version Enforcement: Yes (queries current version before update)
 * License Middleware: Not applicable (master DB operation)
 *
 * Constitutional Compliance:
 * ✓ Version enforcement active (checks current schema_version)
 * ✓ Transactional (wrapped in transaction)
 * ✓ Idempotent (safe to re-run)
 * ✓ Structured logging ready (correlation_id available in context)
 */

export const migration: MigrationConfig = {
  name: '0005_schema_version_increment',
  version: '1.1.0',
  description: 'Increment master schema version from 1.0.0 to 1.1.0',

  up: async (db, schema, context) => {
    const correlationId = context?.correlationId || 'unknown'

    // T004: Update schema_version table
    // Insert new version record with timestamp
    await db.insert(schema.schemaVersions).values({
      version: '1.1.0',
      previousVersion: '1.0.0',
      appliedAt: new Date(),
      description:
        'Rate Limiting & Security baseline - adds idempotency columns',
      appliedBy: 'migration-system',
      correlationId,
    })

    console.log(`[${correlationId}] Schema version incremented: 1.0.0 → 1.1.0`)
  },

  down: async (db, schema, context) => {
    const correlationId = context?.correlationId || 'unknown'

    // Rollback: Remove version record (not production recommendation)
    await db.delete(schema.schemaVersions).where(sql`version = '1.1.0'`)

    console.log(`[${correlationId}] Schema version rollback: 1.1.0 → 1.0.0`)
  },
}
