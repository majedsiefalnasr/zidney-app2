/**
 * Retry + DLQ strategy (Task 27)
 * Exponential backoff and dead-letter queue
 */

import { SchemaMigrationJob } from './schema-migration-job'

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
  const delay =
    policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1)
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
export async function sendToDLQ(
  job: SchemaMigrationJob,
  error: Error,
  database: any
): Promise<void> {
  try {
    await database.query(
      `INSERT INTO dead_letter_queue (
        job_type, workspace_id, original_job, error_message, entered_at
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        job.job_type,
        job.workspace_id,
        JSON.stringify(job),
        error.message,
        new Date(),
      ]
    )

    console.log(
      JSON.stringify({
        level: 'ERROR',
        service: 'dlq',
        event: 'job_sent_to_dlq',
        job_type: job.job_type,
        workspace_id: job.workspace_id,
        error_message: error.message,
        timestamp: new Date().toISOString(),
      })
    )
  } catch (err: any) {
    console.log(
      JSON.stringify({
        level: 'ERROR',
        service: 'dlq',
        event: 'dlq_write_failed',
        error_message: err.message,
        timestamp: new Date().toISOString(),
      })
    )
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
