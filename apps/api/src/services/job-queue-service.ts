/**
 * Job Queue Service
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase D, T030
 *
 * Purpose: Enqueue async grading jobs to worker
 * Requirements: Idempotent job enqueue, retry strategy, TTL-based cleanup
 *
 * Responsibilities:
 * - Create grading_jobs record in database
 * - Enqueue job to Redis/job queue
 * - Ensure job is idempotent (worker won't process same job twice)
 * - Track job status for polling
 *
 * Constitutional Compliance:
 * - ADR-0001: workspace_id on all queries
 * - Job is idempotent (worker validates status before grading)
 * - Structured logging with correlation_id
 * - Timeout: Jobs expire if not processed within 2 hours
 *
 * Job Lifecycle:
 * 1. POST /submit → enqueueGradingJob() → Job created with PENDING status
 * 2. Worker picks up job (in process) → Updates to PROCESSING
 * 3. Worker completes grading → Updates to COMPLETED with result_data
 * 4. Client polls GET /result → Reads from grading_jobs table
 */

import { Logger } from '@zidney/logger'
import { Pool, PoolClient } from 'pg'

/**
 * Job payload structure
 */
export interface GradingJobPayload {
  id: string // Job UUID
  attempt_id: string
  workspace_id: string
  user_id: string
  submitted_at: string // ISO timestamp
  retry_count: number
  max_retries: number
}

/**
 * Enqueue grading job
 *
 * Creates job record in database and pushes to job queue.
 * Job creation is atomic; queue enqueue is best-effort.
 *
 * @param db - Tenant database connection
 * @param queue - Redis/job queue client (optional; can defer enqueueing)
 * @param attemptId - Attempt UUID
 * @param workspaceId - Workspace UUID
 * @param userId - User UUID
 * @param logger - Logger instance
 * @param correlationId - Request correlation ID
 * @returns Promise<GradingJobPayload> - Job created
 * @throws Error if database write fails
 */
export async function enqueueGradingJob(
  db: PoolClient | Pool,
  queue: any | null,
  attemptId: string,
  workspaceId: string,
  userId: string,
  logger: Logger,
  correlationId: string
): Promise<GradingJobPayload> {
  const jobId = crypto.randomUUID()
  const now = new Date().toISOString()

  try {
    // Step 1: Create job record in database (PENDING status)
    // This is the source of truth for job state
    const insertResult = await db.query(
      `
      INSERT INTO grading_jobs (
        id, attempt_id, workspace_id,
        status, created_at, retry_count
      ) VALUES ($1, $2, $3, $4, NOW(), 0)
      RETURNING id, attempt_id, workspace_id, status, created_at
      `,
      [jobId, attemptId, workspaceId, 'PENDING']
    )

    if (insertResult.rows.length === 0) {
      throw new Error('Failed to insert grading job')
    }

    const job: GradingJobPayload = {
      id: jobId,
      attempt_id: attemptId,
      workspace_id: workspaceId,
      user_id: userId,
      submitted_at: now,
      retry_count: 0,
      max_retries: 5,
    }

    logger.info('Grading job created (PENDING)', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      attempt_id: attemptId,
      job_id: jobId,
      user_id: userId,
    })

    // Step 2: Enqueue job to queue (best-effort; if this fails, worker can still pick up from DB)
    if (queue) {
      try {
        const queueKey = `grading_queue:${workspaceId}`
        const jobPayload = JSON.stringify(job)

        // LPUSH to enqueue (worker will RPOP to dequeue)
        await queue.lPush(queueKey, jobPayload)

        logger.debug('Job pushed to queue', {
          correlation_id: correlationId,
          job_id: jobId,
          queue_key: queueKey,
        })
      } catch (queueErr) {
        logger.warn('Failed to push job to queue (will retry via DB scan)', {
          correlation_id: correlationId,
          job_id: jobId,
          error:
            queueErr instanceof Error ? queueErr.message : String(queueErr),
        })
        // Proceed without queue; worker can still pick up job from DB via "PENDING" status scan
      }
    }

    return job
  } catch (err) {
    logger.error('Failed to enqueue grading job', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      attempt_id: attemptId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * Get job status
 *
 * Retrieves current job status from database.
 * Called by result polling endpoint (T031).
 *
 * @param db - Tenant database connection
 * @param jobId - Job UUID
 * @param workspaceId - Workspace UUID
 * @param logger - Logger instance
 * @returns Promise<any> - Job record or null
 */
export async function getJobStatus(
  db: PoolClient | Pool,
  jobId: string,
  workspaceId: string,
  logger: Logger
): Promise<any> {
  try {
    const result = await db.query(
      `
      SELECT id, attempt_id, status, created_at, started_at, completed_at,
             error_message, retry_count, result_data
      FROM grading_jobs
      WHERE id = $1 AND workspace_id = $2
      `,
      [jobId, workspaceId]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  } catch (err) {
    logger.error('Failed to get job status', {
      job_id: jobId,
      workspace_id: workspaceId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * Get job by attempt ID
 *
 * Retrieves the most recent grading job for an attempt.
 *
 * @param db - Tenant database connection
 * @param attemptId - Attempt UUID
 * @param workspaceId - Workspace UUID
 * @param logger - Logger instance
 * @returns Promise<any> - Job record or null
 */
export async function getJobByAttemptId(
  db: PoolClient | Pool,
  attemptId: string,
  workspaceId: string,
  logger: Logger
): Promise<any> {
  try {
    const result = await db.query(
      `
      SELECT id, attempt_id, status, created_at, started_at, completed_at,
             error_message, retry_count, result_data
      FROM grading_jobs
      WHERE attempt_id = $1 AND workspace_id = $2
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [attemptId, workspaceId]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  } catch (err) {
    logger.error('Failed to get job by attempt', {
      attempt_id: attemptId,
      workspace_id: workspaceId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * Mark job as PROCESSING
 *
 * Called by worker when it picks up a job from queue.
 *
 * @param db - Tenant database connection
 * @param jobId - Job UUID
 * @param workspaceId - Workspace UUID
 * @param logger - Logger instance
 */
export async function markJobProcessing(
  db: PoolClient | Pool,
  jobId: string,
  workspaceId: string,
  logger: Logger
): Promise<void> {
  try {
    await db.query(
      `
      UPDATE grading_jobs
      SET status = 'PROCESSING', started_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2
      `,
      [jobId, workspaceId]
    )

    logger.debug('Marked job as PROCESSING', {
      job_id: jobId,
      workspace_id: workspaceId,
    })
  } catch (err) {
    logger.error('Failed to mark job as PROCESSING', {
      job_id: jobId,
      workspace_id: workspaceId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * Mark job as COMPLETED with result
 *
 * Called by worker after grading completes successfully.
 *
 * @param db - Tenant database connection
 * @param jobId - Job UUID
 * @param workspaceId - Workspace UUID
 * @param resultData - Grading result JSON
 * @param logger - Logger instance
 */
export async function markJobCompleted(
  db: PoolClient | Pool,
  jobId: string,
  workspaceId: string,
  resultData: Record<string, any>,
  logger: Logger
): Promise<void> {
  try {
    await db.query(
      `
      UPDATE grading_jobs
      SET status = 'COMPLETED', completed_at = NOW(),
          result_data = $3, updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2
      `,
      [jobId, workspaceId, JSON.stringify(resultData)]
    )

    logger.debug('Marked job as COMPLETED', {
      job_id: jobId,
      workspace_id: workspaceId,
      score: resultData.score,
      passed: resultData.passed,
    })
  } catch (err) {
    logger.error('Failed to mark job as COMPLETED', {
      job_id: jobId,
      workspace_id: workspaceId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * Mark job as FAILED
 *
 * Called by worker if grading fails after max retries.
 *
 * @param db - Tenant database connection
 * @param jobId - Job UUID
 * @param workspaceId - Workspace UUID
 * @param errorMessage - Error message
 * @param retryCount - Number of retries attempted
 * @param logger - Logger instance
 */
export async function markJobFailed(
  db: PoolClient | Pool,
  jobId: string,
  workspaceId: string,
  errorMessage: string,
  retryCount: number,
  logger: Logger
): Promise<void> {
  try {
    await db.query(
      `
      UPDATE grading_jobs
      SET status = 'FAILED', completed_at = NOW(),
          error_message = $3, retry_count = $4, updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2
      `,
      [jobId, workspaceId, errorMessage, retryCount]
    )

    logger.warn('Marked job as FAILED', {
      job_id: jobId,
      workspace_id: workspaceId,
      error_message: errorMessage,
      retry_count: retryCount,
    })
  } catch (err) {
    logger.error('Failed to mark job as FAILED', {
      job_id: jobId,
      workspace_id: workspaceId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
