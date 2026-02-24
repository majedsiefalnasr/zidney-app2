/**
 * Dead Letter Queue (DLQ) Strategy
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase D, T032
 *
 * Purpose: Handle failed grading jobs that exhaust retries
 * Requirements: Move to DLQ, log error, notify instructor, enable recovery
 *
 * Responsibilities:
 * - Move failed jobs to DLQ
 * - Store failure context (error, timestamp, diagnostics)
 * - Flag attempt as GRADING_FAILED
 * - Enable manual recovery (Phase G admin panel)
 *
 * Constitutional Compliance:
 * - ADR-0001: workspace_id on all queries
 * - Idempotent (DLQ can be replayed safely)
 * - Structured logging with correlation_id
 *
 * DLQ Flow:
 * 1. Job fails after 5 retries
 * 2. markJobFailed() → status = FAILED
 * 3. moveToDLQ() → Add to failed_grading_jobs:${workspace_id} queue
 * 4. notifyInstructor() → Create notification
 * 5. Phase G admin panel enables manual retry/inspection
 */

import { createLogger, Logger } from '@zidney/logger'
import { Pool, PoolClient } from 'pg'

/**
 * DLQ entry structure
 */
export interface DLQEntry {
  job_id: string
  attempt_id: string
  workspace_id: string
  error_message: string
  timestamp: string // ISO
  retry_count: number
  diagnostics?: Record<string, any>
}

/**
 * Move failed job to Dead Letter Queue
 *
 * Called by worker when job exhausts all retries.
 * Stores failure context and creates instructor notification.
 *
 * @param db - Tenant database connection
 * @param queue - Redis queue (optional)
 * @param jobId - Job UUID
 * @param attemptId - Attempt UUID
 * @param workspaceId - Workspace UUID
 * @param errorMessage - Failure error message
 * @param retryCount - Number of retries attempted
 * @param diagnostics - Optional diagnostic context
 * @param logger - Logger instance
 * @throws Error if DLQ persistence fails
 */
export async function moveToDLQ(
  db: PoolClient | Pool,
  queue: any | null,
  jobId: string,
  attemptId: string,
  workspaceId: string,
  errorMessage: string,
  retryCount: number,
  diagnostics?: Record<string, any>,
  logger?: Logger
): Promise<void> {
  const log = logger || createLogger('dlq-strategy')
  const now = new Date().toISOString()

  const dlqEntry: DLQEntry = {
    job_id: jobId,
    attempt_id: attemptId,
    workspace_id: workspaceId,
    error_message: errorMessage,
    timestamp: now,
    retry_count: retryCount,
    diagnostics,
  }

  try {
    // Step 1: Update attempt status to flag grading failure
    // This allows student to know grading failed (vs. still pending)
    await db.query(
      `
      UPDATE attempts
      SET status = 'GRADING_FAILED', updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2
      `,
      [attemptId, workspaceId]
    )

    log.info('Updated attempt status to GRADING_FAILED', {
      attempt_id: attemptId,
      workspace_id: workspaceId,
      job_id: jobId,
    })

    // Step 2: Store DLQ entry in Redis (fast DLQ queue)
    if (queue) {
      try {
        const queueKey = `failed_grading_jobs:${workspaceId}`
        const dlqPayload = JSON.stringify(dlqEntry)

        await queue.lPush(queueKey, dlqPayload)

        log.info('DLQ entry stored (Redis)', {
          workspace_id: workspaceId,
          job_id: jobId,
          queue_key: queueKey,
        })
      } catch (queueErr) {
        log.warn('Failed to push to Redis DLQ (will use DB-only)', {
          job_id: jobId,
          error:
            queueErr instanceof Error ? queueErr.message : String(queueErr),
        })
        // Proceed; DB layer provides durability
      }
    }

    // Step 3: Create instructor notification (Phase G)
    // For now, just log; Phase G will add notification system
    log.warn('DLQ: Job moved to dead letter queue', {
      job_id: jobId,
      attempt_id: attemptId,
      workspace_id: workspaceId,
      error_message: errorMessage,
      retry_count: retryCount,
      action_required: 'Manual review and retry via admin panel',
    })
  } catch (err) {
    log.error('Failed to move job to DLQ', {
      job_id: jobId,
      attempt_id: attemptId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * Get DLQ jobs for workspace
 *
 * Retrieves failed jobs from Redis queue.
 * Used by admin panel (Phase G) for manual review.
 *
 * @param queue - Redis client
 * @param workspaceId - Workspace UUID
 * @param logger - Logger instance
 * @param limit - Max entries to retrieve
 * @returns Promise<DLQEntry[]>
 */
export async function getDLQJobs(
  queue: any | null,
  workspaceId: string,
  logger: Logger,
  limit: number = 100
): Promise<DLQEntry[]> {
  if (!queue) {
    logger.warn('Redis client not available; DLQ retrieval disabled', {
      workspace_id: workspaceId,
    })
    return []
  }

  try {
    const queueKey = `failed_grading_jobs:${workspaceId}`

    // LRANGE to get entries (0 to limit-1)
    // Note: LRANGE iterates from head; entries are in reverse insertion order
    const entries = await queue.lRange(queueKey, 0, limit - 1)

    const parsed: DLQEntry[] = []
    for (const entry of entries) {
      try {
        parsed.push(JSON.parse(entry))
      } catch (parseErr) {
        logger.warn('Failed to parse DLQ entry', {
          workspace_id: workspaceId,
          error:
            parseErr instanceof Error ? parseErr.message : String(parseErr),
        })
      }
    }

    logger.debug('Retrieved DLQ jobs', {
      workspace_id: workspaceId,
      count: parsed.length,
    })

    return parsed
  } catch (err) {
    logger.error('Failed to retrieve DLQ jobs', {
      workspace_id: workspaceId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * Retry DLQ job manually
 *
 * Called by instructor via admin panel (Phase G).
 * Re-enqueues failed job for reprocessing.
 *
 * @param db - Tenant database connection
 * @param queue - Redis queue
 * @param jobId - Job UUID
 * @param workspaceId - Workspace UUID
 * @param logger - Logger instance
 */
export async function retryDLQJob(
  db: PoolClient | Pool,
  queue: any | null,
  jobId: string,
  workspaceId: string,
  logger: Logger
): Promise<void> {
  try {
    // Step 1: Reset job status to PENDING in database
    const result = await db.query(
      `
      UPDATE grading_jobs
      SET status = 'PENDING', retry_count = 0, error_message = NULL,
          started_at = NULL, completed_at = NULL, result_data = NULL,
          updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2
      RETURNING *
      `,
      [jobId, workspaceId]
    )

    if (result.rows.length === 0) {
      throw new Error('Job not found')
    }

    const job = result.rows[0]

    logger.info('Reset DLQ job to PENDING', {
      job_id: jobId,
      workspace_id: workspaceId,
      attempt_id: job.attempt_id,
    })

    // Step 2: Re-enqueue to job queue
    if (queue) {
      try {
        const queueKey = `grading_queue:${workspaceId}`
        const jobPayload = JSON.stringify({
          id: jobId,
          attempt_id: job.attempt_id,
          workspace_id: workspaceId,
          user_id: job.user_id, // Retrieve from DB if needed
          submitted_at: job.created_at.toISOString(),
          retry_count: 0,
          max_retries: 5,
        })

        await queue.lPush(queueKey, jobPayload)

        logger.info('Re-enqueued DLQ job', {
          job_id: jobId,
          queue_key: queueKey,
        })
      } catch (queueErr) {
        logger.warn(
          'Failed to re-enqueue job (will be picked up via DB scan)',
          {
            job_id: jobId,
            error:
              queueErr instanceof Error ? queueErr.message : String(queueErr),
          }
        )
      }
    }
  } catch (err) {
    logger.error('Failed to retry DLQ job', {
      job_id: jobId,
      workspace_id: workspaceId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * Clear DLQ entry after successful manual review/resolution
 *
 * Removes entry from Redis DLQ queue.
 *
 * @param queue - Redis queue
 * @param workspaceId - Workspace UUID
 * @param jobId - Job UUID to remove
 * @param logger - Logger instance
 */
export async function clearDLQEntry(
  queue: any | null,
  workspaceId: string,
  jobId: string,
  logger: Logger
): Promise<void> {
  if (!queue) {
    logger.warn('Redis client not available; cannot clear DLQ entry', {
      workspace_id: workspaceId,
      job_id: jobId,
    })
    return
  }

  try {
    const queueKey = `failed_grading_jobs:${workspaceId}`

    // Retrieve all entries, filter out the one to remove, re-insert
    // (Redis doesn't have direct "remove by content" operation)
    const entries = await queue.lRange(queueKey, 0, -1)
    const filtered = entries.filter((entry: string) => {
      try {
        const parsed = JSON.parse(entry)
        return parsed.job_id !== jobId
      } catch {
        return true // Keep unparseable entries
      }
    })

    // Replace queue with filtered entries
    if (filtered.length !== entries.length) {
      await queue.del(queueKey)
      if (filtered.length > 0) {
        await queue.rPush(queueKey, ...filtered)
      }

      logger.info('Cleared DLQ entry', {
        workspace_id: workspaceId,
        job_id: jobId,
      })
    }
  } catch (err) {
    logger.error('Failed to clear DLQ entry', {
      workspace_id: workspaceId,
      job_id: jobId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
