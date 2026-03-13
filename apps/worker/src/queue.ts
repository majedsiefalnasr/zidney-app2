/**
 * Job Queue Service - Handles job enqueue/dequeue operations.
 *
 * Responsibilities:
 * - Enqueue jobs with dual ID tracking (request_id + job_id)
 * - Compute payload hash at enqueue for mutation detection
 * - Manage queue persistence (Redis-based)
 * - Support job type routing (finalize_attempt, generate_certificate, send_email)
 *
 * Per clarification Q3: Each job gets unique job_id while inheriting request_id from API.
 * Per clarification Q5: Payload hash computed at enqueue, verified at dequeue.
 */

import { randomUUID } from 'node:crypto'
import { computeJobPayloadHash } from '@zidney/domain-core/job-hash'
import { logger } from '@zidney/logger'
import type { JobEnvelope } from '@zidney/types/job-envelope'
import type { RedisClientType } from 'redis'

/** Redis client (injected from service setup) */
let redisClient: RedisClientType | null = null

/**
 * Initialize queue service with Redis client.
 *
 * @param redis - Redis client instance
 */
export function initializeQueueService(redis: RedisClientType): void {
  redisClient = redis
}

/**
 * Enqueue a job with dual ID tracking and payload hashing.
 *
 * Creates job envelope with:
 * - job_id: Generated UUID (unique per execution)
 * - request_id: Inherited from API context
 * - payload_hash: SHA256 of payload for mutation detection
 * - retry_count: Initialized to 0
 *
 * @param job_type - Queue name/type (e.g., 'finalize_attempt', 'generate_certificate')
 * @param payload - Job-specific payload
 * @param request_id - Request ID from API context (inherited)
 * @param workspace_id - Workspace UUID for isolation
 * @param user_id - User ID (optional)
 * @param attempt_id - Attempt ID for attempt-specific jobs (optional)
 * @param max_retries - Maximum retry attempts (default: 3)
 * @returns Generated job_id
 * @throws Error if enqueue fails
 */
export async function enqueueJob<T extends Record<string, unknown>>(
  job_type: string,
  payload: T,
  request_id: string,
  workspace_id: string,
  user_id?: string,
  attempt_id?: string,
  max_retries: number = 3
): Promise<string> {
  const jobId = randomUUID()
  const payloadHash = computeJobPayloadHash(payload)

  // Build job envelope
  const envelope: JobEnvelope<T> = {
    job_id: jobId,
    request_id,
    workspace_id,
    user_id,
    job_name: job_type,
    attempt_id,
    payload,
    payload_hash: payloadHash,
    retry_count: 0,
    max_retries,
    created_at: new Date().toISOString(),
  }

  try {
    if (!redisClient) throw new Error('Redis client not initialized')
    // Enqueue to Redis queue (list-based FIFO)
    const queueKey = `queue:${job_type}`
    await redisClient.lpush(queueKey, JSON.stringify(envelope))

    // Log enqueue event
    logger.info('job_enqueued', {
      job_id: jobId,
      request_id,
      job_type,
      workspace_id,
      queue_key: queueKey,
    })

    return jobId
  } catch (error) {
    logger.error('job_enqueue_failed', {
      job_type,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Dequeue a job from specific queue.
 *
 * Retrieves next job from queue head (FIFO).
 * Blocks on empty queue (non-blocking timeout configurable).
 *
 * @param job_type - Queue name/type
 * @param timeout_seconds - Timeout in seconds (0 for non-blocking, -1 for indefinite)
 * @returns Job envelope or null if queue empty/timeout
 */
export async function dequeueJob(
  job_type: string,
  timeout_seconds: number = 0
): Promise<JobEnvelope | null> {
  try {
    const queueKey = `queue:${job_type}`

    // Pop from queue head (FIFO)
    // BRPOP blocks if queue empty (timeout_seconds: 0 = non-blocking)
    const result = await redisClient.brpop(queueKey, timeout_seconds)

    if (!result || !result[1]) {
      return null
    }

    // Parse job envelope from Redis
    const envelope = JSON.parse(result[1]) as JobEnvelope

    logger.info('job_dequeued', {
      job_id: envelope.job_id,
      request_id: envelope.request_id,
      job_type: envelope.job_name,
      retry_count: envelope.retry_count,
    })

    return envelope
  } catch (error) {
    logger.error('job_dequeue_failed', {
      job_type,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Re-enqueue a job for retry.
 *
 * Increments retry_count and re-enqueues to queue head (priority).
 * Called on transient failures (within max_retries limit).
 *
 * @param job - Job to retry
 * @returns true if re-enqueued, false if max retries exceeded
 */
export async function retryJob(job: JobEnvelope): Promise<boolean> {
  if (job.retry_count >= job.max_retries) {
    // Dead-letter: max retries exceeded
    logger.error('job_max_retries_exceeded', {
      job_id: job.job_id,
      request_id: job.request_id,
      retry_count: job.retry_count,
      max_retries: job.max_retries,
    })
    await moveToDeadLetter(job)
    return false
  }

  const retryJob = {
    ...job,
    retry_count: job.retry_count + 1,
    processing_started_at: undefined, // Reset for next attempt
  }

  try {
    const queueKey = `queue:${job.job_name}`
    await redisClient.lpush(queueKey, JSON.stringify(retryJob))

    logger.info('job_retried', {
      job_id: job.job_id,
      request_id: job.request_id,
      retry_count: retryJob.retry_count,
      max_retries: job.max_retries,
    })

    return true
  } catch (error) {
    logger.error('job_retry_failed', {
      job_id: job.job_id,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Move job to dead-letter queue (max retries exceeded or unrecoverable error).
 *
 * @param job - Failed job
 * @param error_message - Optional error message
 */
export async function moveToDeadLetter(job: JobEnvelope, error_message?: string): Promise<void> {
  try {
    const dlqKey = 'dlq:failed_jobs'
    const dlqEntry = {
      ...job,
      status: 'DEAD_LETTERED',
      completed_at: new Date().toISOString(),
      error: {
        code: 'MAX_RETRIES_EXCEEDED',
        message: error_message || 'Job failed after maximum retry attempts',
      },
    }

    await redisClient.lpush(dlqKey, JSON.stringify(dlqEntry))

    logger.error('job_moved_to_dlq', {
      job_id: job.job_id,
      request_id: job.request_id,
      job_type: job.job_name,
      dlq_key: dlqKey,
    })
  } catch (error) {
    logger.error('dlq_move_failed', {
      job_id: job.job_id,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Get queue length (for monitoring).
 *
 * @param job_type - Queue name/type
 * @returns Number of jobs in queue
 */
export async function getQueueLength(job_type: string): Promise<number> {
  const queueKey = `queue:${job_type}`
  return redisClient.llen(queueKey)
}
