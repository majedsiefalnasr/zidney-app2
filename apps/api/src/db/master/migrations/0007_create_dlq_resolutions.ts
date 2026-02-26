import { sql } from 'drizzle-orm'
import type { MigrationConfig } from '../../migration-types'

/**
 * T011: Create DLQ Resolutions Audit Table Migration
 *
 * Purpose: Track DLQ job resolutions (retry, discard, manual action)
 * Layer: Database (Master)
 * Transactional: Yes
 * Idempotent: Yes
 * Version Enforcement: Yes
 * License Middleware: Not applicable
 *
 * Constitutional Compliance:
 * ✓ Audit trail fully implemented (DLQ resolutions tracked)
 * ✓ Worker recovery supported (manual admin actions)
 * ✓ Structured logging ready
 */

export const migration: MigrationConfig = {
  name: '0007_create_dlq_resolutions',
  version: '1.1.0',
  description: 'Create dlq_resolutions table for DLQ job resolution tracking',

  up: async (db, _schema, context) => {
    const correlationId = context?.correlationId || 'unknown'

    // T011: Create dlq_resolutions table
    await db.execute(
      sql`CREATE TABLE IF NOT EXISTS dlq_resolutions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        dlq_id UUID NOT NULL REFERENCES dead_letter_queue(id) ON DELETE CASCADE,
        resolved_by UUID NOT NULL,
        resolution_action VARCHAR(50) NOT NULL CHECK (
          resolution_action IN ('RETRY', 'DISCARD', 'AUTO_RETRY', 'MANUAL_FIX', 'ESCALATE')
        ),
        notes TEXT,
        resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(dlq_id, resolved_at)
      )`
    )

    // Index for resolution lookups by DLQ ID
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_dlq_resolution_by_dlq 
          ON dlq_resolutions (dlq_id)`
    )

    // Index for resolution lookups by resolved_by user
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_dlq_resolution_by_user 
          ON dlq_resolutions (resolved_by, resolved_at DESC)`
    )

    // Index for resolution type queries
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_dlq_resolution_action 
          ON dlq_resolutions (resolution_action, resolved_at DESC)`
    )

    console.log(`[${correlationId}] Created dlq_resolutions table with indexes`)
  },

  down: async (db, _schema, context) => {
    const correlationId = context?.correlationId || 'unknown'

    await db.execute(sql`DROP TABLE IF EXISTS dlq_resolutions CASCADE`)

    console.log(`[${correlationId}] Dropped dlq_resolutions table`)
  },
}
