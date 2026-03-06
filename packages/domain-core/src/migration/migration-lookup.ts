/**
 * Migration lookup service
 * Query migration history and status
 */

import type { MigrationRegistryEntry } from '@zidney/types'
import type { Pool } from 'pg'

/**
 * Get migration history for workspace
 */
export async function getMigrationHistory(
  workspace_id: string,
  masterDb: Pool
): Promise<MigrationRegistryEntry[]> {
  const result = await masterDb.query(
    `SELECT * FROM migration_registry 
     WHERE workspace_id = $1
     ORDER BY applied_at DESC`,
    [workspace_id]
  )

  return result.rows.map((row: any) => ({
    id: row.id,
    workspace_id: row.workspace_id,
    migration_file: row.migration_file,
    target_schema_version: row.target_schema_version,
    checksum: row.checksum,
    applied_at: row.applied_at,
    execution_time_ms: row.execution_time_ms,
    status: row.status,
    error_message: row.error_message,
    operator_id: row.operator_id,
    snapshot_id: row.snapshot_id,
  }))
}

/**
 * Get latest migration for workspace
 */
export async function getLatestMigration(
  workspace_id: string,
  masterDb: Pool
): Promise<MigrationRegistryEntry | null> {
  const result = await masterDb.query(
    `SELECT * FROM migration_registry 
     WHERE workspace_id = $1
     ORDER BY applied_at DESC
     LIMIT 1`,
    [workspace_id]
  )

  return result.rows.length > 0 ? result.rows[0] : null
}

/**
 * Check if migration was already applied
 */
export async function isMigrationApplied(
  workspace_id: string,
  migrationFile: string,
  masterDb: Pool
): Promise<boolean> {
  const result = await masterDb.query(
    `SELECT status FROM migration_registry 
     WHERE workspace_id = $1 AND migration_file = $2`,
    [workspace_id, migrationFile]
  )

  return result.rows.length > 0 && result.rows[0].status === 'SUCCESS'
}

/**
 * Get upgrade job status
 * (Queries from job queue, not migration_registry)
 * Implementation depends on job queue system (Redis/RabbitMQ/etc)
 */
export interface UpgradeStatusSnapshot {
  upgradeId: string
  workspace_id: string
  status: 'QUEUED' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED'
  progress_percent: number
  current_migration?: string
  target_version: string
  current_version: string
  created_at: Date
  completed_at?: Date
  error?: {
    code: string
    message: string
  }
}

export async function getUpgradeStatus(
  upgradeId: string,
  jobQueue: any // Job queue dependency (type depends on queue implementation)
): Promise<UpgradeStatusSnapshot | null> {
  // Implementation depends on job queue system
  // This is a placeholder for the interface
  try {
    const job = await jobQueue.getJob(upgradeId)
    if (!job) return null

    return {
      upgradeId,
      workspace_id: job.data.workspace_id,
      status: job.progress ? job.progress.status : 'QUEUED',
      progress_percent: job.progress ? job.progress.percent : 0,
      current_migration: job.progress?.currentMigration,
      target_version: job.data.targetSchemaVersion,
      current_version: job.progress?.currentVersion || '1.0.0',
      created_at: job.createdAt,
      completed_at: job.finishedOn,
      error: job.failedReason
        ? {
            code: 'MIGRATION_FAILED',
            message: job.failedReason,
          }
        : undefined,
    }
  } catch (err: any) {
    return null
  }
}
