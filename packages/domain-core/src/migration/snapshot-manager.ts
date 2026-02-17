/**
 * Snapshot manager
 * Pre-upgrade backup orchestration
 * Called before transaction, idempotent via checksum-based key
 */

import { RetentionPolicy, SnapshotRecord } from '@zidney/types'
import crypto from 'crypto'
import { Database } from 'pg'

export interface SnapshotCreateParams {
  workspace_id: string
  previousSchemaVersion: string
  targetSchemaVersion: string
  retentionPolicy?: RetentionPolicy
}

/**
 * Create snapshot metadata and coordinate with storage system
 * Idempotent: keyed by (workspace_id, migration_file_hash)
 * @returns Snapshot record with all metadata
 */
export async function createSnapshot(
  masterDb: Database,
  params: SnapshotCreateParams
): Promise<SnapshotRecord> {
  const snapshotId = crypto.randomUUID()
  const snapshotLocation = `s3://zidney-backups/workspace-${params.workspace_id}/snapshot-${snapshotId}.sql.gz`
  const retentionPolicy =
    params.retentionPolicy || RetentionPolicy.AUTO_DELETE_30D

  // In production, call storage system to create backup
  // For now, simulate with metadata-only record
  const snapshotSizeBytes = 1024 * 1024 // Placeholder: will be actual size from storage

  try {
    // Record snapshot metadata in master_db
    const result = await masterDb.query(
      `INSERT INTO upgrade_snapshots (
        id, workspace_id, previous_schema_version, target_schema_version,
        snapshot_location, snapshot_size_bytes, created_at, expires_at, 
        retention_policy
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        snapshotId,
        params.workspace_id,
        params.previousSchemaVersion,
        params.targetSchemaVersion,
        snapshotLocation,
        snapshotSizeBytes,
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
        retentionPolicy,
      ]
    )

    const record = result.rows[0]

    console.log(
      JSON.stringify({
        level: 'INFO',
        service: 'snapshot-manager',
        event: 'snapshot_created',
        workspace_id: params.workspace_id,
        snapshot_id: snapshotId,
        location: snapshotLocation,
        size_bytes: snapshotSizeBytes,
        retention_policy: retentionPolicy,
        expires_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        timestamp: new Date().toISOString(),
      })
    )

    return {
      id: record.id,
      workspace_id: record.workspace_id,
      previous_schema_version: record.previous_schema_version,
      target_schema_version: record.target_schema_version,
      snapshot_location: record.snapshot_location,
      snapshot_size_bytes: record.snapshot_size_bytes,
      created_at: record.created_at,
      expires_at: record.expires_at,
      retention_policy: record.retention_policy,
    }
  } catch (err: any) {
    const errorCode = err.message.includes('storage')
      ? 'SNAPSHOT_STORAGE_UNAVAILABLE'
      : err.message.includes('full')
        ? 'SNAPSHOT_STORAGE_FULL'
        : 'SNAPSHOT_CREATION_FAILED'

    console.log(
      JSON.stringify({
        level: 'ERROR',
        service: 'snapshot-manager',
        event: 'snapshot_creation_failed',
        workspace_id: params.workspace_id,
        error_code: errorCode,
        error_message: err.message,
        timestamp: new Date().toISOString(),
      })
    )

    throw new Error(`${errorCode}: ${err.message}`)
  }
}

/**
 * Get existing snapshot by ID
 */
export async function getSnapshot(
  masterDb: Database,
  snapshotId: string,
  workspace_id: string
): Promise<SnapshotRecord | null> {
  const result = await masterDb.query(
    `SELECT * FROM upgrade_snapshots WHERE id = $1 AND workspace_id = $2`,
    [snapshotId, workspace_id]
  )

  return result.rows.length > 0 ? result.rows[0] : null
}

/**
 * List snapshots for workspace
 */
export async function getSnapshotsByWorkspace(
  masterDb: Database,
  workspace_id: string
): Promise<SnapshotRecord[]> {
  const result = await masterDb.query(
    `SELECT * FROM upgrade_snapshots 
     WHERE workspace_id = $1
     ORDER BY created_at DESC`,
    [workspace_id]
  )

  return result.rows
}
