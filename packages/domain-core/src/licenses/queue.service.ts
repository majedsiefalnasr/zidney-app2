/**
 * Queue Service for License Provisioning Jobs
 *
 * File: packages/domain-core/src/licenses/queue.service.ts
 * Task: T054, T055, T056, T057, T058
 *
 * Manages job enqueueing for:
 * - Provisioning (create database, seed data)
 * - Snapshot (archive - database backup)
 * - Restore (unarchive - database recovery)
 * - Database drop (delete - permanent removal)
 */

import type { Logger } from '@zidney/logger'

export interface Job {
  id?: string
  data: Record<string, unknown>
  opts?: {
    attempts?: number
    backoff?: {
      type: 'exponential' | 'fixed'
      delay: number
    }
    timeout?: number
  }
}

export interface QueueImpl {
  add(name: string, data: Record<string, unknown>, opts?: Record<string, unknown>): Promise<Job>
  process(name: string, handler: (job: Job) => Promise<void>): Promise<void>
}

/**
 * Queue Service wrapper around Bull or similar job queue implementation
 */
export class QueueService {
  constructor(
    private provisioningQueue: QueueImpl,
    private snapshotQueue: QueueImpl,
    private restoreQueue: QueueImpl,
    private dropQueue: QueueImpl,
    private logger: Logger
  ) {}

  /**
   * T055: Enqueue provisioning job
   *
   * Creates async job to provision tenant database for new license.
   * Called from LicenseService.create()
   */
  async enqueueProvisioningJob(payload: Record<string, unknown>): Promise<void> {
    try {
      const job = await this.provisioningQueue.add('provisioning:license', payload, {
        attempts: 6, // 1 initial + 5 retries
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s base, exponential multiplier
        },
        timeout: 1800000, // 30 minutes
        removeOnComplete: false, // Keep history
      })

      this.logger.info({
        event: 'provisioning_job_enqueued',
        job_id: job.id,
        license_id: payload.license_id,
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error({
        event: 'provisioning_job_enqueue_failed',
        error_message: msg,
        license_id: payload.license_id,
      })
      throw error
    }
  }

  /**
   * T056: Enqueue snapshot job (stub)
   *
   * Creates async job to snapshot tenant database for archival.
   * Full implementation deferred to Stage 12.
   */
  async enqueueSnapshotJob(license_id: string, workspace_slug: string): Promise<void> {
    try {
      const job = await this.snapshotQueue.add('snapshot:license', {
        license_id,
        workspace_slug,
        snapshot_type: 'archive',
      })

      this.logger.info({
        event: 'snapshot_job_enqueued',
        job_id: job.id,
        license_id,
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error({
        event: 'snapshot_job_enqueue_failed',
        error_message: msg,
        license_id,
      })
      throw error
    }
  }

  /**
   * T057: Enqueue restore job (stub)
   *
   * Creates async job to restore tenant database from snapshot.
   * Full implementation deferred to Stage 12.
   */
  async enqueueRestoreJob(license_id: string, workspace_slug: string): Promise<void> {
    try {
      const job = await this.restoreQueue.add('restore:license', {
        license_id,
        workspace_slug,
      })

      this.logger.info({
        event: 'restore_job_enqueued',
        job_id: job.id,
        license_id,
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error({
        event: 'restore_job_enqueue_failed',
        error_message: msg,
        license_id,
      })
      throw error
    }
  }

  /**
   * T058: Enqueue database drop job (stub)
   *
   * Creates async job to permanently drop tenant database.
   * Full implementation deferred to Stage 12.
   */
  async enqueueDatabaseDropJob(license_id: string, workspace_slug: string): Promise<void> {
    try {
      const job = await this.dropQueue.add('database-drop:license', {
        license_id,
        workspace_slug,
      })

      this.logger.info({
        event: 'database_drop_job_enqueued',
        job_id: job.id,
        license_id,
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      this.logger.error({
        event: 'database_drop_job_enqueue_failed',
        error_message: msg,
        license_id,
      })
      throw error
    }
  }
}
