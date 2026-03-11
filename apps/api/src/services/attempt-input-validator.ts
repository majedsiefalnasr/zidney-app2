/**
 * Attempt Input Validator Service
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase C, T023
 *
 * Purpose: Validate user input for attempt creation and progress updates
 * Requirements: Exam existence, user eligibility, format validation
 *
 * Responsibilities:
 * - Validate exam exists and is accessible
 * - Validate user is enrolled/eligible for exam
 * - Check max attempts not exceeded
 * - Validate input format before processing
 *
 * Constitutional Compliance:
 * - ADR-0001: All queries include workspace_id
 * - Zero SQL injection (parameterized queries)
 * - No business logic leakage (pure validation)
 */

import type { Logger } from '@zidney/logger'
import type { Pool, PoolClient } from 'pg'

interface ExamValidationRecord {
  id: string
  name: string
  status: string
  version: number
  mode: string
  time_limit_seconds: number | null
  allow_multiple_attempts: boolean
  pass_score_percentage: number
  total_points: number
  randomize_questions: boolean
  randomize_options: boolean
  show_correct_answers: boolean
  review_allowed: boolean
  hints_allowed: boolean
  one_question_per_page: boolean
  certificate_enabled: boolean
}

interface QuestionSnapshotQuestion {
  id: string
}

interface QuestionSnapshotPayload {
  questions: QuestionSnapshotQuestion[]
}

interface CreateAttemptRequestBody {
  exam_id?: string
  attempt_mode?: string
  notes?: string
}

interface ProgressUpdateRequestBody {
  question_index?: number
  user_response?: Record<string, unknown>
}

/**
 * Validation result interface
 */
export interface ValidationResult<T> {
  valid: boolean
  data?: T
  errors?: string[]
}

/**
 * Validate exam exists and is active
 *
 * @param db - Tenant database connection
 * @param workspaceId - Workspace UUID
 * @param examId - Exam UUID
 * @returns Promise<ValidationResult<ExamValidationRecord>>
 */
export async function validateExamExists(
  db: PoolClient | Pool,
  workspaceId: string,
  examId: string,
  logger: Logger,
  correlationId: string
): Promise<ValidationResult<ExamValidationRecord>> {
  try {
    const result = await db.query(
      `
      SELECT id, name, status, version, mode, time_limit_seconds,
             allow_multiple_attempts, pass_score_percentage, total_points,
             randomize_questions, randomize_options, show_correct_answers,
             review_allowed, hints_allowed, one_question_per_page,
             certificate_enabled
      FROM exams
      WHERE id = $1 AND workspace_id = $2
      `,
      [examId, workspaceId]
    )

    if (result.rows.length === 0) {
      logger.warn('Exam validation failed: not found', {
        exam_id: examId,
        workspace_id: workspaceId,
        correlation_id: correlationId,
      })
      return {
        valid: false,
        errors: [`Exam not found or not accessible`],
      }
    }

    const exam = result.rows[0] as ExamValidationRecord

    if (exam.status !== 'ACTIVE') {
      logger.warn('Exam validation failed: not active', {
        exam_id: examId,
        exam_status: exam.status,
        correlation_id: correlationId,
      })
      return {
        valid: false,
        errors: [`Exam is not active`],
      }
    }

    return {
      valid: true,
      data: exam,
    }
  } catch (error) {
    logger.error('Exam validation error', {
      exam_id: examId,
      workspace_id: workspaceId,
      error: error instanceof Error ? error.message : String(error),
      correlation_id: correlationId,
    })
    throw error
  }
}

/**
 * Validate user is eligible for exam (enrolled and not max attempts)
 *
 * @param db - Tenant database connection
 * @param workspaceId - Workspace UUID
 * @param userId - User UUID
 * @param examId - Exam UUID
 * @param allowMultipleAttempts - Whether multiple attempts allowed
 * @returns Promise<ValidationResult<{ enrolled: boolean }>>
 */
export async function validateUserEligibility(
  db: PoolClient | Pool,
  workspaceId: string,
  userId: string,
  examId: string,
  allowMultipleAttempts: boolean,
  logger: Logger,
  correlationId: string
): Promise<ValidationResult<{ enrolled: boolean }>> {
  try {
    // Check for in-progress attempt (can't start if one already in progress)
    const inProgressResult = await db.query(
      `
      SELECT id, status FROM attempts
      WHERE workspace_id = $1
        AND user_id = $2
        AND exam_id = $3
        AND status = 'IN_PROGRESS'
      LIMIT 1
      `,
      [workspaceId, userId, examId]
    )

    if (inProgressResult.rows.length > 0) {
      logger.warn('User eligibility check failed: attempt in progress', {
        user_id: userId,
        exam_id: examId,
        workspace_id: workspaceId,
        correlation_id: correlationId,
      })
      return {
        valid: false,
        errors: [`User already has an in-progress attempt for this exam`],
      }
    }

    // Check user enrollment/registration
    const enrollmentResult = await db.query(
      `
      SELECT id FROM user_enrollments
      WHERE workspace_id = $1
        AND user_id = $2
        AND exam_id = $3
        AND status = 'ACTIVE'
      LIMIT 1
      `,
      [workspaceId, userId, examId]
    )

    if (enrollmentResult.rows.length === 0) {
      logger.warn('User eligibility check failed: not enrolled', {
        user_id: userId,
        exam_id: examId,
        workspace_id: workspaceId,
        correlation_id: correlationId,
      })
      return {
        valid: false,
        errors: [`User is not enrolled in this exam`],
      }
    }

    // If multiple attempts not allowed, check if already attempted
    if (!allowMultipleAttempts) {
      const attemptedResult = await db.query(
        `
        SELECT COUNT(*) as attempt_count FROM attempts
        WHERE workspace_id = $1
          AND user_id = $2
          AND exam_id = $3
          AND status IN ('SUBMITTED', 'FINALIZED')
        `,
        [workspaceId, userId, examId]
      )

      const attemptCount = parseInt(attemptedResult.rows[0].attempt_count, 10)
      if (attemptCount > 0) {
        logger.warn('User eligibility check failed: max attempts exceeded', {
          user_id: userId,
          exam_id: examId,
          attempt_count: attemptCount,
          correlation_id: correlationId,
        })
        return {
          valid: false,
          errors: [`Maximum attempts for this exam exceeded`],
        }
      }
    }

    return {
      valid: true,
      data: { enrolled: true },
    }
  } catch (error) {
    logger.error('User eligibility check error', {
      user_id: userId,
      exam_id: examId,
      workspace_id: workspaceId,
      error: error instanceof Error ? error.message : String(error),
      correlation_id: correlationId,
    })
    throw error
  }
}

/**
 * Validate question exists in attempt
 *
 * @param questionId - Question UUID
 * @param questionSnapshot - Question snapshot from attempt
 * @returns ValidationResult<QuestionSnapshotQuestion>
 */
export function validateQuestionInSnapshot(
  questionId: string,
  questionSnapshot: unknown
): ValidationResult<QuestionSnapshotQuestion> {
  if (
    !questionSnapshot ||
    typeof questionSnapshot !== 'object' ||
    !('questions' in questionSnapshot) ||
    !Array.isArray((questionSnapshot as { questions?: unknown }).questions)
  ) {
    return {
      valid: false,
      errors: ['Invalid question snapshot'],
    }
  }

  const typedSnapshot = questionSnapshot as QuestionSnapshotPayload
  const question = typedSnapshot.questions.find((q) => q.id === questionId)

  if (!question) {
    return {
      valid: false,
      errors: [`Question not found in attempt`],
    }
  }

  return {
    valid: true,
    data: question,
  }
}

/**
 * Validate request body format for create attempt
 *
 * @param body - Request body
 * @returns ValidationResult<CreateAttemptRequestBody>
 */
export function validateCreateAttemptRequestFormat(
  body: CreateAttemptRequestBody
): ValidationResult<CreateAttemptRequestBody> {
  const errors: string[] = []

  if (!body.exam_id) {
    errors.push('exam_id is required')
  } else if (typeof body.exam_id !== 'string') {
    errors.push('exam_id must be a string')
  } else if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.exam_id)
  ) {
    errors.push('exam_id must be a valid UUID')
  }

  if (body.attempt_mode) {
    if (!['RELAX', 'CHRONO', 'RUSH'].includes(body.attempt_mode)) {
      errors.push('attempt_mode must be RELAX, CHRONO, or RUSH')
    }
  }

  if (body.notes) {
    if (typeof body.notes !== 'string') {
      errors.push('notes must be a string')
    } else if (body.notes.length > 1000) {
      errors.push('notes must be 1000 characters or less')
    }
  }

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? body : undefined,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Validate progress update request format
 *
 * @param body - Request body
 * @returns ValidationResult<ProgressUpdateRequestBody>
 */
export function validateProgressUpdateRequestFormat(
  body: ProgressUpdateRequestBody
): ValidationResult<ProgressUpdateRequestBody> {
  const errors: string[] = []

  if (!body.question_index && body.question_index !== 0) {
    errors.push('question_index is required')
  } else if (typeof body.question_index !== 'number' || body.question_index < 0) {
    errors.push('question_index must be a non-negative number')
  }

  if (!body.user_response) {
    errors.push('user_response is required')
  } else if (typeof body.user_response !== 'object') {
    errors.push('user_response must be an object')
  }

  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? body : undefined,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Validate time limit not exceeded
 *
 * @param startedAt - Attempt start timestamp
 * @param timeLimitSeconds - Time limit in seconds
 * @param mode - Attempt mode
 * @returns ValidationResult<{ time_remaining_seconds: number | null }>
 */
export function validateTimeNotExceeded(
  startedAt: Date,
  timeLimitSeconds: number | null | undefined,
  mode: string
): ValidationResult<{ time_remaining_seconds: number | null }> {
  // RELAX mode has no time limit
  if (mode === 'RELAX' || !timeLimitSeconds) {
    return {
      valid: true,
      data: { time_remaining_seconds: null },
    }
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const startedSeconds = Math.floor(startedAt.getTime() / 1000)
  const elapsedSeconds = nowSeconds - startedSeconds

  if (elapsedSeconds >= timeLimitSeconds) {
    return {
      valid: false,
      errors: ['Time limit exceeded'],
    }
  }

  const timeRemaining = timeLimitSeconds - elapsedSeconds
  return {
    valid: true,
    data: { time_remaining_seconds: timeRemaining },
  }
}
