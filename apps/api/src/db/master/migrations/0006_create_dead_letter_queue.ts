import { sql } from 'drizzle-orm'
import type { MigrationConfig } from '../../migration-types'

/**
 * T010: Create Dead Letter Queue Table Migration
 *
 * Purpose: Create DLQ table for failed job tracking and recovery
 * Layer: Database (Master, stored per-workspace)
 * Transactional: Yes
 * Idempotent: Yes
 * Version Enforcement: Yes
 * License Middleware: Not applicable
 *
 * Constitutional Compliance:
 * ✓ Worker failure handling implemented (DLQ for permanent failures)
 * ✓ Audit trail supported (DLQ tracking and monitoring)
 * ✓ Structured logging ready
 * ✓ Tenant isolation maintained (workspace_id in table)
 */

export const migration: MigrationConfig = {
  name: '0006_create_dead_letter_queue',
  version: '1.1.0',
  description: 'Create dead_letter_queue table for failed job tracking and recovery',

  up: async (db, _schema, context) => {
    const correlationId = context?.correlationId || 'unknown'

    // T010: Create dead_letter_queue table
    await db.execute(
      sql`CREATE TABLE IF NOT EXISTS dead_letter_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL UNIQUE,
        job_type VARCHAR(255) NOT NULL,
        workspace_id UUID NOT NULL,
        workspace_slug VARCHAR(255) NOT NULL,
        attempt_id UUID,
        user_id UUID,
        correlation_id UUID NOT NULL,
        original_payload JSONB NOT NULL,
        error_message TEXT,
        error_stack TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        moved_to_dlq_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`
    )

    // Create indexes for efficient queries
    // Index on workspace_id + created_at (common filter + sort)
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_dlq_workspace_time 
          ON dead_letter_queue (workspace_id, moved_to_dlq_at DESC)`
    )

    // Index on job_type (filtering by job type)
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_dlq_job_type 
          ON dead_letter_queue (job_type, moved_to_dlq_at DESC)`
    )

    // Index on attempt_id (for attempt-specific DLQ lookups)
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_dlq_attempt_id 
          ON dead_letter_queue (attempt_id) WHERE attempt_id IS NOT NULL`
    )

    // Index for unresolved jobs (moved_to_dlq_at DESC but no resolution)
    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_dlq_unresolved 
          ON dead_letter_queue (moved_to_dlq_at DESC) 
          WHERE NOT EXISTS (
            SELECT 1 FROM dlq_resolutions WHERE dlq_resolutions.dlq_id = dead_letter_queue.id
          )`
    )

    // biome-ignore lint/suspicious/noConsole: migration runner output
    console.log(`[${correlationId}] Created dead_letter_queue table with indexes`)
  },

  down: async (db, _schema, context) => {
    const correlationId = context?.correlationId || 'unknown'

    await db.execute(sql`DROP TABLE IF EXISTS dead_letter_queue CASCADE`)

    // biome-ignore lint/suspicious/noConsole: migration runner output
    console.log(`[${correlationId}] Dropped dead_letter_queue table`)
  },
}
