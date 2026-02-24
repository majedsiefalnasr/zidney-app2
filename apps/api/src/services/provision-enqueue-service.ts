/**
 * Provision Enqueue Service
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Service responsible for pushing provisioning jobs to Redis queue.
 *
 * Handles:
 * - Job serialization
 * - Queue connection management
 * - Error handling and logging
 * - Idempotency key tracking
 */

import {
  ProvisioningJob,
  ProvisioningJobStatus,
  QUEUE_NAMES,
} from '@zidney/types/jobs/provisioning-job'
import { Redis } from 'ioredis'

/**
 * Enqueue Result
 */
export interface EnqueueResult {
  success: boolean
  jobId?: string
  error?: string
  queueDepth?: number
}

/**
 * Provision Enqueue Service
 */
export class ProvisionEnqueueService {
  private redis: Redis
  private queueName: string
  private logger?: any

  constructor(
    redis: Redis,
    queueName: string = QUEUE_NAMES.JOBS,
    logger?: any
  ) {
    this.redis = redis
    this.queueName = queueName
    this.logger = logger
  }

  /**
   * Enqueue provisioning job
   */
  async enqueue(job: ProvisioningJob): Promise<EnqueueResult> {
    try {
      this.logger?.logStep('enqueue-serialize', 'Serializing job for queue', {
        job_id: job.jobId,
        license_id: job.licenseId,
      })

      // Serialize job to JSON
      const jobPayload = JSON.stringify({
        ...job,
        status: ProvisioningJobStatus.QUEUED,
        enqueuedAt: new Date().toISOString(),
      })

      // Push to Redis queue using LPUSH (left push for FIFO)
      const depth = await this.redis.lpush(this.queueName, jobPayload)

      this.logger?.logStep('enqueue-complete', 'Job enqueued successfully', {
        job_id: job.jobId,
        queue_depth: depth,
      })

      // Also store idempotency key mapping if provided
      if (job.idempotencyKey) {
        await this.storeIdempotencyKey(job)
      }

      return {
        success: true,
        jobId: job.jobId,
        queueDepth: depth,
      }
    } catch (error) {
      this.logger?.logError(
        'Job enqueueing failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          job_id: job.jobId,
          license_id: job.licenseId,
        }
      )

      return {
        success: false,
        jobId: job.jobId,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Store idempotency key for response caching
   */
  private async storeIdempotencyKey(job: ProvisioningJob): Promise<void> {
    const idempotencyKey = `provisioning:idempotency:${job.idempotencyKey}`
    const cacheData = {
      jobId: job.jobId,
      licenseId: job.licenseId,
      workspaceSlug: job.workspaceSlug,
      createdAt: new Date().toISOString(),
    }

    // Cache for 24 hours (per RFC 7231)
    const cacheTTL = 86400
    await this.redis.setex(idempotencyKey, cacheTTL, JSON.stringify(cacheData))
  }

  /**
   * Get queue depth (for metrics)
   */
  async getQueueDepth(): Promise<number> {
    try {
      const depth = await this.redis.llen(this.queueName)
      return depth
    } catch (error) {
      this.logger?.logWarn('Failed to get queue depth', {
        error: String(error),
      })
      return -1
    }
  }

  /**
   * Get queue stats (for observability)
   */
  async getQueueStats(): Promise<Record<string, unknown>> {
    try {
      const [jobs, dlq, idempotencyKeys] = await Promise.all([
        this.redis.llen(this.queueName),
        this.redis.llen(QUEUE_NAMES.DLQ),
        this.redis.dbsize(),
      ])

      return {
        queue_depth: jobs,
        dlq_depth: dlq,
        redis_keys: idempotencyKeys,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      this.logger?.logWarn('Failed to get queue stats', {
        error: String(error),
      })
      return { error: String(error) }
    }
  }
}

/**
 * Factory to create enqueue service
 */
export function createProvisionEnqueueService(
  redis: Redis,
  logger?: any
): ProvisionEnqueueService {
  return new ProvisionEnqueueService(redis, QUEUE_NAMES.JOBS, logger)
}
