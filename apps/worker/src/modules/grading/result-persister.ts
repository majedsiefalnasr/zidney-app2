import { logger } from '@zidney/logger'
import type { GradingResult } from '../../types/job-schema'

type DbRow = Record<string, any>
type QueryResult = { rows: DbRow[] }
type DbClient = {
  query: (queryText: string, values?: any[]) => Promise<QueryResult>
  release: () => void
}
type DbAdapter = {
  query: (queryText: string, values?: any[]) => Promise<QueryResult>
  connect: () => Promise<DbClient>
}

let gradingDb: DbAdapter | null = null

export function configureGradingResultPersister(database: DbAdapter): void {
  gradingDb = database
}

function getDb(): DbAdapter {
  if (!gradingDb) {
    throw new Error(
      'Grading result persister database is not configured. Call configureGradingResultPersister() first.'
    )
  }
  return gradingDb
}

/**
 * T049: Grading result persistence
 *
 * Persists grading results to database:
 * - Use SERIALIZABLE isolation to prevent race conditions
 * - Transaction: Load attempt → Verify → Store result
 * - Update: attempts.grading_result, attempts.status = COMPLETED
 * - Include correlation_id in audit trail
 */

export async function persistGradingResult(
  workspaceId: string,
  attemptId: string,
  gradingResult: GradingResult,
  correlationId: string
): Promise<void> {
  const db = getDb()
  const client = await db.connect()

  try {
    await client.query('BEGIN SERIALIZABLE')

    logger.info(`Result persistence transaction started`, {
      attempt_id: attemptId,
      workspace_id: workspaceId,
      correlation_id: correlationId,
    })

    // Load and verify attempt still exists and is in correct state
    const attemptResult = await client.query(
      `
      SELECT id, workspace_id, user_id, status
      FROM attempts
      WHERE id = $1 AND workspace_id = $2
      FOR UPDATE
      `,
      [attemptId, workspaceId]
    )

    if (attemptResult.rows.length === 0) {
      await client.query('ROLLBACK')
      throw new Error(`Attempt not found: ${attemptId}`)
    }

    const attempt = attemptResult.rows[0]!

    if (attempt.status === 'COMPLETED') {
      await client.query('ROLLBACK')
      logger.warn(`Attempt already completed`, {
        attempt_id: attemptId,
        workspace_id: workspaceId,
        correlation_id: correlationId,
      })
      return
    }

    // Update attempt with grading result
    await client.query(
      `
      UPDATE attempts
      SET
        final_score = $1,
        score_percent = $2,
        passed = $3,
        grading_result = $4,
        status = 'COMPLETED',
        graded_at = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND workspace_id = $7
      `,
      [
        gradingResult.score,
        gradingResult.score_percent,
        gradingResult.passed,
        JSON.stringify(gradingResult),
        gradingResult.graded_at,
        attemptId,
        workspaceId,
      ]
    )

    // Insert audit log entry
    await client.query(
      `
      INSERT INTO attempt_audit_log (
        attempt_id, workspace_id, user_id, event_type, event_data, correlation_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `,
      [
        attemptId,
        workspaceId,
        attempt.user_id,
        'grading_completed',
        JSON.stringify({
          score: gradingResult.score,
          score_percent: gradingResult.score_percent,
          passed: gradingResult.passed,
          processing_time_ms: gradingResult.processing_time_ms,
        }),
        correlationId,
      ]
    )

    await client.query('COMMIT')

    logger.info(`Grading result persisted`, {
      attempt_id: attemptId,
      workspace_id: workspaceId,
      user_id: attempt.user_id,
      correlation_id: correlationId,
      score: gradingResult.score,
      score_percent: gradingResult.score_percent,
      passed: gradingResult.passed,
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      logger.error(`Rollback error`, {
        attempt_id: attemptId,
        error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      })
    }

    logger.error(`Grading result persistence error`, {
      attempt_id: attemptId,
      workspace_id: workspaceId,
      correlation_id: correlationId,
      error: error instanceof Error ? error.message : String(error),
    })

    throw error
  } finally {
    client.release()
  }
}

/**
 * Verify attempt result was persisted correctly
 */
export async function verifyResultPersistence(
  workspaceId: string,
  attemptId: string
): Promise<boolean> {
  try {
    const db = getDb()
    const result = await db.query(
      `
      SELECT grading_result, status
      FROM attempts
      WHERE id = $1 AND workspace_id = $2
      `,
      [attemptId, workspaceId]
    )

    if (result.rows.length === 0) {
      return false
    }

    const attempt = result.rows[0]!
    return attempt.status === 'COMPLETED' && attempt.grading_result !== null
  } catch (error) {
    logger.error(`Result verification error`, {
      attempt_id: attemptId,
      workspace_id: workspaceId,
      error: error instanceof Error ? error.message : String(error),
    })

    return false
  }
}
