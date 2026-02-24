/**
 * Get Attempt Status Endpoint
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase C, T026
 *
 * Route: GET /api/workspaces/:slug/attempts/:id
 * Purpose: Retrieve attempt status and progress metadata
 * Authorization: RBAC (student owns attempt, instructor/admin with permission)
 *
 * Business Flow:
 * 1. Load attempt from database
 * 2. Verify user has access (owner or admin)
 * 3. Count progress (answered, flagged questions)
 * 4. Calculate time remaining
 * 5. Return 200 OK with status details
 *
 * Response varies by status:
 * - IN_PROGRESS: progress counts, time remaining
 * - SUBMITTED: submitted_at timestamp
 * - FINALIZED: score, passed, result
 * - EXPIRED: expiration time
 *
 * Constitutional Compliance:
 * - ADR-0001: workspace_id filter on all queries
 * - ADR-0006: Server-authoritative time (NOW() only)
 * - No cross-tenant data access
 * - Read-only (no mutations)
 * - Structured logging with correlation_id
 */

import { createLogger } from '@zidney/logger'
import { Context } from 'hono'
import { Pool, PoolClient } from 'pg'
import {
  countAnsweredQuestions,
  countFlaggedQuestions,
  findAttemptById,
} from '../../db/attempt-queries'
import type { UserContextStage06 } from '../../middleware/auth-context-stage06'

/**
 * GET /api/workspaces/:slug/attempts/:id
 *
 * Get attempt status endpoint
 */
export async function getAttemptStatusHandler(c: Context) {
  const correlationId = c.get('correlationId') || 'unknown'
  const workspace = c.get('workspace')
  const user = c.get('user') as UserContextStage06
  const tenantDb = c.get('tenantDb') as PoolClient | Pool
  const logger = createLogger('attempts-status')

  const startTime = Date.now()
  const attemptId = c.req.param('id')

  // 1. Load attempt
  const attempt = await findAttemptById(tenantDb, workspace.id, attemptId)

  if (!attempt) {
    logger.warn('Attempt status fetch failed: not found', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      attempt_id: attemptId,
    })

    throw {
      code: 'ATTEMPT_NOT_FOUND',
      message: 'Attempt not found',
      status: 404,
    }
  }

  // 2. Verify access control
  // Students can only see their own attempts
  // Instructors/admins need explicit permission (simplified for now)
  if (attempt.user_id !== user.id) {
    // Check if user is instructor/admin with permission
    const hasPermission =
      user.roles?.includes('INSTRUCTOR') || user.roles?.includes('ADMIN')

    if (!hasPermission) {
      logger.warn('Attempt status fetch failed: access denied', {
        correlation_id: correlationId,
        workspace_id: workspace.id,
        attempt_id: attemptId,
        user_id: user.id,
        attempt_user_id: attempt.user_id,
      })

      throw {
        code: 'FORBIDDEN',
        message: 'You do not have permission to view this attempt',
        status: 403,
      }
    }
  }

  // 3. Build response based on status
  let responseData: any = {
    id: attemptId,
    workspace_id: workspace.id,
    user_id: attempt.user_id,
    exam_id: attempt.exam_id,
    status: attempt.status,
    started_at: attempt.started_at.toISOString(),
    server_start_time: attempt.server_start_time.toISOString(),
    submitted: attempt.status === 'SUBMITTED' || attempt.status === 'FINALIZED',
    finalized: attempt.status === 'FINALIZED',
  }

  if (attempt.status === 'IN_PROGRESS') {
    // Count answered and flagged questions
    const answeredCount = await countAnsweredQuestions(tenantDb, attemptId)
    const flaggedCount = await countFlaggedQuestions(tenantDb, attemptId)

    // Calculate time remaining
    const now = Date.now()
    const startedTime = attempt.started_at.getTime()
    const elapsedSeconds = Math.floor((now - startedTime) / 1000)

    let timeRemaining = null
    if (attempt.time_limit_snapshot) {
      timeRemaining = Math.max(0, attempt.time_limit_snapshot - elapsedSeconds)
    }

    responseData = {
      ...responseData,
      mode: attempt.mode,
      time_limit_seconds: attempt.time_limit_snapshot,
      time_remaining_seconds: timeRemaining,
      progress: {
        answered_count: answeredCount,
        flagged_count: flaggedCount,
        total_questions: attempt.question_snapshot.questions.length,
      },
    }
  } else if (attempt.status === 'SUBMITTED') {
    responseData = {
      ...responseData,
      submitted_at: attempt.submitted_at?.toISOString() || null,
      score: attempt.score,
      passed: attempt.passed,
    }
  } else if (attempt.status === 'FINALIZED') {
    responseData = {
      ...responseData,
      submitted_at: attempt.submitted_at?.toISOString() || null,
      finalized_at: attempt.finalized_at?.toISOString() || null,
      score: attempt.score,
      passed: attempt.passed,
      result: attempt.result_snapshot || null,
    }
  } else if (attempt.status === 'EXPIRED') {
    const expirationTime = new Date(
      attempt.started_at.getTime() + (attempt.time_limit_snapshot || 0) * 1000
    )

    responseData = {
      ...responseData,
      expired_at: expirationTime.toISOString(),
      time_limit_seconds: attempt.time_limit_snapshot,
    }
  }

  // Log success
  logger.info('attempt_status_retrieved', {
    attempt_id: attemptId,
    workspace_id: workspace.id,
    user_id: user.id,
    status: attempt.status,
    correlation_id: correlationId,
    elapsed_ms: Date.now() - startTime,
  })

  // Return 200 OK
  return c.json({
    success: true,
    data: responseData,
    error: null,
  })
}
