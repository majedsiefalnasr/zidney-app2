/**
 * Retry + DLQ strategy (Task 27)
 * Exponential backoff and dead-letter queue
 */

import { logger } from '@zidney/logger'
import type { SchemaMigrationJob } from './schema-migration-job'

export interface RetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 60000, // 1 minute
  backoffMultiplier: 2,
}

/**
 * Calculate delay for next retry (exponential backoff)
 */
export function calculateNextRetryDelay(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): number {
  const delay = policy.baseDelayMs * policy.backoffMultiplier ** (attempt - 1)
  return Math.min(delay, policy.maxDelayMs)
}

/**
 * Determine if job should be retried
 */
export function shouldRetry(
  job: SchemaMigrationJob,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): boolean {
  const attempt = job.attempt || 1
  return attempt < policy.maxAttempts
}

/**
 * Send job to DLQ (Dead Letter Queue)
 * Stores failed jobs for manual investigation
 */
export type DbLike = { query: (sql: string, params?: unknown[]) => Promise<unknown> }

export async function sendToDLQ(
  job: SchemaMigrationJob,
  error: Error,
  database: DbLike
): Promise<void> {
  try {
    await database.query(
      `INSERT INTO dead_letter_queue (
        job_type, workspace_id, original_job, error_message, entered_at
      ) VALUES ($1, $2, $3, $4, $5)`,
      [job.job_type, job.workspace_id, JSON.stringify(job), error.message, new Date()]
    )

    logger.error('job_sent_to_dlq', {
      service: 'dlq',
      job_type: job.job_type,
      workspace_id: job.workspace_id,
      error_message: error.message,
    })
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error('dlq_write_failed', {
      service: 'dlq',
      error_message: errMsg,
    })
  }
}

/**
 * Prepare job for retry
 */
export function prepareForRetry(job: SchemaMigrationJob): SchemaMigrationJob {
  return {
    ...job,
    attempt: (job.attempt || 1) + 1,
  }
}
