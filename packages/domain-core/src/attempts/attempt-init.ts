/**
 * Attempt Initialization Service
 *
 * Creates attempts with frozen snapshots.
 * Calls snapshot service to capture current exam state.
 * Logs START event automatically.
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T036 (Attempt initialization service)
 */

import { createLogger } from '@zidney/logger'
import type { Pool, PoolClient } from 'pg'
import { logAttemptEvent } from '../audit/attempt-event-logger'
import { captureExamSnapshot } from './snapshot-service'

const logger = createLogger('AttemptInit')

export interface AttemptCreateOptions {
  examId: string
  userId: string
  client?: PoolClient
}

export interface Attempt {
  id: string
  exam_id: string
  user_id: string
  status: string
  started_at: Date
  submission_deadline_at: Date
  configuration_snapshot: unknown
  question_list_snapshot: unknown
  grading_config_snapshot: unknown
  created_by: string
}

/**
 * Initialize attempt with frozen snapshots
 *
 * Steps:
 * 1. Capture exam snapshot (config, questions, grading)
 * 2. Calculate submission deadline (started_at + duration)
 * 3. INSERT into attempts with snapshots
 * 4. Log START event
 */
export async function initializeAttempt(
  options: AttemptCreateOptions,
  pool: Pool,
  currentUserId: string
): Promise<Attempt> {
  const { examId, userId, client } = options

  try {
    // Capture snapshot at this moment (server-authoritative time)
    const snapshot = await captureExamSnapshot(examId, pool)
    const startedAt = new Date()
    const submissionDeadline = new Date(
      startedAt.getTime() + snapshot.config.duration_minutes * 60 * 1000
    )

    // Use transaction if client provided
    const conn = client || (await pool.connect())

    try {
      // INSERT attempt with snapshots
      const result = await conn.query(
        `INSERT INTO attempts (
          exam_id, user_id,
          configuration_snapshot, question_list_snapshot, grading_config_snapshot,
          status, started_at, submission_deadline_at,
          created_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          examId,
          userId,
          JSON.stringify(snapshot.config),
          JSON.stringify(snapshot.questions),
          JSON.stringify(snapshot.grading),
          'IN_PROGRESS',
          startedAt,
          submissionDeadline,
          startedAt,
          currentUserId,
        ]
      )

      const attempt = result.rows[0]

      // Log START event
      await logAttemptEvent(
        {
          attemptId: attempt.id,
          eventType: 'START',
          payload: {
            question_count: snapshot.config.question_count,
            duration_minutes: snapshot.config.duration_minutes,
          },
          client: conn,
          currentUserId,
        },
        pool
      )

      logger.info('Attempt initialized with snapshots', {
        attempt_id: attempt.id,
        exam_id: examId,
        user_id: userId,
        question_count: snapshot.config.question_count,
        deadline: submissionDeadline.toISOString(),
        correlation_id: (global as unknown as { correlationId?: string }).correlationId,
      })

      return attempt as Attempt
    } finally {
      if (!options.client && conn) {
        try {
          const releaseFn = (conn as unknown as { release?: () => void }).release
          releaseFn?.()
        } catch (_) {
          // Ignore release errors
        }
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('Failed to initialize attempt', {
      exam_id: examId,
      user_id: userId,
      error: msg,
      correlation_id: (global as unknown as { correlationId?: string }).correlationId,
    })
    throw error
  }
}

/**
 * Handle duplicate attempt (attempt already in progress)
 * Returns existing attempt if one exists for this user+exam
 */
export async function getOrCreateAttempt(
  options: AttemptCreateOptions,
  pool: Pool,
  currentUserId: string
): Promise<Attempt> {
  const { examId, userId } = options

  // Check if attempt exists
  const existing = await pool.query(
    `SELECT * FROM attempts
     WHERE exam_id = $1 AND user_id = $2 AND status = 'IN_PROGRESS'
     LIMIT 1`,
    [examId, userId]
  )

  if (existing.rows.length > 0) {
    logger.info('Attempt already in progress, returning existing', {
      attempt_id: existing.rows[0].id,
      exam_id: examId,
      user_id: userId,
      correlation_id: (global as unknown as { correlationId?: string }).correlationId,
    })
    return existing.rows[0] as Attempt
  }

  return initializeAttempt(options, pool, currentUserId)
}

/**
 * Query attempt details
 */
export async function getAttemptById(attemptId: string, pool: Pool): Promise<Attempt | null> {
  const result = await pool.query(`SELECT * FROM attempts WHERE id = $1`, [attemptId])

  return result.rows.length > 0 ? (result.rows[0] as Attempt) : null
}

/**
 * List attempts for a user
 */
export async function getAttemptsByUserId(
  userId: string,
  pool: Pool,
  limit: number = 50
): Promise<Attempt[]> {
  const result = await pool.query(
    `SELECT * FROM attempts WHERE user_id = $1 ORDER BY started_at DESC LIMIT $2`,
    [userId, limit]
  )

  return result.rows as Attempt[]
}
