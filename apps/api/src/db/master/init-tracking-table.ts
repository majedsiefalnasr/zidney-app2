/**
 * Schema Migrations Tracking Table
 *
 * Purpose:
 * - Track which migrations have been applied
 * - Record execution time for performance monitoring
 * - Provide audit trail of schema changes
 *
 * File: apps/api/src/db/master/init-tracking-table.ts
 * Task: T005
 * Phase: 1 - Migration Infrastructure
 *
 * Note:
 * This must be executed BEFORE any other migrations.
 * Idempotent: Uses CREATE TABLE IF NOT EXISTS
 */

import type { PoolClient } from 'pg'

export const description = 'Initialize _schema_migrations tracking table'

/**
 * Create the schema migrations tracking table
 *
 * This function is idempotent:
 * - IF NOT EXISTS prevents errors if table already exists
 * - No harm in re-executing
 *
 * Table structure:
 * - id: Sequential ID (audit trail order)
 * - version: Migration version (e.g., 20250102001)
 * - description: Migration description
 * - applied_at: Timestamp migration was applied (server time)
 * - execution_time_ms: Duration of migration execution (for monitoring)
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(11) NOT NULL UNIQUE,
      description TEXT NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      execution_time_ms INTEGER NOT NULL DEFAULT 0,
      
      CONSTRAINT version_format CHECK (version ~ '^\\d{11}$')
    );

    COMMENT ON TABLE _schema_migrations IS 'Tracks applied master database migrations for idempotency and audit trail';
    COMMENT ON COLUMN _schema_migrations.version IS 'Migration version from filename (YYYYMMDD###)';
    COMMENT ON COLUMN _schema_migrations.applied_at IS 'Server timestamp when migration was applied (authoritative time source)';
    COMMENT ON COLUMN _schema_migrations.execution_time_ms IS 'Migration execution duration for performance monitoring';
  `)
}

export default { up, description }
