import { execSync } from 'node:child_process'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { logger } from '@zidney/logger'

export interface ArchiveSnapshotJobPayload {
  type: 'ARCHIVE_SNAPSHOT'
  license_id: string
  workspace_id: string
  snapshot_timestamp: string
}

export interface ArchiveSnapshotResult {
  success: boolean
  snapshot_location?: string
  snapshot_id?: string
  error?: string
}

/**
 * Archive Snapshot Worker Job
 *
 * Executes: pg_dump of tenant database → upload to S3 → update license record
 * Idempotency: Dedup within 1-hour window (check recent snapshots before dump)
 * Retry: 3x exponential backoff (1s, 5s, 30s)
 *
 * @param payload Job payload with license_id, workspace_id, timestamp
 * @returns Result with snapshot_location or error
 */
export async function archiveSnapshotJob(
  payload: ArchiveSnapshotJobPayload
): Promise<ArchiveSnapshotResult> {
  const startTime = Date.now()
  const { license_id, workspace_id, snapshot_timestamp } = payload

  try {
    const masterDb = await getMasterDbConnection()
    await getTenantDbConnection(workspace_id)

    // Step 1: Verify license status is ARCHIVED
    const licenseResult = await masterDb.query('SELECT * FROM licenses WHERE id = $1 LIMIT 1', [
      license_id,
    ])

    if (!licenseResult.rows.length) {
      logger.error(
        {
          action: 'archive_snapshot_license_not_found',
          license_id,
          error_code: 'LICENSE_NOT_FOUND',
        },
        'Archive snapshot job: license not found'
      )
      return { success: false, error: 'License not found' }
    }

    const license = licenseResult.rows[0]

    if (license.status !== 'ARCHIVED') {
      logger.warn(
        {
          action: 'archive_snapshot_not_archived',
          license_id,
          license_status: license.status,
        },
        'Archive snapshot job: license not in ARCHIVED state (will retry)'
      )
      throw new Error(`License not in ARCHIVED state; current status: ${license.status}`)
    }

    // Step 2: Check idempotency - recent snapshot within 1 hour?
    const recentSnapshotResult = await masterDb.query(
      `SELECT id, snapshot_location FROM archive_snapshots
       WHERE license_id = $1 AND created_at > NOW() - INTERVAL '1 hour'
       ORDER BY created_at DESC LIMIT 1`,
      [license_id]
    )

    if (recentSnapshotResult.rows.length) {
      const recentSnapshot = recentSnapshotResult.rows[0]
      logger.info(
        {
          action: 'archive_snapshot_dedup',
          license_id,
          recent_snapshot_id: recentSnapshot.id,
          location: recentSnapshot.snapshot_location,
          duration_ms: Date.now() - startTime,
        },
        'Archive snapshot job: recent snapshot exists within 1 hour (dedup)'
      )

      return {
        success: true,
        snapshot_location: recentSnapshot.snapshot_location,
        snapshot_id: recentSnapshot.id,
      }
    }

    // Step 3: Execute pg_dump
    logger.debug({ action: 'archive_snapshot_dump_start', license_id }, 'Starting pg_dump')

    const tenantDbName = `tenant-${workspace_id}`
    const dumpTimestamp = snapshot_timestamp.replace(/[:.]/g, '-')
    const localDumpPath = `/tmp/snapshot-${license_id}-${dumpTimestamp}.sql`

    try {
      execSync(
        `pg_dump --format=plain --no-privileges --no-password ${tenantDbName} > ${localDumpPath}`,
        { timeout: 300000 } // 5 minutes
      )
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(
        {
          action: 'archive_snapshot_dump_error',
          license_id,
          error_message: errMsg,
        },
        'pg_dump failed'
      )
      throw error
    }

    // Step 4: Upload to S3
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
    })
    const s3Key = `archive-snapshots/${license_id}/${dumpTimestamp}.sql`
    const s3Bucket = process.env.ARCHIVE_SNAPSHOTS_BUCKET || 'zidney-archive-snapshots'

    logger.debug({ action: 'archive_snapshot_upload_start', s3_key: s3Key }, 'Starting S3 upload')

    try {
      const uploadCommand = new PutObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
        Body: require('node:fs').readFileSync(localDumpPath),
        ContentType: 'application/sql',
        Metadata: {
          'license-id': license_id,
          'workspace-id': workspace_id,
          'snapshot-timestamp': snapshot_timestamp,
        },
      })

      await s3Client.send(uploadCommand)
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(
        {
          action: 'archive_snapshot_upload_error',
          license_id,
          s3_bucket: s3Bucket,
          error_message: errMsg,
        },
        'S3 upload failed'
      )
      throw error
    } finally {
      // Clean up local dump file
      try {
        require('node:fs').unlinkSync(localDumpPath)
      } catch (_e) {
        logger.warn(
          {
            action: 'archive_snapshot_cleanup_error',
            local_path: localDumpPath,
          },
          'Failed to clean up local dump file'
        )
      }
    }

    // Step 5: Update license in transaction
    const client = await masterDb.connect()
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

      const s3Url = `s3://${s3Bucket}/${s3Key}`

      // Insert archive snapshot record
      const snapshotResult = await client.query(
        `INSERT INTO archive_snapshots (license_id, snapshot_location, snapshot_timestamp, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id`,
        [license_id, s3Url, snapshot_timestamp]
      )

      const snapshot_id = snapshotResult.rows[0].id

      // Update license with snapshot_id
      await client.query('UPDATE licenses SET snapshot_id = $1, updated_at = NOW() WHERE id = $2', [
        snapshot_id,
        license_id,
      ])

      await client.query('COMMIT')

      const duration_ms = Date.now() - startTime

      logger.info(
        {
          action: 'archive_snapshot_completed',
          license_id,
          snapshot_id,
          snapshot_location: s3Url,
          duration_ms,
        },
        'Archive snapshot completed successfully'
      )

      return {
        success: true,
        snapshot_location: s3Url,
        snapshot_id,
      }
    } catch (error: unknown) {
      await client.query('ROLLBACK').catch(() => {})
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(
        {
          action: 'archive_snapshot_transaction_error',
          license_id,
          error_message: errMsg,
        },
        'Archive snapshot transaction failed'
      )
      throw error
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    logger.error(
      {
        action: 'archive_snapshot_job_error',
        license_id,
        workspace_id,
        error_message: errMsg,
        duration_ms: Date.now() - startTime,
      },
      'Archive snapshot job failed'
    )

    throw error // Re-throw for retry mechanism
  }
}

/**
 * Get master database connection
 * (Mocked for example; replace with actual DB pool)
 */
async function getMasterDbConnection() {
  // In production, return connection from master pool
  return require('../../db/master-pool').pool
}

/**
 * Get tenant database connection by workspace_id
 * (Mocked for example; replace with actual DB resolution)
 */
async function getTenantDbConnection(workspace_id: string) {
  // In production, resolve workspace → tenant DB and get connection
  return require('../../db/tenant-pools').getTenantPool(workspace_id)
}
