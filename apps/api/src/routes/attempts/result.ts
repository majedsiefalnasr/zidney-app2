/**
 * GET /result Endpoint
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase D, T031
 *
 * Route: GET /api/workspaces/:slug/attempts/:id/result
 * Purpose: Poll for async grading result
 * Authorization: RBAC (student owner OR instructor)
 *
 * Poll-Based Result Retrieval:
 * - Client polls after submit
 * - If status IN_PROGRESS: Return 202 with retry_after
 * - If status FINALIZED: Return 200 with complete result
 * - If status EXPIRED: Return 200 with expired message
 *
 * Constitutional Compliance:
 * - ADR-0001: workspace_id on all queries
 * - No business logic (just result retrieval)
 * - Structured logging with correlation_id
 */

import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'
import type { Pool, PoolClient } from 'pg'
import type { UserContextStage06 } from '../../middleware/auth-context-stage06'
import { getJobByAttemptId } from '../../services/job-queue-service'

/**
 * GET /api/workspaces/:slug/attempts/:id/result
 */
export async function getAttemptResultHandler(c: Context) {
  const correlationId = c.get('correlationId') || 'unknown'
  const workspace = c.get('workspace')
  const user = c.get('user') as UserContextStage06
  const tenantDb = c.get('tenantDb') as PoolClient | Pool
  const logger = createLogger('attempts-result')

  try {
    const { id: attemptId = '' } = c.req.param()

    // Optional query parameters
    const pollTimeoutSec = parseInt(c.req.query('poll_timeout') || '2', 10)

    logger.debug('Result polling request', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      attempt_id: attemptId,
      user_id: user.id,
      poll_timeout_s: pollTimeoutSec,
    })

    // =========================================================================
    // 1. LOAD ATTEMPT (VERIFY OWNERSHIP + GET STATUS)
    // =========================================================================

    const attemptResult = await tenantDb.query(
      `
      SELECT id, status, submitted_at, finalized_at, score, passed,
             result_snapshot, user_id, workspace_id
      FROM attempts
      WHERE id = $1 AND workspace_id = $2 AND user_id = $3
      `,
      [attemptId, workspace.id, user.id]
    )

    if (attemptResult.rows.length === 0) {
      logger.warn('Attempt not found for result polling', {
        correlation_id: correlationId,
        workspace_id: workspace.id,
        attempt_id: attemptId,
        user_id: user.id,
      })

      throw {
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found',
        status: 404,
      }
    }

    const attempt = attemptResult.rows[0]

    // =========================================================================
    // 2. CHECK ATTEMPT STATUS
    // =========================================================================

    // If still IN_PROGRESS (not yet submitted)
    if (attempt.status === 'IN_PROGRESS') {
      logger.debug('Attempt still in progress; cannot retrieve result', {
        correlation_id: correlationId,
        attempt_id: attemptId,
      })

      throw {
        code: 'ATTEMPT_NOT_SUBMITTED',
        message: 'Attempt has not been submitted yet',
        status: 409,
      }
    }

    // If EXPIRED (timed out)
    if (attempt.status === 'EXPIRED') {
      logger.info('Attempt has expired', {
        correlation_id: correlationId,
        attempt_id: attemptId,
      })

      return c.json(
        {
          success: true,
          data: {
            id: attemptId,
            status: 'EXPIRED',
            message: 'Attempt time limit exceeded during submission/grading',
            server_time: new Date().toISOString(),
          },
          error: null,
        },
        200
      )
    }

    // If ABORTED
    if (attempt.status === 'ABORTED') {
      logger.info('Attempt was aborted', {
        correlation_id: correlationId,
        attempt_id: attemptId,
      })

      throw {
        code: 'ATTEMPT_ABORTED',
        message: 'Attempt was aborted',
        status: 410,
      }
    }

    // =========================================================================
    // 3. CHECK GRADING JOB STATUS
    // =========================================================================

    const job = await getJobByAttemptId(tenantDb, attemptId, workspace.id, logger)

    if (!job) {
      logger.warn('No grading job found for attempt', {
        correlation_id: correlationId,
        attempt_id: attemptId,
        attempt_status: attempt.status,
      })

      throw {
        code: 'JOB_NOT_FOUND',
        message: 'Grading job not found',
        status: 404,
      }
    }

    // =========================================================================
    // 4. IF JOB STILL PROCESSING, RETURN 202 WITH RETRY_AFTER
    // =========================================================================

    if (job.status === 'PENDING' || job.status === 'PROCESSING') {
      logger.debug('Grading job still processing', {
        correlation_id: correlationId,
        job_id: job.id,
        job_status: job.status,
      })

      // Set Retry-After header (client should wait 2 seconds before next poll)
      c.header('Retry-After', '2')

      return c.json(
        {
          success: true,
          data: {
            id: attemptId,
            status: 'SUBMITTED',
            job_status: job.status,
            job_id: job.id,
            message: 'Grading in progress; please retry',
            retry_after_seconds: 2,
            server_time: new Date().toISOString(),
          },
          error: null,
        },
        202
      )
    }

    // =========================================================================
    // 5. IF JOB FAILED, RETURN ERROR
    // =========================================================================

    if (job.status === 'FAILED') {
      logger.warn('Grading job failed', {
        correlation_id: correlationId,
        attempt_id: attemptId,
        job_id: job.id,
        error_message: job.error_message,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'GRADING_FAILED',
            message: 'Grading failed due to an error. Please contact support.',
            details: {
              job_id: job.id,
              error_message: job.error_message,
              retry_count: job.retry_count,
            },
          },
        },
        500
      )
    }

    // =========================================================================
    // 6. IF JOB COMPLETED, RETURN FINAL RESULT
    // =========================================================================

    if (job.status === 'COMPLETED' && job.result_data) {
      logger.info('Grading completed; returning result', {
        correlation_id: correlationId,
        attempt_id: attemptId,
        job_id: job.id,
        score: job.result_data?.score,
        passed: job.result_data?.passed,
      })

      const resultData =
        typeof job.result_data === 'string' ? JSON.parse(job.result_data) : job.result_data

      return c.json(
        {
          success: true,
          data: {
            id: attemptId,
            status: 'FINALIZED',
            submitted_at: attempt.submitted_at,
            finalized_at: attempt.finalized_at || job.completed_at,
            score: resultData.score,
            passed: resultData.passed,
            result_snapshot: resultData,
            server_time: new Date().toISOString(),
          },
          error: null,
        },
        200
      )
    }

    // =========================================================================
    // 7. UNKNOWN STATE (SHOULD NOT HAPPEN)
    // =========================================================================

    logger.error('Unexpected job state during result polling', {
      correlation_id: correlationId,
      job_id: job.id,
      job_status: job.status,
      attempt_id: attemptId,
    })

    throw {
      code: 'UNEXPECTED_STATE',
      message: 'Unexpected grading state',
      status: 500,
    }
  } catch (err) {
    // Error handling delegated to error normalizer
    logger.error('Result polling failed', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      user_id: user.id,
      error: err instanceof Error ? err.message : String(err),
      code: (err as any).code,
    })
    throw err
  }
}
