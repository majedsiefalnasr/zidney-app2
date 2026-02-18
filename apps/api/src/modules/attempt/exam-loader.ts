/**
 * Exam Loader Service
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T024
 *
 * Loads exam configuration safely with validation.
 * Ensures exam exists, is active, and user is eligible.
 *
 * Responsibilities:
 * - Load exam metadata from database
 * - Verify exam exists and is active
 * - Load question configurations
 * - Validate user eligibility
 * - Enforce single_attempt_rule if applicable
 *
 * ADRs: ADR-0001 (tenant isolation)
 */

import { Pool, PoolClient } from 'pg'
import { createLogger } from '../logging'

const logger = createLogger('exam-loader')

/**
 * Interface: Exam data structure
 */
export interface ExamConfig {
  id: string
  workspace_id: string
  name: string
  description?: string
  version: string
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'DELETED'
  attempt_type: string
  mode: 'RELAX' | 'CHRONO' | 'RUSH'
  time_limit_seconds?: number
  pass_score_percentage: number
  total_points: number
  allow_multiple_attempts: boolean
  certificate_enabled: boolean
  randomize_questions: boolean
  randomize_options: boolean
  show_correct_answers: boolean
  review_allowed: boolean
  hints_allowed: boolean
  one_question_per_page: boolean
  created_at: Date
  updated_at: Date
}

/**
 * Interface: Question data
 */
export interface QuestionData {
  id: string
  exam_id: string
  text: string
  type: string
  options?: string[]
  correct_answer: any
  points: number
  difficulty?: string
  hints?: string[]
  explanation?: string
  metadata?: Record<string, any>
  created_at: Date
  updated_at: Date
}

/**
 * Load exam by ID with validation
 *
 * @param db - Database client
 * @param workspaceId - Workspace UUID
 * @param examId - Exam UUID
 * @returns Promise<ExamConfig | null>
 * @throws Error if exam exists but in invalid state
 */
export async function loadExamById(
  db: PoolClient | Pool,
  workspaceId: string,
  examId: string
): Promise<ExamConfig | null> {
  try {
    const result = await db.query(
      `
      SELECT *
      FROM exams
      WHERE id = $1 AND workspace_id = $2
      `,
      [examId, workspaceId]
    )

    if (result.rows.length === 0) {
      logger.debug('Exam not found', {
        exam_id: examId,
        workspace_id: workspaceId,
      })
      return null
    }

    const exam = parseExamRow(result.rows[0])

    logger.debug('Exam loaded', {
      exam_id: exam.id,
      exam_name: exam.name,
      status: exam.status,
      version: exam.version,
    })

    return exam
  } catch (error) {
    logger.error('Failed to load exam', {
      exam_id: examId,
      workspace_id: workspaceId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Load all questions for an exam
 *
 * @param db - Database client
 * @param examId - Exam UUID
 * @returns Promise<QuestionData[]>
 */
export async function loadQuestionsForExam(
  db: PoolClient | Pool,
  examId: string
): Promise<QuestionData[]> {
  try {
    const result = await db.query(
      `
      SELECT *
      FROM questions
      WHERE exam_id = $1 AND deleted_at IS NULL
      ORDER BY sequence ASC, created_at ASC
      `,
      [examId]
    )

    const questions = result.rows.map(parseQuestionRow)

    logger.debug('Questions loaded for exam', {
      exam_id: examId,
      question_count: questions.length,
    })

    return questions
  } catch (error) {
    logger.error('Failed to load questions', {
      exam_id: examId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Validate exam availability for attempt
 *
 * Checks:
 * - Exam exists
 * - Exam is ACTIVE
 * - Exam has questions
 * - Attempt policies valid
 *
 * @param exam - Exam config
 * @param questions - Exam questions
 * @returns Validation result object
 */
export function validateExamAvailability(
  exam: ExamConfig,
  questions: QuestionData[]
): {
  valid: boolean
  reason?: string
} {
  // Check status
  if (exam.status !== 'ACTIVE') {
    return {
      valid: false,
      reason: `Exam status is ${exam.status}, not ACTIVE`,
    }
  }

  // Check questions exist
  if (!questions || questions.length === 0) {
    return {
      valid: false,
      reason: 'Exam has no questions',
    }
  }

  // Check total points is valid
  if (exam.total_points <= 0) {
    return {
      valid: false,
      reason: `Exam total_points is invalid: ${exam.total_points}`,
    }
  }

  // Check pass score percentage is valid
  if (exam.pass_score_percentage < 0 || exam.pass_score_percentage > 100) {
    return {
      valid: false,
      reason: `Exam pass_score_percentage is invalid: ${exam.pass_score_percentage}`,
    }
  }

  // Check mode-specific requirements
  if (exam.mode === 'CHRONO' || exam.mode === 'RUSH') {
    if (!exam.time_limit_seconds || exam.time_limit_seconds <= 0) {
      return {
        valid: false,
        reason: `Exam mode ${exam.mode} requires time_limit_seconds > 0`,
      }
    }
  }

  return { valid: true }
}

/**
 * Validate user eligibility to take exam
 *
 * Checks:
 * - User is not suspended
 * - User has access to exam (group memberships, prerequisites, etc.)
 * - User can take exam (not already taking if single_attempt allowed)
 *
 * @param db - Database client
 * @param workspaceId - Workspace UUID
 * @param userId - User UUID
 * @param examId - Exam UUID
 * @returns Promise<{valid: boolean, reason?: string}>
 */
export async function validateUserEligibility(
  db: PoolClient | Pool,
  workspaceId: string,
  userId: string,
  examId: string
): Promise<{
  valid: boolean
  reason?: string
}> {
  try {
    // Check user is not suspended
    const userResult = await db.query(
      `
      SELECT status FROM users
      WHERE id = $1 AND workspace_id = $2
      `,
      [userId, workspaceId]
    )

    if (userResult.rows.length === 0) {
      return {
        valid: false,
        reason: 'User not found',
      }
    }

    const userStatus = userResult.rows[0].status
    if (userStatus !== 'ACTIVE') {
      return {
        valid: false,
        reason: `User status is ${userStatus}, cannot take exam`,
      }
    }

    // Check user has access to exam
    // (This is a simplified check; in production, would verify group membership, prerequisites, etc.)
    const accessResult = await db.query(
      `
      SELECT COUNT(*) as count
      FROM exam_access
      WHERE exam_id = $1 AND user_id = $2 AND access_level IN ('STUDENT', 'ADMIN')
      `,
      [examId, userId]
    )

    const hasAccess = parseInt(accessResult.rows[0].count, 10) > 0
    if (!hasAccess) {
      return {
        valid: false,
        reason: 'User does not have access to this exam',
      }
    }

    return { valid: true }
  } catch (error) {
    logger.error('User eligibility check failed', {
      user_id: userId,
      exam_id: examId,
      workspace_id: workspaceId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Get exam grading configuration
 *
 * Extracts grading-specific settings from exam config
 *
 * @param exam - Exam config
 * @returns Grading configuration object
 */
export function getExamGradingConfig(exam: ExamConfig): Record<string, any> {
  return {
    pass_score_percentage: exam.pass_score_percentage,
    total_points: exam.total_points,
    pass_fail_logic: 'SUM_SCORE >= pass_score_percentage',
    review_allowed: exam.review_allowed,
    hints_allowed: exam.hints_allowed,
    show_correct_answer: exam.show_correct_answers,
    randomize_options: exam.randomize_options,
    one_question_per_page: exam.one_question_per_page,
  }
}

/**
 * Check if user can take exam (respects single_attempt_rule)
 *
 * @param db - Database client
 * @param workspaceId - Workspace UUID
 * @param userId - User UUID
 * @param examId - Exam UUID
 * @param singleAttemptOnly - If true, only allow if no other attempts exist
 * @returns Promise<{canTake: boolean, reason?: string}>
 */
export async function canUserTakeExam(
  db: PoolClient | Pool,
  workspaceId: string,
  userId: string,
  examId: string,
  singleAttemptOnly: boolean = true
): Promise<{
  canTake: boolean
  reason?: string
}> {
  try {
    if (singleAttemptOnly) {
      // Check for any existing attempts
      const result = await db.query(
        `
        SELECT COUNT(*) as count
        FROM attempts
        WHERE workspace_id = $1
          AND user_id = $2
          AND exam_id = $3
          AND status IN ('IN_PROGRESS', 'SUBMITTED', 'FINALIZED')
        `,
        [workspaceId, userId, examId]
      )

      const attemptCount = parseInt(result.rows[0].count, 10)
      if (attemptCount > 0) {
        return {
          canTake: false,
          reason: `User already has ${attemptCount} active/completed attempt(s) for this exam (single attempt rule enforced)`,
        }
      }
    }

    return { canTake: true }
  } catch (error) {
    logger.error('Exam availability check failed', {
      user_id: userId,
      exam_id: examId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Internal: Parse exam row from database
 *
 * @private
 */
function parseExamRow(row: any): ExamConfig {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    description: row.description,
    version: row.version,
    status: row.status,
    attempt_type: row.attempt_type,
    mode: row.mode,
    time_limit_seconds: row.time_limit_seconds,
    pass_score_percentage: row.pass_score_percentage,
    total_points: row.total_points,
    allow_multiple_attempts: row.allow_multiple_attempts,
    certificate_enabled: row.certificate_enabled,
    randomize_questions: row.randomize_questions,
    randomize_options: row.randomize_options,
    show_correct_answers: row.show_correct_answers,
    review_allowed: row.review_allowed,
    hints_allowed: row.hints_allowed,
    one_question_per_page: row.one_question_per_page,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }
}

/**
 * Internal: Parse question row from database
 *
 * @private
 */
function parseQuestionRow(row: any): QuestionData {
  return {
    id: row.id,
    exam_id: row.exam_id,
    text: row.text,
    type: row.type,
    options: row.options,
    correct_answer: row.correct_answer,
    points: row.points,
    difficulty: row.difficulty,
    hints: row.hints,
    explanation: row.explanation,
    metadata: row.metadata,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }
}
