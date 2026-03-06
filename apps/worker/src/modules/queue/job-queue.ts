import { logger } from '@zidney/logger'
import type { RedisClientType } from 'redis'

/**
 * T043: Job Schema Definition
 *
 * Purpose: Define GradeAttemptJob structure
 * Constitutional Compliance: Worker as sole grading authority
 */

export interface GradeAttemptJob {
  // Metadata
  job_id: string // UUID
  type: 'GRADE_ATTEMPT'
  workspace_id: string // UUID
  workspace_slug: string
  user_id: string // UUID
  attempt_id: string // UUID
  correlation_id: string // Trace through worker

  // Job timing
  created_at: Date
  scheduled_for: Date
  expires_at: Date // Max 5min execution time

  // Grading context
  payload: {
    exam_id: string
    attempt_config_snapshot: Record<string, any> // Snapshot at submission time
    responses: Record<string, any> // Student answers
  }

  // Retry state
  retry_count: number
  max_retries: number
  last_error?: string

  // Results (populated after processing)
  result?: {
    score: number
    feedback: string
    details: Record<string, any>
    graded_at: Date
  }

  // Status
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED'
}

/**
 * T042: Job Queue Implementation
 *
 * Purpose: Enqueueing, tracking, and retrieving job results
 * Constitutional Compliance: Worker-only grading, API-only enqueuing
 */

export class JobQueue {
  private redis: RedisClientType
  private queueKey = 'jobs:grade_attempt:queue'
  private processingKey = 'jobs:grade_attempt:processing'
  private resultsKey = 'jobs:results'

  constructor(redis: RedisClientType) {
    this.redis = redis
  }

  /**
   * T044: Enqueue job from API
   */
  async enqueueJob(job: GradeAttemptJob): Promise<string> {
    const jobId = job.job_id

    try {
      // Store job metadata
      await this.redis.hSet(`job:${jobId}:meta`, {
        workspace_id: job.workspace_id,
        workspace_slug: job.workspace_slug,
        attempt_id: job.attempt_id,
        user_id: job.user_id,
        correlation_id: job.correlation_id,
        created_at: job.created_at.toISOString(),
        status: job.status,
      })

      // Store job payload (JSON)
      await this.redis.hSet(`job:${jobId}:payload`, {
        payload: JSON.stringify(job.payload),
        retry_count: String(job.retry_count),
        max_retries: String(job.max_retries),
      })

      // Add to queue (FIFO list)
      await this.redis.lPush(this.queueKey, jobId)

      // Set TTL on job data
      await this.redis.expire(`job:${jobId}:meta`, 86400) // 24 hours
      await this.redis.expire(`job:${jobId}:payload`, 86400)

      logger.info('job_enqueued', {
        correlation_id: job.correlation_id,
        job_id: jobId,
        attempt_id: job.attempt_id,
      })

      return jobId
    } catch (error) {
      logger.error('job_enqueue_failed', { job_id: jobId, error: String(error) })
      throw error
    }
  }

  /**
   * T045: Wait for job completion with polling
   */
  async waitForCompletion(
    jobId: string,
    timeoutMs: number = 30000
  ): Promise<GradeAttemptJob['result'] | null> {
    const pollIntervalMs = 100
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      // Check if result is available
      const resultKey = `${this.resultsKey}:${jobId}`
      const result = await this.redis.get(resultKey)

      if (result) {
        return JSON.parse(result)
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    // Timeout - return null but let worker continue
    logger.warn('job_completion_timeout', { job_id: jobId, timeout_ms: timeoutMs })
    return null
  }

  /**
   * T046: Dequeue job (worker side)
   */
  async dequeueJob(): Promise<GradeAttemptJob | null> {
    try {
      // RPOPLPUSH: move from queue to processing
      const jobId = await this.redis.rPopLPush(this.queueKey, this.processingKey)

      if (!jobId) {
        return null // No jobs in queue
      }

      // Fetch job metadata and payload
      const meta = await this.redis.hGetAll(`job:${jobId}:meta`)
      const payload = await this.redis.hGetAll(`job:${jobId}:payload`)

      const job: GradeAttemptJob = {
        job_id: jobId,
        type: 'GRADE_ATTEMPT',
        workspace_id: meta.workspace_id || '',
        workspace_slug: meta.workspace_slug || '',
        user_id: meta.user_id || '',
        attempt_id: meta.attempt_id || '',
        correlation_id: meta.correlation_id || '',
        created_at: new Date(meta.created_at || Date.now()),
        scheduled_for: new Date(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 min
        payload: JSON.parse(payload.payload || '{}'),
        retry_count: parseInt(payload.retry_count || '0'),
        max_retries: parseInt(payload.max_retries || '3'),
        status: 'PROCESSING',
      }

      return job
    } catch (error) {
      logger.error('job_dequeue_failed', { error: String(error) })
      return null
    }
  }

  /**
   * Store job result
   */
  async storeResult(jobId: string, result: GradeAttemptJob['result']): Promise<void> {
    try {
      const resultKey = `${this.resultsKey}:${jobId}`
      await this.redis.setEx(
        resultKey,
        3600, // 1 hour TTL
        JSON.stringify(result)
      )
    } catch (error) {
      logger.error('job_result_store_failed', { job_id: jobId, error: String(error) })
    }
  }

  /**
   * Mark job failed or completed
   */
  async clearStatus(jobId: string): Promise<void> {
    try {
      // Remove from processing queue
      await this.redis.lRem(this.processingKey, 0, jobId)
    } catch (error) {
      logger.error('job_status_clear_failed', { job_id: jobId, error: String(error) })
    }
  }
}

/**
 * Helper to create job queue
 */
export function createJobQueue(redis: RedisClientType): JobQueue {
  return new JobQueue(redis)
}
