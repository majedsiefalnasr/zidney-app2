/**
 * JobQueue - Redis-based job queue for provisioning service
 *
 * Purpose: Manage async job queueing with visibility timeout and DLQ
 * Design: FIFO queue with visibility timeout + processing set + DLQ
 * Pattern: Standard job queue pattern (enqueue → Visibility timeout → {ack|nack})
 *
 * Scope: apps/worker/src/services/provisioning/
 * Task: T009 – Implement job enqueue/dequeue (Redis queue)
 * Phase: 01 – Platform Foundation
 * Stage: STAGE_05_TENANT_PROVISIONING_SERVICE
 *
 * Queue names:
 * - provisioning_jobs: Main queue (FIFO list)
 * - provisioning_jobs:processing: Jobs being processed (set)
 * - provisioning_jobs:dlq: Dead-letter queue (failed jobs)
 *
 * Backoff strategy: min(2^attempt * 5s, 60s)
 */

import { Redis } from 'ioredis'
import ProvisioningJob, {
  DEFAULT_JOB_QUEUE_CONFIG,
  IJobQueue,
  JobQueueConfig,
} from '../../jobs/provisioning/ProvisioningJob'

/**
 * JobQueue: Redis-based job queue for provisioning
 */
export class JobQueue implements IJobQueue {
  private redis: Redis
  private config: JobQueueConfig

  constructor(redis: Redis, config: Partial<JobQueueConfig> = {}) {
    this.redis = redis
    this.config = { ...DEFAULT_JOB_QUEUE_CONFIG, ...config }
  }

  /**
   * Enqueue job to provisioning queue
   * Appends job message to Redis list (RPUSH)
   */
  async enqueue(job: ProvisioningJob): Promise<void> {
    try {
      const message = JSON.stringify(job.toRedisMessage())
      await this.redis.rpush(this.config.queue_name, message)
    } catch (error) {
      console.error(`JobQueue.enqueue error: ${error}`)
      throw error
    }
  }

  /**
   * Dequeue next job from queue with BLPOP (blocking)
   * Moves job to processing set for visibility timeout tracking
   *
   * @param timeout_seconds - How long to block waiting for job (0 = non-blocking)
   * @returns Next job or null if timeout/empty
   */
  async dequeue(
    timeout_seconds: number = this.config.dequeue_timeout_seconds
  ): Promise<ProvisioningJob | null> {
    try {
      const result = await this.redis.blpop(
        this.config.queue_name,
        timeout_seconds
      )

      if (!result || result.length < 2) {
        return null
      }

      const message_json = result[1]
      const job = ProvisioningJob.fromRedisMessage(JSON.parse(message_json))

      // Move to processing set for visibility timeout tracking
      const processing_key = `${this.config.processing_set_name}:${job.id}`
      await this.redis.setex(
        processing_key,
        this.config.dequeue_timeout_seconds * 3, // Visibility timeout
        JSON.stringify(job.toRedisMessage())
      )

      return job
    } catch (error) {
      console.error(`JobQueue.dequeue error: ${error}`)
      throw error
    }
  }

  /**
   * Acknowledge job (successful processing)
   * Removes job from processing set
   *
   * @param job_id - Job ID to acknowledge
   */
  async ack(job_id: string): Promise<void> {
    try {
      const processing_key = `${this.config.processing_set_name}:${job_id}`
      await this.redis.del(processing_key)
    } catch (error) {
      console.error(`JobQueue.ack error: ${error}`)
      throw error
    }
  }

  /**
   * Negative acknowledge job (processing failed, needs retry)
   * Returns job to queue with exponential backoff
   * After max attempts, moves to DLQ
   *
   * @param job_id - Job ID to nack
   * @param retried_job - Job object with attempt incremented
   */
  async nack(job_id: string, retried_job: ProvisioningJob): Promise<void> {
    try {
      // Remove from processing set
      const processing_key = `${this.config.processing_set_name}:${job_id}`
      await this.redis.del(processing_key)

      // Check if retryable
      if (!retried_job.isRetryable()) {
        // Max attempts exceeded, move to DLQ
        await this.moveToDLQ(job_id, retried_job)
        return
      }

      // Calculate backoff: min(2^attempt * 5s, 60s)
      const backoff_seconds = Math.min(
        Math.pow(
          this.config.retry_backoff_multiplier,
          retried_job.attempt - 1
        ) * this.config.retry_backoff_base_seconds,
        this.config.max_retry_backoff_seconds
      )

      // Re-enqueue with backoff delay
      const job_message = JSON.stringify(retried_job.toRedisMessage())

      // Use sorted set for delayed jobs (score = future timestamp)
      const future_timestamp = Date.now() + backoff_seconds * 1000
      await this.redis.zadd(
        `${this.config.queue_name}:delayed`,
        future_timestamp,
        job_message
      )
    } catch (error) {
      console.error(`JobQueue.nack error: ${error}`)
      throw error
    }
  }

  /**
   * Move job to Dead Letter Queue (DLQ)
   * Called after max retry attempts exhausted
   *
   * @param job_id - Job ID to move to DLQ
   * @param failed_job - Failed job object
   */
  async moveToDLQ(job_id: string, failed_job: ProvisioningJob): Promise<void> {
    try {
      const dlq_payload = JSON.stringify({
        job: failed_job.toRedisMessage(),
        dlq_timestamp: new Date().toISOString(),
        final_attempt: failed_job.attempt,
      })

      // Add to DLQ list
      await this.redis.rpush(this.config.dlq_name, dlq_payload)

      // Also add to tracking set with job_id for quick lookup
      await this.redis.sadd(`${this.config.dlq_name}:ids`, job_id)

      // Set expiry (keep DLQ jobs for 7 days)
      await this.redis.expire(this.config.dlq_name, 7 * 24 * 60 * 60)
    } catch (error) {
      console.error(`JobQueue.moveToDLQ error: ${error}`)
      throw error
    }
  }

  /**
   * Peek at pending jobs without removing them
   * Used for monitoring/debugging
   *
   * @param limit - Maximum jobs to peek
   * @returns Array of pending jobs
   */
  async peek(limit: number = 10): Promise<ProvisioningJob[]> {
    try {
      const messages = await this.redis.lrange(
        this.config.queue_name,
        0,
        limit - 1
      )

      return messages.map((msg) =>
        ProvisioningJob.fromRedisMessage(JSON.parse(msg))
      )
    } catch (error) {
      console.error(`JobQueue.peek error: ${error}`)
      return []
    }
  }

  /**
   * Peek at DLQ jobs (failed jobs awaiting manual intervention)
   *
   * @param limit - Maximum DLQ jobs to retrieve
   * @returns Array of failed jobs in DLQ
   */
  async peekDLQ(limit: number = 10): Promise<ProvisioningJob[]> {
    try {
      const messages = await this.redis.lrange(
        this.config.dlq_name,
        0,
        limit - 1
      )

      return messages.map((msg) => {
        const dlq_entry = JSON.parse(msg)
        return ProvisioningJob.fromRedisMessage(dlq_entry.job)
      })
    } catch (error) {
      console.error(`JobQueue.peekDLQ error: ${error}`)
      return []
    }
  }

  /**
   * Get queue statistics for monitoring
   *
   * @returns Statistics object with queue sizes
   */
  async getStats(): Promise<{
    pending_count: number
    processing_count: number
    dlq_count: number
  }> {
    try {
      const pending_count = await this.redis.llen(this.config.queue_name)
      const processing_keys = await this.redis.keys(
        `${this.config.processing_set_name}:*`
      )
      const dlq_count = await this.redis.llen(this.config.dlq_name)

      return {
        pending_count,
        processing_count: processing_keys.length,
        dlq_count,
      }
    } catch (error) {
      console.error(`JobQueue.getStats error: ${error}`)
      return {
        pending_count: 0,
        processing_count: 0,
        dlq_count: 0,
      }
    }
  }

  /**
   * Process delayed jobs (move from sorted set to main queue)
   * Run periodically to handle backoff delays
   */
  async processDelayedJobs(): Promise<number> {
    try {
      // Get all jobs with timestamp <= now
      const now = Date.now()
      const delayed_jobs = await this.redis.zrangebyscore(
        `${this.config.queue_name}:delayed`,
        0,
        now
      )

      if (delayed_jobs.length === 0) {
        return 0
      }

      // Move back to main queue
      for (const job_message of delayed_jobs) {
        await this.redis.rpush(this.config.queue_name, job_message)
      }

      // Remove from delayed set
      await this.redis.zremrangebyscore(
        `${this.config.queue_name}:delayed`,
        0,
        now
      )

      return delayed_jobs.length
    } catch (error) {
      console.error(`JobQueue.processDelayedJobs error: ${error}`)
      return 0
    }
  }

  /**
   * Cleanup: Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit()
  }
}

export default JobQueue
