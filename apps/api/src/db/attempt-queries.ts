/**
 * Attempt Engine Database Query Builders
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T012
 *
 * Reusable query builders for attempt engine operations.
 *
 * Responsibilities:
 * - Encapsulate SQL queries with consistent workspace_id scoping
 * - Use prepared statements to prevent SQL injection
 * - Provide typed result interfaces
 * - Support all attempt-related database operations
 *
 * ADRs: ADR-0001 (tenant isolation)
 */

import type {
  Attempt,
  AttemptProgress,
  AttemptStatus,
  SubmissionIdempotencyKey,
} from '@zidney/types/attempt'
import type { Pool, PoolClient } from 'pg'

/**
 * Query: Find attempt by ID
 *
 * Scope: Single workspace tenancy
 *
 * @param db - Database client or pool
 * @param workspaceId - Workspace UUID
 * @param attemptId - Attempt UUID
 * @returns Promise<Attempt | null>
 */
export async function findAttemptById(
  db: PoolClient | Pool,
  workspaceId: string,
  attemptId: string
): Promise<Attempt | null> {
  const result = await db.query(
    `
    SELECT * FROM attempts
    WHERE id = $1 AND workspace_id = $2
    `,
    [attemptId, workspaceId]
  )

  return result.rows.length > 0 ? parseAttemptRow(result.rows[0]) : null
}

/**
 * Query: Find in-progress attempt for user + exam
 *
 * Scope: Single workspace tenancy
 *
 * Used for: Checking if user already has active attempt (single_attempt_rule)
 *
 * @param db - Database client or pool
 * @param workspaceId - Workspace UUID
 * @param userId - User UUID
 * @param examId - Exam UUID
 * @returns Promise<Attempt | null>
 */
export async function findInProgressAttemptForUser(
  db: PoolClient | Pool,
  workspaceId: string,
  userId: string,
  examId: string
): Promise<Attempt | null> {
  const result = await db.query(
    `
    SELECT * FROM attempts
    WHERE workspace_id = $1
      AND user_id = $2
      AND exam_id = $3
      AND status = 'IN_PROGRESS'
    LIMIT 1
    `,
    [workspaceId, userId, examId]
  )

  return result.rows.length > 0 ? parseAttemptRow(result.rows[0]) : null
}

/**
 * Query: Find all attempts for user
 *
 * Scope: Single workspace tenancy
 *
 * @param db - Database client or pool
 * @param workspaceId - Workspace UUID
 * @param userId - User UUID
 * @param status - Optional status filter
 * @returns Promise<Attempt[]>
 */
export async function findAttemptsByUser(
  db: PoolClient | Pool,
  workspaceId: string,
  userId: string,
  status?: AttemptStatus
): Promise<Attempt[]> {
  let query = `
    SELECT * FROM attempts
    WHERE workspace_id = $1 AND user_id = $2
  `
  const params: any[] = [workspaceId, userId]

  if (status) {
    query += ` AND status = $3`
    params.push(status)
  }

  query += ` ORDER BY created_at DESC`

  const result = await db.query(query, params)
  return result.rows.map(parseAttemptRow)
}

/**
 * Query: Find all progress records for an attempt
 *
 * Scope: Single attempt (no workspace check needed due to FK)
 *
 * @param db - Database client or pool
 * @param attemptId - Attempt UUID
 * @returns Promise<AttemptProgress[]>
 */
export async function findProgressByAttemptId(
  db: PoolClient | Pool,
  attemptId: string
): Promise<AttemptProgress[]> {
  const result = await db.query(
    `
    SELECT * FROM attempt_progress
    WHERE attempt_id = $1
    ORDER BY created_at ASC
    `,
    [attemptId]
  )

  return result.rows.map(parseProgressRow)
}

/**
 * Query: Get progress for specific question
 *
 * @param db - Database client or pool
 * @param attemptId - Attempt UUID
 * @param questionId - Question UUID
 * @returns Promise<AttemptProgress | null>
 */
export async function findProgressByQuestion(
  db: PoolClient | Pool,
  attemptId: string,
  questionId: string
): Promise<AttemptProgress | null> {
  const result = await db.query(
    `
    SELECT * FROM attempt_progress
    WHERE attempt_id = $1 AND question_id = $2
    `,
    [attemptId, questionId]
  )

  return result.rows.length > 0 ? parseProgressRow(result.rows[0]) : null
}

/**
 * Query: Find idempotency record
 *
 * Scope: Single workspace tenancy
 *
 * Used for: Checking if submission has been processed before
 *
 * @param db - Database client or pool
 * @param workspaceId - Workspace UUID
 * @param idempotencyKey - Idempotency key
 * @returns Promise<SubmissionIdempotencyKey | null>
 */
export async function findIdempotencyRecord(
  db: PoolClient | Pool,
  workspaceId: string,
  idempotencyKey: string
): Promise<SubmissionIdempotencyKey | null> {
  const result = await db.query(
    `
    SELECT * FROM submission_idempotency_keys
    WHERE workspace_id = $1
      AND idempotency_key = $2
      AND expires_at > NOW()
    LIMIT 1
    `,
    [workspaceId, idempotencyKey]
  )

  return result.rows.length > 0 ? parseIdempotencyRow(result.rows[0]) : null
}

/**
 * Query: Get expired IN_PROGRESS attempts
 *
 * Scope: Single workspace tenancy
 *
 * Used for: Background job to auto-expire timed-out attempts
 *
 * @param db - Database client or pool
 * @param workspaceId - Workspace UUID
 * @param gracePeriodSeconds - Grace period for late submissions (default 30s)
 * @returns Promise<Attempt[]>
 */
export async function getExpiredAttempts(
  db: PoolClient | Pool,
  workspaceId: string,
  gracePeriodSeconds: number = 30
): Promise<Attempt[]> {
  const result = await db.query(
    `
    SELECT * FROM attempts
    WHERE workspace_id = $1
      AND status = 'IN_PROGRESS'
      AND time_limit_snapshot IS NOT NULL
      AND (EXTRACT(EPOCH FROM (NOW() - started_at)) > (time_limit_snapshot + $2))
    ORDER BY started_at ASC
    `,
    [workspaceId, gracePeriodSeconds]
  )

  return result.rows.map(parseAttemptRow)
}

/**
 * Query: Count answered questions for attempt
 *
 * @param db - Database client or pool
 * @param attemptId - Attempt UUID
 * @returns Promise<number>
 */
export async function countAnsweredQuestions(
  db: PoolClient | Pool,
  attemptId: string
): Promise<number> {
  const result = await db.query(
    `
    SELECT COUNT(*) as count FROM attempt_progress
    WHERE attempt_id = $1 AND user_answer IS NOT NULL
    `,
    [attemptId]
  )

  return parseInt(result.rows[0].count, 10)
}

/**
 * Query: Count flagged questions for attempt
 *
 * @param db - Database client or pool
 * @param attemptId - Attempt UUID
 * @returns Promise<number>
 */
export async function countFlaggedQuestions(
  db: PoolClient | Pool,
  attemptId: string
): Promise<number> {
  const result = await db.query(
    `
    SELECT COUNT(*) as count FROM attempt_progress
    WHERE attempt_id = $1 AND flagged = TRUE
    `,
    [attemptId]
  )

  return parseInt(result.rows[0].count, 10)
}

/**
 * Query: Get finalized attempts for analytics
 *
 * Scope: Single workspace tenancy
 *
 * @param db - Database client or pool
 * @param workspaceId - Workspace UUID
 * @param limit - Maximum results (default 100)
 * @param offset - Pagination offset (default 0)
 * @returns Promise<Attempt[]>
 */
export async function getFinalizedAttempts(
  db: PoolClient | Pool,
  workspaceId: string,
  limit: number = 100,
  offset: number = 0
): Promise<Attempt[]> {
  const result = await db.query(
    `
    SELECT * FROM attempts
    WHERE workspace_id = $1 AND status = 'FINALIZED'
    ORDER BY finalized_at DESC
    LIMIT $2 OFFSET $3
    `,
    [workspaceId, limit, offset]
  )

  return result.rows.map(parseAttemptRow)
}

/**
 * Query: Count attempts by status
 *
 * Scope: Single workspace tenancy
 *
 * @param db - Database client or pool
 * @param workspaceId - Workspace UUID
 * @returns Promise<Record<AttemptStatus, number>>
 */
export async function countAttemptsByStatus(
  db: PoolClient | Pool,
  workspaceId: string
): Promise<Record<string, number>> {
  const result = await db.query(
    `
    SELECT status, COUNT(*) as count
    FROM attempts
    WHERE workspace_id = $1
    GROUP BY status
    `,
    [workspaceId]
  )

  const counts: Record<string, number> = {}
  result.rows.forEach((row) => {
    counts[row.status] = parseInt(row.count, 10)
  })

  return counts
}

/**
 * Internal: Parse database attempt row to Attempt interface
 *
 * Handles type conversion for JSONB and array fields
 *
 * @private
 */
function parseAttemptRow(row: any): Attempt {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    user_id: row.user_id,
    attempt_type: row.attempt_type,
    exam_id: row.exam_id,
    question_snapshot: row.question_snapshot,
    question_order: row.question_order,
    grading_config_snapshot: row.grading_config_snapshot,
    mode: row.mode,
    flags_snapshot: row.flags_snapshot,
    time_limit_snapshot: row.time_limit_snapshot,
    exam_version: row.exam_version,
    expected_schema_version: row.expected_schema_version,
    expected_product_version: row.expected_product_version,
    started_at: new Date(row.started_at),
    submitted_at: row.submitted_at ? new Date(row.submitted_at) : undefined,
    finalized_at: row.finalized_at ? new Date(row.finalized_at) : undefined,
    server_start_time: new Date(row.server_start_time),
    certificate_enabled: row.certificate_enabled,
    single_attempt_rule: row.single_attempt_rule,
    status: row.status,
    score: row.score ? parseFloat(row.score) : undefined,
    passed: row.passed,
    result_snapshot: row.result_snapshot,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }
}

/**
 * Internal: Parse database progress row to AttemptProgress interface
 *
 * @private
 */
function parseProgressRow(row: any): AttemptProgress {
  return {
    id: row.id,
    attempt_id: row.attempt_id,
    question_id: row.question_id,
    user_answer: row.user_answer,
    answered_at: row.answered_at ? new Date(row.answered_at) : undefined,
    flagged: row.flagged,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }
}

/**
 * Internal: Parse database idempotency row to SubmissionIdempotencyKey interface
 *
 * @private
 */
function parseIdempotencyRow(row: any): SubmissionIdempotencyKey {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    attempt_id: row.attempt_id,
    submission_sequence: row.submission_sequence,
    idempotency_key: row.idempotency_key,
    request_timestamp: new Date(row.request_timestamp),
    response_status: row.response_status,
    response_body: row.response_body,
    created_at: new Date(row.created_at),
    expires_at: new Date(row.expires_at),
  }
}
