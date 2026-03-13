/**
 * Snapshot creation phase (Task 25)
 * Called before transaction, creates backup metadata
 */

import { createSnapshot } from '@zidney/domain-core/migration/snapshot-manager'
import { logger } from '@zidney/logger'
import type { Pool } from 'pg'
import type { SchemaMigrationJob } from './schema-migration-job'

/**
 * Execute snapshot creation phase
 * Pre-transaction phase - creates backup before migrations
 */
export async function executeSnapshotCreation(
  job: SchemaMigrationJob,
  masterDb: Pool,
  tenantDb: Pool
): Promise<string> {
  const { workspace_id, target_schema_version, correlation_id } = job

  try {
    // Get current tenant version
    const versionResult = await tenantDb.query(
      `SELECT version FROM schema_version 
       WHERE id = '00000000-0000-0000-0000-000000000001'::uuid`
    )

    const currentVersion = versionResult.rows[0]?.version || '1.0.0'

    // Create snapshot
    const snapshot = await createSnapshot(masterDb, {
      workspace_id,
      previousSchemaVersion: currentVersion,
      targetSchemaVersion: target_schema_version,
    })

    logger.info('snapshot_creation_phase_completed', {
      service: 'worker-upgrade',
      correlation_id,
      workspace_id,
      snapshot_id: snapshot.id,
      location: snapshot.snapshot_location,
    })

    return snapshot.id
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    logger.error('snapshot_creation_phase_failed', {
      service: 'worker-upgrade',
      correlation_id,
      workspace_id,
      error_code: 'SNAPSHOT_CREATION_FAILED',
      error_message: errorMessage,
    })

    throw err
  }
}
