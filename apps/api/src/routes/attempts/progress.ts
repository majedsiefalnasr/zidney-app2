/**
 * Progress Update Endpoint
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase C, T025
 *
 * Route: PATCH /api/workspaces/:slug/attempts/:id/progress
 * Purpose: Autosave student progress (idempotent upsert)
 * Authorization: RBAC (only attempt owner)
 *
 * Business Flow:
 * 1. Load attempt (validate exists, belongs to user)
 * 2. Verify status is IN_PROGRESS
 * 3. For each response:
 *    - Validate question in snapshot
 *    - Validate response format
 *    - UPSERT into attempt_progress (idempotent)
 * 4. Calculate time remaining
 * 5. Return 200 OK
 *
 * Idempotency:
 * - UNIQUE(attempt_id, question_id) ON CONFLICT DO UPDATE
 * - Same request (different correlation_ids) = same result
 *
 * Constitutional Compliance:
 * - ADR-0001: workspace_id filter on attempt load
 * - ADR-0002: Snapshot immutability (only read, never modify)
 * - ADR-0006: Server-authoritative time (NOW() only)
 * - No cross-tenant data access
 * - Structured logging with correlation_id
 */

import { Context } from 'hono'
import { Pool, PoolClient } from 'pg'
import { v4 as uuidv4 } from 'uuid'
import { findAttemptById } from '../db/attempt-queries'
import type { UserContextStage06 } from '../middleware/auth-context-stage06'
import {
  validateProgressUpdateRequestFormat,
  validateTimeNotExceeded,
} from '../services/attempt-input-validator'
import { validateResponseForQuestionType } from '../services/question-response-handler'
import Logger from '../utils/logger'

/**
 * PATCH /api/workspaces/:slug/attempts/:id/progress
 *
 * Update attempt progress endpoint
 */
export async function updateProgressHandler(c: Context) {
  const correlationId = c.get('correlationId') || 'unknown'
  const workspace = c.get('workspace')
  const user = c.get('user') as UserContextStage06
  const tenantDb = c.get('tenantDb') as PoolClient | Pool
  const logger = new Logger('attempts-progress')

  const startTime = Date.now()
  const attemptId = c.req.param('id')

  try {
    // 1. Validate request format
    const body = await c.req.json()
    const requestValidation = validateProgressUpdateRequestFormat(body)

    if (!requestValidation.valid) {
      logger.warn('Progress update failed: invalid format', {
        correlation_id: correlationId,
        workspace_id: workspace.id,
        attempt_id: attemptId,
        errors: requestValidation.errors,
      })

      throw {
        code: 'VALIDATION_ERROR',
        message: requestValidation.errors?.[0] || 'Invalid request format',
        status: 400,
      }
    }

    // 2. Load attempt
    const attempt = await findAttemptById(tenantDb, workspace.id, attemptId)

    if (!attempt) {
      logger.warn('Progress update failed: attempt not found', {
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

    // 3. Verify user owns attempt
    if (attempt.user_id !== user.id) {
      logger.warn('Progress update failed: user not owner', {
        correlation_id: correlationId,
        workspace_id: workspace.id,
        attempt_id: attemptId,
        user_id: user.id,
        attempt_user_id: attempt.user_id,
      })

      throw {
        code: 'FORBIDDEN',
        message: 'You do not have permission to update this attempt',
        status: 403,
      }
    }

    // 4. Verify status is IN_PROGRESS
    if (attempt.status !== 'IN_PROGRESS') {
      logger.warn('Progress update failed: invalid status', {
        correlation_id: correlationId,
        workspace_id: workspace.id,
        attempt_id: attemptId,
        status: attempt.status,
      })

      throw {
        code: 'ATTEMPT_INVALID_STATUS',
        message: `Cannot update attempt with status ${attempt.status}`,
        status: 409,
      }
    }

    // 5. Validate time not exceeded
    const timeValidation = validateTimeNotExceeded(
      attempt.started_at,
      attempt.time_limit_snapshot,
      attempt.mode
    )

    if (!timeValidation.valid) {
      logger.warn('Progress update failed: time exceeded', {
        correlation_id: correlationId,
        workspace_id: workspace.id,
        attempt_id: attemptId,
      })

      throw {
        code: 'ATTEMPT_EXPIRED',
        message: 'Time limit exceeded for this attempt',
        status: 410,
      }
    }

    const timeRemaining = timeValidation.data?.time_remaining_seconds

    // 6. Process responses and upsert
    const responses = requestValidation.data.responses || []
    let responsesSaved = 0

    const now = new Date()

    for (const response of responses) {
      const { question_index, user_response } = response

      // Validate question exists in snapshot
      if (
        question_index < 0 ||
        question_index >= attempt.question_snapshot.questions.length
      ) {
        logger.warn('Progress update failed: invalid question index', {
          correlation_id: correlationId,
          attempt_id: attemptId,
          question_index,
          max_questions: attempt.question_snapshot.questions.length,
        })

        throw {
          code: 'INVALID_QUESTION_INDEX',
          message: `Question index ${question_index} out of range`,
          status: 400,
        }
      }

      const question = attempt.question_snapshot.questions[question_index]

      // Validate response format for this question type
      const responseValidation = validateResponseForQuestionType(
        user_response,
        question.type,
        question.options,
        logger
      )

      if (!responseValidation.valid) {
        logger.warn('Progress update failed: invalid response', {
          correlation_id: correlationId,
          attempt_id: attemptId,
          question_id: question.id,
          errors: responseValidation.errors,
        })

        throw {
          code: 'INVALID_RESPONSE_FORMAT',
          message: responseValidation.errors?.[0] || 'Invalid response format',
          status: 422,
        }
      }

      // Upsert progress record (idempotent)
      await tenantDb.query(
        `
        INSERT INTO attempt_progress (
          id, attempt_id, question_id, user_answer,
          answered_at, flagged, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (attempt_id, question_id)
        DO UPDATE SET
          user_answer = $4,
          answered_at = $5,
          flagged = $9,
          updated_at = $8
        `,
        [
          uuidv4(),
          attemptId,
          question.id,
          responseValidation.normalized
            ? JSON.stringify(responseValidation.normalized)
            : null,
          responseValidation.normalized ? now : null,
          response.flagged || false,
          now,
          now,
          response.flagged || false,
        ]
      )

      responsesSaved++
    }

    // Log success
    logger.info('attempt_progress_saved', {
      attempt_id: attemptId,
      workspace_id: workspace.id,
      user_id: user.id,
      responses_saved: responsesSaved,
      correlation_id: correlationId,
      elapsed_ms: Date.now() - startTime,
    })

    // Return 200 OK
    return c.json({
      success: true,
      data: {
        attempt_id: attemptId,
        responses_saved: responsesSaved,
        time_remaining_seconds: timeRemaining,
        saved_at: now.toISOString(),
        server_time: now.toISOString(),
      },
      error: null,
    })
  } catch (err) {
    // Error handling delegated to error normalizer
    throw err
  }
}
