/**
 * Create Attempt Endpoint
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase C, T022
 *
 * Route: POST /api/workspaces/:slug/attempts
 * Purpose: Create new attempt with snapshot capture
 * Authorization: RBAC (student/instructor can create)
 *
 * Business Flow:
 * 1. Validate request format
 * 2. Load exam (validate exists and active)
 * 3. Validate user eligibility (enrolled, max attempts)
 * 4. Build immutable snapshot
 * 5. Atomically insert attempt + progress records
 * 6. Return 201 Created
 *
 * Constitutional Compliance:
 * - ADR-0001: workspace_id on all queries
 * - ADR-0002: Snapshot immutability (captured at start)
 * - ADR-0006: Server-authoritative time (NOW() only)
 * - ADR-0007: Version compatibility (validated pre-insert)
 * - Atomic transaction (rollback on error)
 * - Structured logging with correlation_id
 */

import { createLogger } from '@zidney/logger'
import { Context } from 'hono'
import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'
import type { UserContextStage06 } from '../../middleware/auth-context-stage06'
import { loadQuestionsForExam } from '../../modules/attempt/exam-loader'
import {
  buildFlagsSnapshot,
  buildGradingConfigSnapshot,
  buildQuestionSnapshot,
} from '../../modules/attempt/snapshot-builder'
import {
  validateCreateAttemptRequestFormat,
  validateExamExists,
  validateUserEligibility,
} from '../../services/attempt-input-validator'

/**
 * POST /api/workspaces/:slug/attempts
 *
 * Create new attempt endpoint
 */
export async function createAttemptHandler(c: Context) {
  const correlationId = c.get('correlationId') || 'unknown'
  const workspace = c.get('workspace')
  const user = c.get('user') as UserContextStage06
  const tenantDb = c.get('tenantDb') as Pool
  const logger = createLogger('attempts-create')

  const startTime = Date.now()

  // 1. Parse and validate request body
  const body = await c.req.json()
  const requestValidation = validateCreateAttemptRequestFormat(body)

  if (!requestValidation.valid) {
    logger.warn('Attempt creation failed: invalid request format', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      user_id: user.id,
      errors: requestValidation.errors,
    })

    throw {
      code: 'VALIDATION_ERROR',
      message: requestValidation.errors?.[0] || 'Invalid request format',
      status: 400,
    }
  }

  const { exam_id, attempt_mode = 'CHRONO' } = requestValidation.data

  // 2. Validate exam exists and is active
  const examValidation = await validateExamExists(
    tenantDb,
    workspace.id,
    exam_id,
    logger,
    correlationId
  )

  if (!examValidation.valid) {
    logger.warn('Attempt creation failed: exam validation', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      exam_id: exam_id,
      errors: examValidation.errors,
    })

    throw {
      code: 'EXAM_NOT_FOUND',
      message: examValidation.errors?.[0] || 'Exam validation failed',
      status: 404,
    }
  }

  const exam = examValidation.data

  // 3. Validate user eligibility
  const eligibilityValidation = await validateUserEligibility(
    tenantDb,
    workspace.id,
    user.id,
    exam_id,
    exam.allow_multiple_attempts || false,
    logger,
    correlationId
  )

  if (!eligibilityValidation.valid) {
    logger.warn('Attempt creation failed: user not eligible', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      user_id: user.id,
      exam_id: exam_id,
      errors: eligibilityValidation.errors,
    })

    // Check if conflict is in-progress attempt
    if (eligibilityValidation.errors?.[0]?.includes('in-progress')) {
      throw {
        code: 'ATTEMPT_IN_PROGRESS',
        message: 'User already has an in-progress attempt for this exam',
        status: 409,
      }
    }

    throw {
      code: 'USER_NOT_ELIGIBLE',
      message:
        eligibilityValidation.errors?.[0] || 'User not eligible for this exam',
      status: 400,
    }
  }

  // 4. Load questions for snapshot
  const questions = await loadQuestionsForExam(tenantDb, exam_id)

  if (!questions || questions.length === 0) {
    logger.error('Attempt creation failed: no questions for exam', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      exam_id: exam_id,
    })

    throw {
      code: 'EXAM_INVALID',
      message: 'Exam has no questions',
      status: 400,
    }
  }

  // 5. Build immutable snapshots
  const questionSnapshot = buildQuestionSnapshot(questions as any)
  const gradingConfigSnapshot = buildGradingConfigSnapshot(exam)
  const flagsSnapshot = buildFlagsSnapshot(exam)

  // 6. Create attempt record atomically
  const attemptId = uuidv4()
  const now = new Date()

  const client = await tenantDb.connect()

  try {
    await client.query('BEGIN')

    // Insert attempt
    await client.query(
      `
      INSERT INTO attempts (
        id, workspace_id, user_id, exam_id, status,
        question_snapshot, question_order, grading_config_snapshot,
        mode, flags_snapshot, time_limit_snapshot,
        exam_version, expected_schema_version, expected_product_version,
        started_at, server_start_time, certificate_enabled,
        single_attempt_rule, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
      `,
      [
        attemptId,
        workspace.id,
        user.id,
        exam_id,
        'IN_PROGRESS',
        JSON.stringify(questionSnapshot),
        questionSnapshot.questions.map((q) => q.id),
        JSON.stringify(gradingConfigSnapshot),
        attempt_mode,
        JSON.stringify(flagsSnapshot),
        exam.time_limit_seconds || null,
        exam.version,
        1, // schema_version
        '1.0.0', // product_version
        now,
        now,
        exam.certificate_enabled || false,
        !exam.allow_multiple_attempts,
        now,
        now,
      ]
    )

    // Insert initial progress records (one per question, unanswered)
    for (const question of questions) {
      await client.query(
        `
        INSERT INTO attempt_progress (
          id, attempt_id, question_id, user_answer,
          answered_at, flagged, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [uuidv4(), attemptId, question.id, null, null, false, now, now]
      )
    }

    await client.query('COMMIT')

    // Log success
    logger.info('attempt_created', {
      attempt_id: attemptId,
      workspace_id: workspace.id,
      user_id: user.id,
      exam_id: exam_id,
      mode: attempt_mode,
      question_count: questions.length,
      correlation_id: correlationId,
      elapsed_ms: Date.now() - startTime,
    })

    // Return 201 Created
    return c.json(
      {
        success: true,
        data: {
          id: attemptId,
          workspace_id: workspace.id,
          user_id: user.id,
          exam_id: exam_id,
          status: 'IN_PROGRESS',
          started_at: now.toISOString(),
          server_start_time: now.toISOString(),
          mode: attempt_mode,
          time_limit_seconds: exam.time_limit_seconds || null,
          time_remaining_seconds: exam.time_limit_seconds || null,
          question_count: questions.length,
          questions: questions.map((q) => ({
            id: q.id,
            type: q.type,
            text: q.text,
            options: q.options || [],
            points: q.points,
          })),
        },
        error: null,
      },
      201
    )
  } catch (txError) {
    await client.query('ROLLBACK')
    logger.error('Attempt creation transaction failed', {
      correlation_id: correlationId,
      workspace_id: workspace.id,
      user_id: user.id,
      exam_id: exam_id,
      error: txError instanceof Error ? txError.message : String(txError),
    })
    throw txError
  } finally {
    client.release()
  }
}
