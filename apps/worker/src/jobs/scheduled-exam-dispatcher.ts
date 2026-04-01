/**
 * Scheduled Exam Dispatcher Job Handler
 *
 * File: apps/worker/src/jobs/scheduled-exam-dispatcher.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 *
 * Repeatable job (every 30s) that scans ALL active tenants for scheduled exam attempts
 * that need force-submission. A query error in one tenant must NOT abort the entire cycle.
 *
 * Algorithm per cycle:
 * 1. Query master DB for all active workspace slugs
 * 2. For each workspace (in parallel, capped):
 *    a. Build DB name: workspace_{slug}
 *    b. Connect to tenant DB
 *    c. Query active (not SUBMITTED) scheduled attempts where:
 *       - scheduled_end_time <= NOW() (window expired), OR
 *       - attempt_end_time <= NOW() (duration expired), OR
 *       - last_heartbeat_at <= NOW() - 30s (connection timeout)
 *    d. For each matching attempt → enqueue auto_submit_scheduled_attempt job (dedup by attemptId)
 * 3. Log summary with counts per tenant
 */

import type { ForcedSubmissionReason } from '@zidney/job-queue/types'
import { createLogger } from '@zidney/logger'
import type { Pool } from 'pg'
import type { RedisClientType } from 'redis'
import { v4 as uuidv4 } from 'uuid'

const logger = createLogger('worker:scheduled-exam-dispatcher')

interface MasterDbPool {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount?: number | null }>
}

interface WorkspaceRow {
  slug: string
  db_name: string
}

interface ExpiredAttemptRow {
  attempt_id: string
  scheduled_exam_id: string
  workspace_id: string
  workspace_slug: string
  scheduled_end_time: string
  attempt_end_time: string | null
  last_heartbeat_at: string | null
}

/**
 * Determine force-submission reason for an expired attempt (priority order).
 */
function determineForcedReason(attempt: ExpiredAttemptRow, now: Date): ForcedSubmissionReason {
  const connectionTimeoutMs = 30_000

  if (
    attempt.last_heartbeat_at &&
    now.getTime() - new Date(attempt.last_heartbeat_at).getTime() > connectionTimeoutMs
  ) {
    return 'CONNECTION_TIMEOUT'
  }
  if (attempt.attempt_end_time && now <= new Date(attempt.attempt_end_time)) {
    return 'SCHEDULED_END_REACHED'
  }
  return 'ATTEMPT_TIME_EXCEEDED'
}

/**
 * Run one dispatcher cycle.
 *
 * @param masterDb - Master database pool (read-only: SELECT workspaces)
 * @param getTenantPool - Factory to get or create a Pool for a tenant DB name
 * @param redis - Redis client for job enqueue deduplication
 * @param correlationId - Correlation ID for this dispatch cycle
 */
export async function runScheduledExamDispatcherCycle(
  masterDb: MasterDbPool,
  getTenantPool: (dbName: string) => Promise<Pool>,
  redis: RedisClientType,
  correlationId: string = uuidv4()
): Promise<void> {
  const now = new Date()

  logger.info('Scheduled exam dispatcher cycle started', {
    correlation_id: correlationId,
    dispatched_at: now.toISOString(),
  })

  // 1. Load active workspace slugs from master DB
  let workspaces: WorkspaceRow[]
  try {
    const result = await masterDb.query<WorkspaceRow>(
      `SELECT slug, CONCAT('workspace_', slug) AS db_name
       FROM workspaces
       WHERE deleted_at IS NULL
         AND is_active = TRUE
       ORDER BY slug`
    )
    workspaces = result.rows
  } catch (err) {
    logger.error('Dispatcher: failed to load workspaces from master DB', {
      correlation_id: correlationId,
      error: err instanceof Error ? err.message : String(err),
    })
    return
  }

  let totalEnqueued = 0
  let totalErrors = 0

  // 2. Process each tenant independently — errors in one tenant must not abort others
  for (const ws of workspaces) {
    try {
      const pool = await getTenantPool(ws.db_name)
      const client = await pool.connect()

      let expiredAttempts: ExpiredAttemptRow[]
      try {
        const result = await client.query<ExpiredAttemptRow>(
          `SELECT
             a.id AS attempt_id,
             a.scheduled_exam_id,
             a.workspace_id,
             $1 AS workspace_slug,
             se.end_datetime AS scheduled_end_time,
             a.scheduled_end_time AS attempt_end_time,
             a.last_heartbeat_at
           FROM attempts a
           JOIN scheduled_exams se ON se.id = a.scheduled_exam_id
           WHERE a.is_scheduled = TRUE
             AND a.status != 'SUBMITTED'
             AND a.auto_submitted = FALSE
             AND (
               se.end_datetime <= NOW()
               OR a.scheduled_end_time <= NOW()
               OR (
                 a.last_heartbeat_at IS NOT NULL
                 AND a.last_heartbeat_at <= NOW() - INTERVAL '30 seconds'
               )
             )`,
          [ws.slug]
        )
        expiredAttempts = result.rows
      } finally {
        client.release()
      }

      // 3. Enqueue auto-submit jobs with dedup key
      for (const attempt of expiredAttempts) {
        const dedupKey = `auto_submit_job_enqueued:${attempt.attempt_id}`
        const alreadyEnqueued = await redis.exists(dedupKey)
        if (alreadyEnqueued) continue

        const reason = determineForcedReason(attempt, now)
        const jobPayload = {
          job_id: uuidv4(),
          type: 'auto_submit_scheduled_attempt',
          workspace_id: attempt.workspace_id,
          workspace_slug: ws.slug,
          user_id: 'SYSTEM',
          correlation_id: correlationId,
          created_at: now.toISOString(),
          retry_count: 0,
          max_retries: 3,
          attempt_id: attempt.attempt_id,
          scheduled_exam_id: attempt.scheduled_exam_id,
          forced_submission_reason: reason,
        }

        const queueKey = `queue:auto_submit_scheduled_attempt`
        await redis.lPush(queueKey, JSON.stringify(jobPayload))

        // Mark as enqueued for 120s to prevent re-enqueue in next cycle
        await redis.set(dedupKey, '1', { EX: 120 })
        totalEnqueued++

        logger.info('Auto-submit job enqueued', {
          correlation_id: correlationId,
          workspace_slug: ws.slug,
          attempt_id: attempt.attempt_id,
          scheduled_exam_id: attempt.scheduled_exam_id,
          forced_submission_reason: reason,
        })
      }
    } catch (err) {
      // Error in one tenant must NOT abort the cycle
      totalErrors++
      logger.error('Dispatcher: error processing tenant — continuing with others', {
        correlation_id: correlationId,
        workspace_slug: ws.slug,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  logger.info('Scheduled exam dispatcher cycle completed', {
    correlation_id: correlationId,
    workspaces_processed: workspaces.length,
    jobs_enqueued: totalEnqueued,
    tenant_errors: totalErrors,
  })
}
