/**
 * Retry Enqueue Service
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Handles job retry logic.
 * Re-enqueues failed jobs with exponential backoff.
 * Enforces maximum retry limit (3 attempts).
 * Moves exhausted jobs to dead-letter queue.
 */

import {
  DEFAULT_RETRY_POLICY,
  ProvisioningJob,
  ProvisioningJobStatus,
} from '@zidney/types/jobs/provisioning-job'
import { Redis } from 'ioredis'

/**
 * Retry result interface
 */
export interface RetryEnqueueResult {
  success: boolean
  retryCount?: number
  requeued?: boolean
  movedToDLQ?: boolean
  errorMessage?: string
  durationMs?: number
}

/**
 * Retry Enqueue Service
 */
export class RetryEnqueueService {
  private redis: Redis
  private queueName: string
  private dlqName: string
  private logger?: any

  constructor(redis: Redis, queueName: string, dlqName: string, logger?: any) {
    this.redis = redis
    this.queueName = queueName
    this.dlqName = dlqName
    this.logger = logger
  }

  /**
   * Calculate backoff delay with exponential strategy
   */
  private calculateBackoffDelay(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s, ...
    // But capped at 60 seconds
    const baseDelay = 1000 // 1 second
    const exponentialDelay = baseDelay * Math.pow(2, retryCount)
    const maxDelay = 60000 // 60 seconds

    return Math.min(exponentialDelay, maxDelay)
  }

  /**
   * Attempt to retry a failed job
   */
  async retryJob(job: ProvisioningJob): Promise<RetryEnqueueResult> {
    const startTime = Date.now()

    try {
      const retryCount = (job.retryCount || 0) + 1
      const maxRetries = DEFAULT_RETRY_POLICY.maxRetries

      this.logger?.logRetry('Job retry attempt', {
        license_id: job.licenseId,
        retry_count: retryCount,
        max_retries: maxRetries,
      })

      // Check if we've exhausted retries
      if (retryCount > maxRetries) {
        this.logger?.logWarn('Retry limit exhausted', {
          license_id: job.licenseId,
          retry_count: retryCount,
          max_retries: maxRetries,
        })

        // Move to DLQ
        return this.moveToDLQ(job, 'Max retries exhausted')
      }

      // Calculate backoff delay
      const backoffDelay = this.calculateBackoffDelay(retryCount - 1)

      // Create updated job
      const updatedJob: ProvisioningJob = {
        ...job,
        retryCount,
        status: ProvisioningJobStatus.RETRYING,
        // @ts-ignore: LOGIC-BUG: lastRetryAt does not exist in ProvisioningJob type — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
        lastRetryAt: new Date().toISOString(),
      }

      // Re-enqueue with delay using sorted set (ZADD)
      const scheduledTime = Date.now() + backoffDelay
      await this.redis.zadd(
        this.getScheduledQueueName(),
        scheduledTime,
        JSON.stringify(updatedJob)
      )

      this.logger?.logRetry('Job re-enqueued with backoff', {
        license_id: job.licenseId,
        retry_count: retryCount,
        backoff_delay_ms: backoffDelay,
        scheduled_time: new Date(scheduledTime).toISOString(),
        durationMs: Date.now() - startTime,
      })

      return {
        success: true,
        retryCount,
        requeued: true,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger?.logError(
        'Job re-enqueue failed',
        error instanceof Error ? error : new Error(errorMsg),
        { license_id: job.licenseId }
      )

      return {
        success: false,
        errorMessage: errorMsg,
        durationMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Move job to dead-letter queue
   */
  async moveToDLQ(
    job: ProvisioningJob,
    reason: string
  ): Promise<RetryEnqueueResult> {
    const startTime = Date.now()

    try {
      const dlqEntry = {
        ...job,
        status: ProvisioningJobStatus.DEAD_LETTERED,
        dlqReason: reason,
        dlqMovedAt: new Date().toISOString(),
      }

      // Push to DLQ (list)
      await this.redis.lpush(this.dlqName, JSON.stringify(dlqEntry))

      // Set expiration (keep in DLQ for 30 days)
      await this.redis.expire(this.dlqName, 30 * 24 * 60 * 60)

      this.logger?.logDLQMove('Job moved to DLQ', {
        license_id: job.licenseId,
        dlq_reason: reason,
        retry_count: job.retryCount,
        durationMs: Date.now() - startTime,
      })

      return {
        success: true,
        movedToDLQ: true,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger?.logError(
        'DLQ movement failed',
        error instanceof Error ? error : new Error(errorMsg),
        { license_id: job.licenseId }
      )

      return {
        success: false,
        errorMessage: errorMsg,
        durationMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Move scheduled jobs to main queue when their time arrives
   */
  async promoteScheduledJobs(): Promise<number> {
    try {
      const now = Date.now()

      // Get all jobs ready to be promoted (score <= now)
      const readyJobs = await this.redis.zrangebyscore(
        this.getScheduledQueueName(),
        '-inf',
        now
      )

      if (readyJobs.length === 0) {
        return 0
      }

      // Move to main queue
      for (const jobStr of readyJobs) {
        await this.redis.lpush(this.queueName, jobStr)
      }

      // Remove from scheduled queue
      await this.redis.zremrangebyscore(
        this.getScheduledQueueName(),
        '-inf',
        now
      )

      this.logger?.logStep(
        'scheduled-promotion',
        'Scheduled jobs promoted to main queue',
        {
          count: readyJobs.length,
        }
      )

      return readyJobs.length
    } catch (error) {
      this.logger?.logError(
        'Scheduled job promotion failed',
        error instanceof Error ? error : new Error(String(error))
      )
      return 0
    }
  }

  /**
   * Get the name of the scheduled queue (sorted set)
   */
  private getScheduledQueueName(): string {
    return `${this.queueName}:scheduled`
  }
}

/**
 * Factory to create retry enqueue service
 */
export function createRetryEnqueueService(
  redis: Redis,
  queueName: string,
  dlqName: string,
  logger?: any
): RetryEnqueueService {
  return new RetryEnqueueService(redis, queueName, dlqName, logger)
}
