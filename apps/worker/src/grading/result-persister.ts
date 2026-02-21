/**
 * Result Persistence (Atomic Update)
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T039
 *
 * Atomically updates attempt with grading result in single transaction.
 *
 * Key Properties:
 * - ATOMIC: All-or-nothing transaction
 * - IDEMPOTENT: Checks status before update to prevent double-finalization
 * - TENANT-SCOPED: Uses workspace_id on all queries
 * - IMMUTABLE: Stores entire result_snapshot for audit trail
 *
 * Transaction Flow:
 * 1. BEGIN TRANSACTION
 * 2. UPDATE attempts SET status=FINALIZED WHERE status=SUBMITTED
 * 3. Verify exactly one row updated (idempotency check)
 * 4. COMMIT
 * 5. Return finalized attempt
 *
 * ADRs: ADR-0001 (tenant isolation), ADR-0002 (snapshot immutability)
 */

import { Attempt, AttemptStatus } from '@zidney/types/attempt'
import { randomUUID } from 'crypto'
import { Pool } from 'pg'
import { logger } from '../services/logger'
import { GradeResult } from './grader'

/**
 * Error: Attempt already finalized
 */
export class AttemptAlreadyFinalizedError extends Error {
  constructor(attemptId: string) {
    super(`Attempt ${attemptId} is already finalized`)
    this.name = 'AttemptAlreadyFinalizedError'
  }
}

/**
 * Atomically finalize attempt with grading result
 *
 * Updates attempt record in single transaction:
 * - Changes status from SUBMITTED to FINALIZED
 * - Stores score (0-100)
 * - Stores passed (boolean)
 * - Stores result_snapshot (complete result object)
 * - Sets finalized_at = NOW() (server time)
 *
 * Idempotency: If attempt already FINALIZED, throws error.
 * Caller must decide: skip or handle as error.
 *
 * @param tenantDb - Tenant database pool
 * @param attempt - Original attempt (before finalization)
 * @param gradeResult - Grading result from grader.ts
 * @param workspaceId - Workspace UUID (tenant isolation)
 * @returns Finalized attempt record
 * @throws AttemptAlreadyFinalizedError if already finalized
 * @throws Error if update fails
 */
export async function finalizeAttempt(
  tenantDb: Pool,
  attempt: Attempt,
  gradeResult: GradeResult,
  workspaceId: string
): Promise<Attempt> {
  const correlationId = randomUUID()

  logger.debug(
    {
      service: 'result-persister',
      action: 'finalization_started',
      attempt_id: attempt.id,
      workspace_id: workspaceId,
      score: gradeResult.score,
      passed: gradeResult.passed,
    },
    'Starting attempt finalization'
  )

  // Use transaction for atomicity
  const client = await tenantDb.connect()

  try {
    await client.query('BEGIN')

    // UPDATE attempts with result
    // Only update if status is SUBMITTED (idempotency check)
    const result = await client.query(
      `
      UPDATE attempts
      SET 
        status = $1,
        finalized_at = NOW(),
        score = $2,
        passed = $3,
        result_snapshot = $4,
        updated_at = NOW()
      WHERE id = $5 
        AND workspace_id = $6 
        AND status = $7
      RETURNING 
        id,
        workspace_id,
        user_id,
        attempt_type,
        exam_id,
        question_snapshot,
        question_order,
        grading_config_snapshot,
        mode,
        flags_snapshot,
        time_limit_snapshot,
        exam_version,
        expected_schema_version,
        expected_product_version,
        started_at,
        server_start_time,
        submitted_at,
        finalized_at,
        certificate_enabled,
        single_attempt_rule,
        status,
        score,
        passed,
        result_snapshot,
        created_at,
        updated_at
      `,
      [
        AttemptStatus.FINALIZED,
        gradeResult.score,
        gradeResult.passed,
        JSON.stringify(gradeResult),
        attempt.id,
        workspaceId,
        AttemptStatus.SUBMITTED,
      ]
    )

    // Verify update succeeded (exactly one row)
    if (!result.rows || result.rows.length === 0) {
      await client.query('ROLLBACK')

      logger.warn(
        {
          service: 'result-persister',
          action: 'attempt_not_finalized_no_rows',
          attempt_id: attempt.id,
          workspace_id: workspaceId,
          current_status: attempt.status,
        },
        'Attempt not found or not in SUBMITTED state'
      )

      throw new AttemptAlreadyFinalizedError(attempt.id)
    }

    if (result.rows.length > 1) {
      await client.query('ROLLBACK')

      logger.error(
        {
          service: 'result-persister',
          action: 'unexpected_multiple_updates',
          attempt_id: attempt.id,
          workspace_id: workspaceId,
          rows_updated: result.rows.length,
        },
        'Multiple rows updated; transaction rolled back'
      )

      throw new Error(
        `Expected 1 row updated, got ${result.rows.length} (database integrity error)`
      )
    }

    await client.query('COMMIT')

    const updated = result.rows[0]

    logger.info(
      {
        service: 'result-persister',
        action: 'attempt_finalized',
        attempt_id: attempt.id,
        workspace_id: workspaceId,
        score: gradeResult.score,
        passed: gradeResult.passed,
        finalized_at: updated.finalized_at,
      },
      'Attempt finalization completed'
    )

    // Return finalized attempt
    return {
      id: updated.id,
      workspace_id: updated.workspace_id,
      user_id: updated.user_id,
      attempt_type: updated.attempt_type,
      exam_id: updated.exam_id,
      question_snapshot: updated.question_snapshot,
      question_order: updated.question_order,
      grading_config_snapshot: updated.grading_config_snapshot,
      mode: updated.mode,
      flags_snapshot: updated.flags_snapshot,
      time_limit_snapshot: updated.time_limit_snapshot,
      exam_version: updated.exam_version,
      expected_schema_version: updated.expected_schema_version,
      expected_product_version: updated.expected_product_version,
      started_at: updated.started_at,
      server_start_time: updated.server_start_time,
      submitted_at: updated.submitted_at,
      finalized_at: updated.finalized_at,
      certificate_enabled: updated.certificate_enabled,
      single_attempt_rule: updated.single_attempt_rule,
      status: updated.status,
      score: updated.score,
      passed: updated.passed,
      result_snapshot: updated.result_snapshot,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    } as Attempt
  } catch (err) {
    if (err instanceof AttemptAlreadyFinalizedError) {
      throw err
    }

    try {
      await client.query('ROLLBACK')
    } catch (rollbackErr) {
      logger.error(
        {
          service: 'result-persister',
          action: 'rollback_error',
          attempt_id: attempt.id,
          workspace_id: workspaceId,
          error:
            rollbackErr instanceof Error
              ? rollbackErr.message
              : String(rollbackErr),
        },
        'Error rolling back transaction'
      )
    }

    logger.error(
      {
        service: 'result-persister',
        action: 'finalization_error',
        attempt_id: attempt.id,
        workspace_id: workspaceId,
        error: err instanceof Error ? err.message : String(err),
        error_stack: err instanceof Error ? err.stack : undefined,
      },
      'Error during attempt finalization'
    )

    throw err
  } finally {
    client.release()
  }
}

/**
 * Verify attempt is in SUBMITTED state (pre-finalization check)
 *
 * @param tenantDb - Tenant database pool
 * @param workspaceId - Workspace UUID
 * @param attemptId - Attempt UUID
 * @returns true if attempt is SUBMITTED, false otherwise
 */
export async function isAttemptSubmitted(
  tenantDb: Pool,
  workspaceId: string,
  attemptId: string
): Promise<boolean> {
  const result = await tenantDb.query(
    `
    SELECT status FROM attempts
    WHERE id = $1 AND workspace_id = $2
    `,
    [attemptId, workspaceId]
  )

  if (result.rows.length === 0) {
    return false
  }

  return result.rows[0].status === AttemptStatus.SUBMITTED
}

/**
 * Check if attempt is already finalized
 *
 * @param tenantDb - Tenant database pool
 * @param workspaceId - Workspace UUID
 * @param attemptId - Attempt UUID
 * @returns true if attempt is FINALIZED, false otherwise
 */
export async function isAttemptFinalized(
  tenantDb: Pool,
  workspaceId: string,
  attemptId: string
): Promise<boolean> {
  const result = await tenantDb.query(
    `
    SELECT status FROM attempts
    WHERE id = $1 AND workspace_id = $2
    `,
    [attemptId, workspaceId]
  )

  if (result.rows.length === 0) {
    return false
  }

  return result.rows[0].status === AttemptStatus.FINALIZED
}
