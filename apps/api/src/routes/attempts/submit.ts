/**
 * POST /submit Endpoint
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase D, T028
 *
 * Route: POST /api/workspaces/:slug/attempts/:id/submit
 * Status: 202 Accepted (async grading)
 *
 * Purpose: Submit completed attempt for grading
 * Authorization: RBAC (student owner OR instructor)
 *
 * Business Logic Flow (CRITICAL ORDER):
 * 1. Load attempt (tenant-scoped query)
 * 2. Validate time not exceeded (60s grace period)
 * 3. Acquire pessimistic lock (5s timeout, 3 retries)
 * 4. Store submission in database (idempotency key)
 * 5. Update attempt status → SUBMITTED
 * 6. Enqueue grading job
 * 7. Return 202 Accepted with job_id
 *
 * Constitutional Compliance:
 * - ADR-0001: workspace_id on ALL queries
 * - ADR-0002: Snapshot-only grading (no live config)
 * - ADR-0006: Server-authoritative time (NOW() only)
 * - ADR-0002: Attempt must be snapshotted at creation
 * - Pessimistic locking for concurrency
 * - Idempotency triple-layer
 */

import { createLogger } from '@zidney/logger'
import { Context } from 'hono'
import { Pool, PoolClient } from 'pg'
import type { UserContextStage06 } from '../../middleware/auth-context-stage06'
import {
  storeSubmissionIdempotencyKey,
  validateSubmissionIdempotency,
} from '../../services/idempotency-validator'
import { enqueueGradingJob } from '../../services/job-queue-service'
import { executeWithLockRetry } from '../../services/lock-retry-handler'
import { validateSubmissionContent } from '../../services/submission-validator'

/**
 * POST /api/workspaces/:slug/attempts/:id/submit
 */
export async function submitAttemptHandler(c: Context) {
  const correlationId = c.get('correlationId') || 'unknown'
  const workspace = c.get('workspace')
  const user = c.get('user') as UserContextStage06
  const tenantDb = c.get('tenantDb') as PoolClient | Pool
  const redis = c.get('redis') || null
  const logger = createLogger('attempts-submit')

  const startTime = Date.now()

  try {
    const { id: attemptId = '' } = c.req.param()
    const idempotencyKey = c.req.header('x-idempotency-key') || 'no-key'

    // =========================================================================
    // 1. PARSE AND VALIDATE REQUEST BODY
    // =========================================================================

    const body = await c.req.json()

    const {
      reason = 'COMPLETED',
      submission_reason = '',
      all_responses = [],
    } = body

    // Validate reason enum
    if (!['COMPLETED', 'TIME_UP', 'INTERRUPTED'].includes(reason)) {
      logger.warn('Submit validation failed: invalid reason', {
        correlation_id: correlationId,
        workspace_id: workspace.id,
        user_id: user.id,
        attempt_id: attemptId,
        reason,
      })

      throw {
        code: 'VALIDATION_ERROR',
        message: 'Invalid reason; must be COMPLETED, TIME_UP, or INTERRUPTED',
        status: 400,
      }
    }

    // Validate submission is array
    if (!Array.isArray(all_responses)) {
      throw {
        code: 'VALIDATION_ERROR',
        message: 'all_responses must be an array',
        status: 400,
      }
    }

    logger.debug('Parsed submit request', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      attempt_id: attemptId,
      reason,
      response_count: all_responses.length,
    })

    // =========================================================================
    // 2. LOAD ATTEMPT (TENANT-SCOPED QUERY)
    // =========================================================================

    const attemptResult = await tenantDb.query(
      `
      SELECT id, status, started_at, server_start_time,
             time_limit_snapshot, submitted_at, finalized_at,
             question_snapshot, grading_config_snapshot,
             user_id, workspace_id
      FROM attempts
      WHERE id = $1 AND workspace_id = $2 AND user_id = $3
      `,
      [attemptId, workspace.id, user.id]
    )

    if (attemptResult.rows.length === 0) {
      logger.warn('Attempt not found or not owner', {
        correlation_id: correlationId,
        workspace_id: workspace.id,
        attempt_id: attemptId,
        user_id: user.id,
      })

      throw {
        code: 'ATTEMPT_NOT_FOUND',
        message: 'Attempt not found or you do not have permission to submit',
        status: 404,
      }
    }

    const attempt = attemptResult.rows[0]

    // =========================================================================
    // 3. CHECK ATTEMPT STATUS (NOT ALREADY SUBMITTED)
    // =========================================================================

    if (
      attempt.status === 'SUBMITTED' ||
      attempt.status === 'FINALIZED' ||
      attempt.status === 'EXPIRED'
    ) {
      logger.warn('Cannot submit: attempt already in terminal state', {
        correlation_id: correlationId,
        workspace_id: workspace.id,
        attempt_id: attemptId,
        current_status: attempt.status,
      })

      throw {
        code: 'ATTEMPT_INVALID_STATE',
        message: `Cannot submit; attempt is ${attempt.status}`,
        status: 409,
      }
    }

    // =========================================================================
    // 4. VALIDATE TIME NOT EXCEEDED (60S GRACE PERIOD)
    // =========================================================================

    const timeElapsedMs =
      Date.now() - new Date(attempt.server_start_time).getTime()
    const timeLimitMs = (attempt.time_limit_snapshot || 0) * 1000
    const gracePeriodMs = 60 * 1000 // 60 seconds

    if (timeElapsedMs > timeLimitMs + gracePeriodMs) {
      logger.warn('Submit rejected: time limit exceeded (+ grace period)', {
        correlation_id: correlationId,
        workspace_id: workspace.id,
        attempt_id: attemptId,
        time_elapsed_s: Math.floor(timeElapsedMs / 1000),
        time_limit_s: attempt.time_limit_snapshot,
      })

      throw {
        code: 'ATTEMPT_TIME_EXCEEDED',
        message: 'Time limit exceeded; submission not accepted',
        status: 409,
      }
    }

    logger.debug('Time validation passed', {
      correlation_id: correlationId,
      time_elapsed_s: Math.floor(timeElapsedMs / 1000),
      time_limit_s: attempt.time_limit_snapshot,
    })

    // =========================================================================
    // 5. IDEMPOTENCY CHECK (TRIPLE-LAYER)
    // =========================================================================

    const idempotencyResult = await validateSubmissionIdempotency(
      tenantDb,
      redis,
      workspace.id!,
      attemptId,
      idempotencyKey,
      logger,
      correlationId
    )

    if (idempotencyResult.isRetry && idempotencyResult.cachedJobId) {
      logger.info('Submission replay detected; returning cached response', {
        correlation_id: correlationId,
        workspace_id: workspace.id,
        attempt_id: attemptId,
        cached_job_id: idempotencyResult.cachedJobId,
      })

      const now = new Date()
      return c.json(
        {
          success: true,
          data: {
            id: attemptId,
            status: 'SUBMITTED',
            submitted_at: now.toISOString(),
            server_time: now.toISOString(),
            job_id: idempotencyResult.cachedJobId,
            polling_url: `/api/workspaces/${workspace.slug}/attempts/${attemptId}/result`,
            message: 'Cached response (replay)',
          },
          error: null,
        },
        202
      )
    }

    // =========================================================================
    // 6. VALIDATE SUBMISSION CONTENT
    // =========================================================================

    const questionSnapshot = attempt.question_snapshot

    const validationResult = validateSubmissionContent(
      all_responses,
      questionSnapshot,
      logger,
      correlationId
    )

    if (!validationResult.valid) {
      logger.warn('Submission content validation failed', {
        correlation_id: correlationId,
        workspace_id: workspace.id,
        attempt_id: attemptId,
        errors: validationResult.errors,
      })

      throw {
        code: 'SUBMISSION_VALIDATION_ERROR',
        message: 'Submission validation failed',
        details: validationResult.errors,
        status: 400,
      }
    }

    logger.debug('Submission content validation passed', {
      correlation_id: correlationId,
      question_count: all_responses.length,
    })

    // =========================================================================
    // 7. ACQUIRE PESSIMISTIC LOCK + SUBMIT
    // =========================================================================

    // Use lock-retry handler to safely acquire lock and submit
    // This ensures atomic update + job enqueue within lock scope

    const result = await executeWithLockRetry(
      tenantDb,
      attemptId,
      workspace.id!,
      async (lockedAttempt) => {
        // Inside lock: re-verify attempt status (double-check after lock)
        if (
          lockedAttempt.status === 'SUBMITTED' ||
          lockedAttempt.status === 'FINALIZED' ||
          lockedAttempt.status === 'EXPIRED'
        ) {
          const err = new Error(`Attempt is ${lockedAttempt.status}`)
          ;(err as any).code = 'ATTEMPT_INVALID_STATE'
          ;(err as any).statusCode = 409
          throw err
        }

        // =====================================================================
        // 8. STORE SUBMISSION IN DATABASE (BEFORE WORKER PROCESSES)
        // =====================================================================

        const submissionSequence =
          (idempotencyResult.submissionSequence || 0) + 1

        const submissionResult = await tenantDb.query(
          `
          INSERT INTO attempt_submissions (
            id, attempt_id, workspace_id, user_id,
            submission_reason, submitted_at,
            all_responses, idempotency_key, submission_sequence
          ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
          RETURNING id, submitted_at
          `,
          [
            crypto.randomUUID(),
            attemptId,
            workspace.id,
            user.id,
            submission_reason,
            JSON.stringify(all_responses),
            idempotencyKey,
            submissionSequence,
          ]
        )

        if (submissionResult.rows.length === 0) {
          throw new Error('Failed to store submission')
        }

        logger.debug('Stored submission in database', {
          correlation_id: correlationId,
          submission_sequence: submissionSequence,
          response_count: all_responses.length,
        })

        // =====================================================================
        // 9. UPDATE ATTEMPT STATUS → SUBMITTED
        // =====================================================================

        await tenantDb.query(
          `
          UPDATE attempts
          SET status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND workspace_id = $2
          `,
          [attemptId, workspace.id]
        )

        logger.debug('Updated attempt status to SUBMITTED', {
          correlation_id: correlationId,
          attempt_id: attemptId,
        })

        // =====================================================================
        // 10. ENQUEUE GRADING JOB
        // =====================================================================

        const job = await enqueueGradingJob(
          tenantDb,
          redis,
          attemptId,
          workspace.id!,
          user.id,
          logger,
          correlationId
        )

        logger.info('Grading job enqueued', {
          correlation_id: correlationId,
          workspace_id: workspace.id,
          attempt_id: attemptId,
          job_id: job.id,
          elapsed_ms: Date.now() - startTime,
        })

        // =====================================================================
        // 11. STORE IDEMPOTENCY KEY FOR FUTURE REPLAY
        // =====================================================================

        const now = new Date()
        const responseBody = {
          success: true,
          data: {
            id: attemptId,
            status: 'SUBMITTED',
            submitted_at: now.toISOString(),
            server_time: now.toISOString(),
            job_id: job.id,
            polling_url: `/api/workspaces/${workspace.slug}/attempts/${attemptId}/result`,
          },
          error: null,
        }

        await storeSubmissionIdempotencyKey(
          tenantDb,
          redis,
          workspace.id,
          attemptId!,
          idempotencyKey,
          submissionSequence,
          202,
          responseBody,
          logger,
          correlationId
        )

        return {
          jobId: job.id,
          submittedAt: now,
        }
      },
      {
        maxRetries: 3,
        correlationId,
      }
    )

    // =========================================================================
    // 12. RETURN 202 ACCEPTED
    // =========================================================================

    logger.info('Attempt submitted successfully', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      attempt_id: attemptId,
      // @ts-ignore: LOGIC-BUG: result type unknown - see INFRA-001-LOGIC-09
      job_id: result.jobId,
      elapsed_ms: Date.now() - startTime,
    })

    return c.json(
      {
        success: true,
        data: {
          id: attemptId,
          status: 'SUBMITTED',
          // @ts-ignore: LOGIC-BUG: result type unknown - see INFRA-001-LOGIC-09
          submitted_at: result.submittedAt.toISOString(),
          // @ts-ignore: LOGIC-BUG: result type unknown - see INFRA-001-LOGIC-09
          server_time: result.submittedAt.toISOString(),
          // @ts-ignore: LOGIC-BUG: result type unknown - see INFRA-001-LOGIC-09
          job_id: result.jobId,
          polling_url: `/api/workspaces/${workspace.slug}/attempts/${attemptId}/result`,
        },
        error: null,
      },
      202
    )
  } catch (err) {
    // Error handling delegated to error normalizer middleware
    logger.error('Attempt submit failed', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      user_id: user.id,
      error: err instanceof Error ? err.message : String(err),
      code: (err as any).code,
    })
    throw err
  }
}
