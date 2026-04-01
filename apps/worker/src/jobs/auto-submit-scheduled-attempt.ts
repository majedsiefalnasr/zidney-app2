/**
 * Auto-Submit Scheduled Attempt Job Handler
 *
 * File: apps/worker/src/jobs/auto-submit-scheduled-attempt.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE
 *
 * Handles force-submission of expired scheduled exam attempts.
 * Uses Redis distributed lock + inner transaction SELECT FOR UPDATE to prevent double-submission.
 *
 * Algorithm:
 * 1. Acquire Redis lock auto_submit_lock:{attemptId} with NX+PX=60s
 * 2. If lock not acquired → skip (another worker is processing)
 * 3. BEGIN transaction
 * 4. SELECT attempts WHERE id=$1 FOR UPDATE
 * 5. Re-check: if already submitted → ROLLBACK + release lock → idempotent skip
 * 6. Determine forced_submission_reason priority
 * 7. UPDATE attempts SET auto_submitted=true, status='SUBMITTED', submitted_at=NOW(),
 *    forced_submission_reason=$reason WHERE id=$1
 * 8. COMMIT
 * 9. Release Redis lock
 * 10. WARN log with correlation fields
 */

import type { AutoSubmitScheduledAttemptJob } from '@zidney/job-queue/types'
import { createLogger } from '@zidney/logger'
import type { RedisClientType } from 'redis'

const logger = createLogger('worker:auto-submit-scheduled-attempt')

interface DbPool {
  connect(): Promise<DbClient>
}

interface DbClient {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount?: number | null }>
  release(): void
}

/**
 * Handle auto-submit for a scheduled attempt.
 *
 * @param job - The auto-submit job payload
 * @param pool - Tenant database pool
 * @param redis - Redis client for distributed lock
 */
export async function handleAutoSubmitScheduledAttempt(
  job: AutoSubmitScheduledAttemptJob,
  pool: DbPool,
  redis: RedisClientType
): Promise<void> {
  const { attempt_id, scheduled_exam_id, forced_submission_reason, correlation_id, workspace_id } =
    job

  const lockKey = `auto_submit_lock:${attempt_id}`
  const lockTtlMs = 60_000

  // 1. Acquire Redis distributed lock (NX = only set if not exists, PX = TTL in ms)
  const lockAcquired = await redis.set(lockKey, '1', { NX: true, PX: lockTtlMs })
  if (!lockAcquired) {
    logger.warn('Auto-submit lock not acquired — skipping (another worker is processing)', {
      correlation_id,
      workspace_id,
      attempt_id,
      scheduled_exam_id,
    })
    return
  }

  const client = await pool.connect()
  try {
    // 2. Begin transaction
    await client.query('BEGIN')

    // 3. SELECT FOR UPDATE to prevent concurrent submissions
    const attemptResult = await client.query<{
      id: string
      status: string
      auto_submitted: boolean
      submitted_at: string | null
      scheduled_end_time: string | null
      last_heartbeat_at: string | null
    }>(
      `SELECT id, status, auto_submitted, submitted_at, scheduled_end_time, last_heartbeat_at
       FROM attempts
       WHERE id = $1
       FOR UPDATE`,
      [attempt_id]
    )

    const attempt = attemptResult.rows[0]

    // 4. Idempotent skip — already submitted
    if (!attempt || attempt.status === 'SUBMITTED' || attempt.auto_submitted) {
      await client.query('ROLLBACK')
      logger.warn('Auto-submit skipped — attempt already submitted (idempotent)', {
        correlation_id,
        workspace_id,
        attempt_id,
        scheduled_exam_id,
        status: attempt?.status,
      })
      return
    }

    // 4b. Re-evaluate timeout eligibility after lock acquisition
    const now = new Date()
    const connectionTimeoutMs = 30_000
    let stillExpired = false

    if (attempt.last_heartbeat_at) {
      const timeSinceHeartbeat = now.getTime() - new Date(attempt.last_heartbeat_at).getTime()
      if (timeSinceHeartbeat > connectionTimeoutMs) {
        stillExpired = true
      }
    }

    if (attempt.scheduled_end_time && now <= new Date(attempt.scheduled_end_time)) {
      stillExpired = true
    }

    if (!stillExpired) {
      await client.query('ROLLBACK')
      logger.info(
        'Auto-submit skipped — attempt no longer eligible (heartbeat recent or window open)',
        {
          correlation_id,
          workspace_id,
          attempt_id,
          scheduled_exam_id,
          last_heartbeat_at: attempt.last_heartbeat_at,
          scheduled_end_time: attempt.scheduled_end_time,
        }
      )
      return
    }

    // 5. Determine forced_submission_reason (job-provided reason is authoritative)
    const reason = forced_submission_reason

    // 6. Force submit
    await client.query(
      `UPDATE attempts
       SET
         status = 'SUBMITTED',
         auto_submitted = TRUE,
         forced_submission_reason = $2,
         submitted_at = NOW(),
         updated_at = NOW()
       WHERE id = $1`,
      [attempt_id, reason]
    )

    await client.query('COMMIT')

    logger.warn('Scheduled attempt force-submitted', {
      correlation_id,
      workspace_id,
      attempt_id,
      scheduled_exam_id,
      forced_submission_reason: reason,
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    logger.error('Auto-submit transaction failed — attempt remains active for next cycle', {
      correlation_id,
      workspace_id,
      attempt_id,
      scheduled_exam_id,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    throw err
  } finally {
    client.release()
    // Release distributed lock
    await redis.del(lockKey).catch(() => {})
  }
}
