/**
 * Retry Strategy (Exponential Backoff)
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T040
 *
 * Implements exponential backoff retry policy for failed jobs.
 *
 * Key Properties:
 * - EXPONENTIAL BACKOFF: 1s → 2s → 4s → 8s → 16s
 * - MAX RETRIES: 5 attempts total
 * - DLQ HANDOFF: After 5 failures, move to dead-letter queue
 * - IDEMPOTENT: Re-enqueueing same job is safe
 *
 * Retry Flow:
 * 1. Catch job error
 * 2. Increment retry_count
 * 3. If retries < 5: Re-enqueue with exponential delay
 * 4. If retries >= 5: Move to DLQ (T041)
 * 5. Log each retry attempt
 *
 * ADRs: ADR-0001 (tenant isolation)
 */

import { Pool } from 'pg'
import { logger } from '@zidney/logger'

/**
 * Interface: Retry Configuration
 */
interface RetryConfig {
  maxRetries: number // Maximum retry attempts
  backoffMs: number[] // Backoff schedule (milliseconds)
  dlqQueueName: string // Dead letter queue table name
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  backoffMs: [1000, 2000, 4000, 8000, 16000], // 1s, 2s, 4s, 8s, 16s
  dlqQueueName: 'failed_grading_jobs',
}

/**
 * Interface: Failed Job
 */
interface GradingJob {
  id: string
  attempt_id: string
  workspace_id: string
  correlation_id: string
  retry_count?: number
  status?: string
}

/**
 * Handle job failure with retry strategy
 *
 * Decision Tree:
 * 1. If retry_count < maxRetries: Re-enqueue with backoff
 * 2. If retry_count >= maxRetries: Move to DLQ
 *
 * @param masterDb - Master database pool
 * @param job - Failed job
 * @param error - Error that caused failure
 * @param config - Retry configuration (optional; uses defaults)
 */
export async function handleJobFailure(
  masterDb: Pool,
  job: GradingJob,
  error: Error | unknown,
  config?: Partial<RetryConfig>
): Promise<void> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  const currentRetryCount = (job.retry_count || 0) + 1
  const maxRetries = retryConfig.maxRetries

  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  logger.warn(
    {
      service: 'retry-strategy',
      action: 'job_failed',
      job_id: job.id,
      attempt_id: job.attempt_id,
      workspace_id: job.workspace_id,
      retry_count: currentRetryCount,
      max_retries: maxRetries,
      error: errorMessage,
      correlation_id: job.correlation_id,
    },
    'Job processing failed'
  )

  // Check if should retry
  if (currentRetryCount <= maxRetries) {
    const backoffIndex = Math.min(
      currentRetryCount - 1,
      retryConfig.backoffMs.length - 1
    )
    const delayMs = retryConfig.backoffMs[backoffIndex]

    logger.info(
      {
        service: 'retry-strategy',
        action: 'job_requeued',
        job_id: job.id,
        attempt_id: job.attempt_id,
        workspace_id: job.workspace_id,
        retry_count: currentRetryCount,
        delay_ms: delayMs,
        correlation_id: job.correlation_id,
      },
      'Job re-queued for retry'
    )

    // Re-enqueue job with retry count and delay
    await requeueJobWithDelay(masterDb, job, currentRetryCount, delayMs)
  } else {
    logger.error(
      {
        service: 'retry-strategy',
        action: 'max_retries_exceeded',
        job_id: job.id,
        attempt_id: job.attempt_id,
        workspace_id: job.workspace_id,
        retry_count: currentRetryCount,
        max_retries: maxRetries,
        correlation_id: job.correlation_id,
      },
      'Job exceeded maximum retries; moving to DLQ'
    )

    // Move to dead-letter queue
    await moveJobToDLQ(
      masterDb,
      job,
      currentRetryCount,
      errorMessage,
      errorStack,
      retryConfig.dlqQueueName
    )
  }
}

/**
 * Database: Re-enqueue job with retry count and delay
 *
 * Updates grading_jobs to retry:
 * 1. Set status = PENDING
 * 2. Increment retry_count
 * 3. Set available_at = NOW() + delay_ms
 *
 * The delay is handled by polling logic (consumer skips jobs with available_at in future).
 *
 * @param masterDb - Master database pool
 * @param job - Failed job
 * @param retryCount - New retry count
 * @param delayMs - Delay in milliseconds
 */
async function requeueJobWithDelay(
  masterDb: Pool,
  job: GradingJob,
  retryCount: number,
  delayMs: number
): Promise<void> {
  const availableAt = new Date(Date.now() + delayMs)

  await masterDb.query(
    `
    UPDATE grading_jobs
    SET 
      status = $1,
      retry_count = $2,
      available_at = $3,
      updated_at = NOW()
    WHERE id = $4
    `,
    ['PENDING', retryCount, availableAt, job.id]
  )

  logger.debug(
    {
      service: 'retry-strategy',
      action: 'job_requeued_db_update',
      job_id: job.id,
      retry_count: retryCount,
      available_at: availableAt.toISOString(),
    },
    'Job status updated for retry'
  )
}

/**
 * Database: Move job to dead-letter queue
 *
 * Creates record in failed_grading_jobs table with:
 * - Job reference (id, attempt_id, workspace_id)
 * - Error details (message, stack trace)
 * - Timestamp and retry count
 *
 * Then mark original job as FAILED.
 *
 * @param masterDb - Master database pool
 * @param job - Failed job
 * @param retryCount - Number of retries attempted
 * @param errorMessage - Error message
 * @param errorStack - Error stack trace (optional)
 * @param dlqTableName - Dead-letter queue table name
 */
async function moveJobToDLQ(
  masterDb: Pool,
  job: GradingJob,
  retryCount: number,
  errorMessage: string,
  errorStack: string | undefined,
  dlqTableName: string
): Promise<void> {
  const client = await masterDb.connect()

  try {
    await client.query('BEGIN')

    // Create DLQ record
    await client.query(
      `
      INSERT INTO ${dlqTableName} (
        id,
        job_id,
        attempt_id,
        workspace_id,
        error_message,
        error_stack,
        last_retry_at,
        num_retries,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `,
      [
        generateUUID(),
        job.id,
        job.attempt_id,
        job.workspace_id,
        errorMessage,
        errorStack,
        new Date(),
        retryCount,
      ]
    )

    // Mark original job as FAILED
    await client.query(
      `
      UPDATE grading_jobs
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      `,
      ['FAILED', job.id]
    )

    await client.query('COMMIT')

    logger.info(
      {
        service: 'retry-strategy',
        action: 'job_moved_to_dlq',
        job_id: job.id,
        attempt_id: job.attempt_id,
        workspace_id: job.workspace_id,
        error_message: errorMessage,
        dlq_table: dlqTableName,
      },
      'Job moved to dead-letter queue'
    )
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackErr) {
      logger.error(
        {
          service: 'retry-strategy',
          action: 'dlq_rollback_error',
          job_id: job.id,
          error:
            rollbackErr instanceof Error
              ? rollbackErr.message
              : String(rollbackErr),
        },
        'Error rolling back DLQ transaction'
      )
    }

    logger.error(
      {
        service: 'retry-strategy',
        action: 'dlq_error',
        job_id: job.id,
        attempt_id: job.attempt_id,
        workspace_id: job.workspace_id,
        error: err instanceof Error ? err.message : String(err),
      },
      'Error moving job to DLQ'
    )

    throw err
  } finally {
    client.release()
  }
}

/**
 * Utility: Generate UUID (simplified; use proper UUID library in production)
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Calculate exponential backoff delay
 *
 * @param retryCount - Current retry count (0-based)
 * @param baseMs - Base delay in milliseconds (default 1000)
 * @param maxMs - Maximum delay in milliseconds (default 30000)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  retryCount: number,
  baseMs: number = 1000,
  maxMs: number = 30000
): number {
  const exponentialDelay = baseMs * Math.pow(2, retryCount)
  return Math.min(exponentialDelay, maxMs)
}
