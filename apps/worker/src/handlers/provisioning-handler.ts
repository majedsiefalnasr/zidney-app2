/**
 * Provisioning Job Handler
 *
 * File: apps/worker/src/handlers/provisioning-handler.ts
 * License Job: ProvisioningJob → License Provisioning Task
 *
 * Responsibility:
 * - Dequeue provisioning jobs from Redis queue
 * - Execute provisioning pipeline (create DB, run migrations, seed data)
 * - Update license status (PENDING_PROVISION → ACTIVE or PROVISION_FAILED)
 * - Handle retries with exponential backoff (5 retries max)
 * - Move failed jobs to DLQ after max retries
 *
 * Transaction Model:
 * - BEGIN: License SELECT FOR UPDATE (prevent concurrent provisions)
 * - EXECUTE: Provisioning pipeline (create DB, migrations, seeding)
 * - COMMIT: Set license status = ACTIVE (atomic with license row update)
 * - ROLLBACK: On any error; set license status = PROVISION_FAILED
 *
 * Idempotency:
 * - Job ID uniqueness prevents duplicate provisions
 * - Database existence check prevents re-creation
 * - Idempotent migrations via schema_version tracking
 */

import { createLogger } from '@zidney/logger'
import type { Redis } from 'ioredis'
import type { Pool } from 'pg'
import type ProvisioningJob from '../jobs/provisioning/ProvisioningJob'
import type { IJobQueue } from '../jobs/provisioning/ProvisioningJob'
import { BaselineSeeder } from '../services/provisioning/BaselineSeeder'
import { CheckpointManager } from '../services/provisioning/CheckpointManager'
import { DistributedLock } from '../services/provisioning/DistributedLock'
import { JobQueue } from '../services/provisioning/JobQueue'
import { MigrationExecutor } from '../services/provisioning/MigrationExecutor'
import { ProvisioningOrchestrator } from '../services/provisioning/ProvisioningOrchestrator'

const logger = createLogger('ProvisioningHandler')

interface ProvisioningHandlerConfig {
  master_pool: Pool
  tenant_pool_factory: (workspace_slug: string) => Pool
  redis: Redis
  max_retries: number
  retry_backoff_base_ms: number
}

/**
 * ProvisioningHandler: Main entry point for processing provisioning jobs
 *
 * Handles job dequeue, retry logic, idempotency, and status updates.
 */
export class ProvisioningHandler {
  private master_pool: Pool
  private redis: Redis
  private job_queue: IJobQueue
  private orchestrator: ProvisioningOrchestrator
  private retry_backoff_base_ms: number

  constructor(config: ProvisioningHandlerConfig) {
    this.master_pool = config.master_pool
    this.redis = config.redis
    this.job_queue = new JobQueue(config.redis)
    const distributed_lock = new DistributedLock(config.redis)
    const migration_executor = new MigrationExecutor()
    const baseline_seeder = new BaselineSeeder()
    const checkpoint_manager = new CheckpointManager()
    this.orchestrator = new ProvisioningOrchestrator(
      config.master_pool,
      distributed_lock,
      migration_executor,
      baseline_seeder,
      checkpoint_manager
    )
    this.retry_backoff_base_ms = config.retry_backoff_base_ms
  }

  /**
   * Process single provisioning job
   *
   * Workflow:
   * 1. Acquire job from queue
   * 2. Check idempotency (job_id deduplication)
   * 3. Execute provisioning pipeline
   * 4. Update license status based on result
   * 5. Ack job or nack with retry
   */
  async processJob(): Promise<void> {
    let job: ProvisioningJob | null = null

    try {
      // Step 1: Dequeue job (blocking, 30s timeout)
      job = await this.job_queue.dequeue(30)

      if (!job) {
        // Queue empty, not an error
        logger.debug('Jobs queue empty, polling...')
        return
      }

      logger.info(
        {
          job_id: job.id,
          license_id: job.license_id,
          workspace_slug: job.workspace_slug,
          attempt: job.attempt,
          max_attempts: job.max_attempts,
        },
        'Provisioning job dequeued'
      )

      // Step 2: Check idempotency (prevent duplicate provisions)
      const isDuplicate = await this.checkIdempotency(job)
      if (isDuplicate) {
        logger.warn(
          {
            job_id: job.id,
            license_id: job.license_id,
            workspace_slug: job.workspace_slug,
          },
          'Job already provisioned (idempotent), acking'
        )
        await this.job_queue.ack(job.id)
        return
      }

      // Step 3: Execute provisioning pipeline
      const result = await this.orchestrator.provision(job)

      if (result.success) {
        // Step 4a: Success → Update license to ACTIVE + Ack
        await this.updateLicenseStatus(job.license_id, 'ACTIVE', null, {
          correlation_id: job.correlation_id,
          job_id: job.id,
          provisioning_duration_ms: result.duration_ms,
        })
        await this.recordIdempotency(job)

        logger.info(
          {
            job_id: job.id,
            license_id: job.license_id,
            workspace_slug: job.workspace_slug,
            duration_ms: result.duration_ms,
          },
          'Provisioning job completed successfully'
        )

        await this.job_queue.ack(job.id)
      } else {
        // Step 4b: Failure → Check retries
        if (job.isRetryable()) {
          // Retry logic: exponential backoff
          const nextJob = job.markAttempt()
          const backoff = this.calculateBackoff(nextJob.attempt)

          logger.warn(
            {
              job_id: job.id,
              license_id: job.license_id,
              workspace_slug: job.workspace_slug,
              attempt: job.attempt,
              next_attempt: nextJob.attempt,
              error: result.error,
              backoff_ms: backoff,
            },
            'Provisioning job failed, scheduling retry'
          )

          // Nack job with retry backoff
          await this.job_queue.nack(job.id, nextJob)

          // Update license to include retry information
          await this.updateLicenseStatus(job.license_id, 'PENDING_PROVISION', null, {
            correlation_id: job.correlation_id,
            job_id: job.id,
            error: result.error,
            attempt: nextJob.attempt,
            next_retry_ms: backoff,
          })
        } else {
          // Max retries exceeded → Move to DLQ + Mark as PROVISION_FAILED
          logger.error(
            {
              job_id: job.id,
              license_id: job.license_id,
              workspace_slug: job.workspace_slug,
              attempts: job.max_attempts,
              last_error: result.error,
            },
            'Provisioning job exhausted retries, moving to DLQ'
          )

          await this.job_queue.moveToDLQ(job.id, job)

          // Update license to PROVISION_FAILED
          await this.updateLicenseStatus(job.license_id, 'PROVISION_FAILED', result.error ?? null, {
            correlation_id: job.correlation_id,
            job_id: job.id,
          })
        }
      }
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          job_id: job?.id,
          license_id: job?.license_id,
        },
        'Provisioning handler error'
      )

      // On handler crash, nack job for retry
      if (job?.isRetryable()) {
        const nextJob = job.markAttempt()
        await this.job_queue.nack(job.id, nextJob)
      }

      throw error
    }
  }

  /**
   * Check if job was already processed (idempotency)
   *
   * Uses Redis key: `provisioning:idempotency:{job_id}`
   * TTL: 24 hours (after 24h, job can be re-provisioned if needed)
   */
  private async checkIdempotency(job: ProvisioningJob): Promise<boolean> {
    const key = `provisioning:idempotency:${job.id}`
    const cached = await this.redis.get(key)

    if (cached) {
      return JSON.parse(cached).processed === true
    }

    return false
  }

  /**
   * Record job completion for idempotency
   */
  private async recordIdempotency(job: ProvisioningJob): Promise<void> {
    const key = `provisioning:idempotency:${job.id}`
    const value = JSON.stringify({
      job_id: job.id,
      license_id: job.license_id,
      workspace_slug: job.workspace_slug,
      processed: true,
      timestamp: new Date().toISOString(),
    })

    // TTL: 24 hours
    await this.redis.setex(key, 86400, value)
  }

  /**
   * Calculate exponential backoff with jitter
   *
   * Formula: min(2^attempt * base_ms * (1 + random(0-20%)), 60000ms)
   * Results for base_ms=2s:
   * - Attempt 1: ~2s
   * - Attempt 2: ~4s
   * - Attempt 3: ~8s
   * - Attempt 4: ~16s
   * - Attempt 5: ~32s
   */
  private calculateBackoff(attempt: number): number {
    const base = this.retry_backoff_base_ms
    const exponential = 2 ** (attempt - 1) * base
    const jitter = 1 + Math.random() * 0.2 // ±0-20% jitter
    const withJitter = exponential * jitter
    const capped = Math.min(withJitter, 60000) // Max 60 seconds

    return Math.round(capped)
  }

  /**
   * Update license status in master database
   *
   * Transaction:
   * - SELECT * FROM licenses WHERE id = $1 FOR UPDATE
   * - UPDATE licenses SET status = $2, metadata = $3
   * - COMMIT
   *
   * Metadata captured:
   * - correlation_id (trace)
   * - job_id (audit)
   * - error message (if any)
   * - attempt count (retry tracking)
   */
  private async updateLicenseStatus(
    license_id: number,
    new_status: string,
    error_message: string | null,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const client = await this.master_pool.connect()

    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE')

      // Acquire lock
      const lockResult = await client.query('SELECT id FROM licenses WHERE id = $1 FOR UPDATE', [
        license_id,
      ])

      if (!lockResult.rows.length) {
        throw new Error(`License not found: ${license_id}`)
      }

      // Update status
      const updateQuery = `
        UPDATE licenses
        SET status = $1,
            metadata = $2,
            ${error_message ? 'provision_error = $3,' : ''}
            updated_at = NOW()
        WHERE id = ${error_message ? '$4' : '$3'}
        RETURNING *
      `

      const updateParams: Array<number | string> = [new_status, JSON.stringify(metadata)]
      if (error_message) {
        updateParams.push(error_message)
      }
      updateParams.push(license_id)

      await client.query(updateQuery, updateParams)

      await client.query('COMMIT')

      logger.info(
        {
          license_id,
          new_status,
          metadata,
          error: error_message,
        },
        'License status updated via provisioning handler'
      )
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }
}

/**
 * Exported handler factory
 */
export async function createProvisioningHandler(
  config: ProvisioningHandlerConfig
): Promise<ProvisioningHandler> {
  return new ProvisioningHandler(config)
}
