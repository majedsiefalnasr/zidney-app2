import { v4 as uuidv4 } from 'uuid'
import { logger } from '../../infrastructure/logger'
import { redis } from '../../infrastructure/redis'

/**
 * T042: Redis-based job queue implementation
 *
 * Provides a FIFO queue for async job processing:
 * - Enqueue: Add job to queue
 * - Dequeue: Remove job from queue
 * - Store result: Store job result in Redis with TTL
 * - Poll result: Check for job completion
 */

export interface JobQueueEntry {
  job_id: string
  type: string
  workspace_id: string
  workspace_slug: string
  user_id: string
  correlation_id: string
  created_at: string
  retry_count: number
  max_retries: number
  payload: Record<string, unknown>
}

export interface JobResult {
  job_id: string
  status: 'completed' | 'error'
  result?: unknown
  error?: string
  completed_at: string
}

export class JobQueue {
  private readonly queuePrefix = 'queue:jobs'
  private readonly resultPrefix = 'job:result'
  private readonly lockPrefix = 'job:lock'
  private readonly resulTTL = 3600 // 1 hour

  /**
   * Enqueue a job for processing
   */
  async enqueue(
    workspaceId: string,
    workspaceSlug: string,
    jobType: string,
    userId: string,
    correlationId: string,
    payload: Record<string, unknown>,
    maxRetries = 5
  ): Promise<string> {
    const jobId = uuidv4()
    const queueKey = `${this.queuePrefix}:${workspaceId}`

    const job: JobQueueEntry = {
      job_id: jobId,
      type: jobType,
      workspace_id: workspaceId,
      workspace_slug: workspaceSlug,
      user_id: userId,
      correlation_id: correlationId,
      created_at: new Date().toISOString(),
      retry_count: 0,
      max_retries: maxRetries,
      payload,
    }

    try {
      // Use LPUSH to add to queue (FIFO with RPOP)
      await redis.lpush(queueKey, JSON.stringify(job))

      logger.info(`Job enqueued`, {
        job_id: jobId,
        job_type: jobType,
        workspace_id: workspaceId,
        workspace_slug: workspaceSlug,
        user_id: userId,
        correlation_id: correlationId,
      })

      return jobId
    } catch (error) {
      logger.error(`Job enqueue error`, {
        job_type: jobType,
        workspace_id: workspaceId,
        user_id: userId,
        correlation_id: correlationId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Dequeue a job for processing
   */
  async dequeue(workspaceId: string): Promise<JobQueueEntry | null> {
    const queueKey = `${this.queuePrefix}:${workspaceId}`

    try {
      // Use RPOP to get oldest job (FIFO)
      const jobJson = await redis.rpop(queueKey)

      if (!jobJson) {
        return null
      }

      const job = JSON.parse(jobJson as string) as JobQueueEntry

      logger.debug(`Job dequeued`, {
        job_id: job.job_id,
        job_type: job.type,
        workspace_id: workspaceId,
      })

      return job
    } catch (error) {
      logger.error(`Job dequeue error`, {
        workspace_id: workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Re-enqueue a job for retry
   */
  async reenqueue(job: JobQueueEntry, delayMs = 0): Promise<void> {
    const queueKey = `${this.queuePrefix}:${job.workspace_id}`
    const retriedJob = {
      ...job,
      retry_count: job.retry_count + 1,
    }

    try {
      if (delayMs > 0) {
        // Use sorted set for delayed queue
        const delayedKey = `${queueKey}:delayed`
        const scheduledTime = Date.now() + delayMs
        await redis.zadd(delayedKey, scheduledTime, JSON.stringify(retriedJob))

        logger.info(`Job re-enqueued with delay`, {
          job_id: job.job_id,
          delay_ms: delayMs,
          retry_count: retriedJob.retry_count,
        })
      } else {
        // Immediate re-enqueue
        await redis.lpush(queueKey, JSON.stringify(retriedJob))

        logger.info(`Job re-enqueued`, {
          job_id: job.job_id,
          retry_count: retriedJob.retry_count,
        })
      }
    } catch (error) {
      logger.error(`Job re-enqueue error`, {
        job_id: job.job_id,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Store job result in Redis
   */
  async storeResult(result: JobResult): Promise<void> {
    const resultKey = `${this.resultPrefix}:${result.job_id}`

    try {
      await redis.setex(resultKey, this.resulTTL, JSON.stringify(result))

      logger.debug(`Job result stored`, {
        job_id: result.job_id,
        status: result.status,
        ttl_seconds: this.resulTTL,
      })
    } catch (error) {
      logger.error(`Job result storage error`, {
        job_id: result.job_id,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Retrieve job result from Redis
   */
  async getResult(jobId: string): Promise<JobResult | null> {
    const resultKey = `${this.resultPrefix}:${jobId}`

    try {
      const resultJson = await redis.get(resultKey)

      if (!resultJson) {
        return null
      }

      return JSON.parse(resultJson) as JobResult
    } catch (error) {
      logger.error(`Job result retrieval error`, {
        job_id: jobId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Poll for job result with timeout
   */
  async waitForResult(
    jobId: string,
    timeoutMs = 30000,
    pollIntervalMs = 100
  ): Promise<JobResult | null> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.getResult(jobId)

      if (result) {
        return result
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    logger.warn(`Job result poll timeout`, {
      job_id: jobId,
      timeout_ms: timeoutMs,
    })

    return null
  }

  /**
   * Get queue length for monitoring
   */
  async getQueueLength(workspaceId: string): Promise<number> {
    const queueKey = `${this.queuePrefix}:${workspaceId}`

    try {
      const length = await redis.llen(queueKey)
      return length || 0
    } catch (error) {
      logger.error(`Queue length check error`, {
        workspace_id: workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return -1
    }
  }

  /**
   * Clear all results for debugging
   */
  async clearResults(jobIds: string[]): Promise<void> {
    try {
      const resultKeys = jobIds.map((id) => `${this.resultPrefix}:${id}`)
      if (resultKeys.length > 0) {
        await redis.del(...resultKeys)
      }

      logger.debug(`Job results cleared`, {
        count: jobIds.length,
      })
    } catch (error) {
      logger.error(`Job results clear error`, {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export const jobQueue = new JobQueue()
