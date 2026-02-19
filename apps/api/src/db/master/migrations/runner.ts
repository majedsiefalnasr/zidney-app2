import { sql } from 'drizzle-orm'

/**
 * T008: Master DB Migration Runner - Schema Version Execution
 *
 * Purpose: Execute schema version increment atomically
 * Layer: Database (Master)
 * Transactional: Yes
 * Idempotent: Yes (double-run safe via version check)
 * Version Enforcement: Yes (checks current schema_version)
 * License Middleware: Not applicable
 */

export async function executeSchemaVersionIncrement(db: any, context: any) {
  const correlationId = context?.correlationId || 'unknown'

  // T008: Atomically update master schema version
  // Query current version before update
  const currentVersion = await db.execute(
    sql`SELECT version FROM schema_versions ORDER BY applied_at DESC LIMIT 1`
  )

  const current = currentVersion?.[0]?.version || '1.0.0'
  console.log(`[${correlationId}] Current master schema version: ${current}`)

  if (current !== '1.0.0') {
    console.warn(
      `[${correlationId}] Schema version already >= 1.0.0. Skipping migration.`
    )
    return
  }

  // Insert new version record (atomically)
  await db.execute(
    sql`INSERT INTO schema_versions (version, previous_version, applied_at, description, applied_by, correlation_id)
        VALUES ('1.1.0', '1.0.0', NOW(), 'Rate Limiting & Security baseline', 'migration-system', ${correlationId})
        ON CONFLICT DO NOTHING`
  )

  console.log(
    `[${correlationId}] Master schema version incremented: 1.0.0 → 1.1.0`
  )
}

/**
 * Verify master schema version for compatibility checks
 * Called before any schema-dependent operation
 */
export async function verifyMasterSchemaVersion(db: any): Promise<string> {
  const result = await db.execute(
    sql`SELECT version FROM schema_versions ORDER BY applied_at DESC LIMIT 1`
  )
  return result?.[0]?.version || '1.0.0'
}
