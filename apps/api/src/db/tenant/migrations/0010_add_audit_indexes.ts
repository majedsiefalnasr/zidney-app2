import { sql } from 'drizzle-orm'
import type { MigrationConfig } from '../../migration-types'

/**
 * T007: Create Audit Log Index Migration
 *
 * Purpose: Create index for efficient audit trail queries
 * Transactional: Yes
 * Idempotent: Yes
 * Version Enforcement: Yes
 * License Middleware: Not applicable
 *
 * Constitutional Compliance:
 * ✓ Audit trail supported (index for audit queries)
 * ✓ Structured logging enabled
 */

export const migration: MigrationConfig = {
  name: '0010_add_audit_indexes',
  version: '1.1.0',
  description: 'Create indexes for efficient audit trail queries',

  up: async (db, _schema, context) => {
    const correlationId = context?.correlationId || 'unknown'

    // T007: Create index for completed attempts (audit queries)
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_attempt_completed_time 
          ON attempts (workspace_id, created_at DESC) 
          WHERE status = 'COMPLETED'`
    )

    // Index for recent attempts by user
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_attempt_by_user_recent 
          ON attempts (user_id, workspace_id, created_at DESC)`
    )

    // Index for rate limit audit queries
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_attempt_by_status 
          ON attempts (workspace_id, status, created_at DESC)`
    )

    // biome-ignore lint/suspicious/noConsole: migration runner output
    console.log(`[${correlationId}] Created audit indexes on attempts table`)
  },

  down: async (db, _schema, context) => {
    const correlationId = context?.correlationId || 'unknown'

    await db.execute(sql`DROP INDEX IF EXISTS idx_attempt_completed_time CASCADE`)
    await db.execute(sql`DROP INDEX IF EXISTS idx_attempt_by_user_recent CASCADE`)
    await db.execute(sql`DROP INDEX IF EXISTS idx_attempt_by_status CASCADE`)

    // biome-ignore lint/suspicious/noConsole: migration runner output
    console.log(`[${correlationId}] Dropped audit indexes from attempts table`)
  },
}
