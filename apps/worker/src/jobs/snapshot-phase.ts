/**
 * Snapshot creation phase (Task 25)
 * Called before transaction, creates backup metadata
 */

import { createSnapshot } from '@zidney/domain-core/migration/snapshot-manager'
import type { Pool } from 'pg'
import { SchemaMigrationJob } from './schema-migration-job'

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

    console.log(
      JSON.stringify({
        level: 'INFO',
        service: 'worker-upgrade',
        event: 'snapshot_creation_phase_completed',
        correlation_id,
        workspace_id,
        snapshot_id: snapshot.id,
        location: snapshot.snapshot_location,
        timestamp: new Date().toISOString(),
      })
    )

    return snapshot.id
  } catch (err: any) {
    console.log(
      JSON.stringify({
        level: 'ERROR',
        service: 'worker-upgrade',
        event: 'snapshot_creation_phase_failed',
        correlation_id,
        workspace_id,
        error_code: err.errorCode || 'SNAPSHOT_CREATION_FAILED',
        error_message: err.message,
        timestamp: new Date().toISOString(),
      })
    )

    throw err
  }
}
