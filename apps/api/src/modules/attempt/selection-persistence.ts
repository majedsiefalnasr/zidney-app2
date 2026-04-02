/**
 * Selection Persistence Module
 *
 * File: apps/api/src/modules/attempt/selection-persistence.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Tasks: T019 (base), T033 (manual-first ordering extension)
 *
 * Responsibility:
 *   - Persist auto-selected question assignments to attempt_questions in a single
 *     atomic INSERT inside an open transaction provided by the caller.
 *   - Enforce UNIQUE(attempt_id, question_id) via ON CONFLICT DO NOTHING and
 *     assert that the inserted row count matches expectations.
 *   - Support hybrid ordering: manual IDs occupy order[0..M-1], auto IDs follow.
 *
 * Only PoolClient is accepted — callers must hold an open transaction.
 * No commits or rollbacks here.
 *
 * ADRs: ADR-0001 (workspace isolation), ADR-0002 (snapshot immutability)
 */

import { createLogger } from '@zidney/logger'
import type { PoolClient } from 'pg'

import type { BlockAssignment } from '@zidney/domain-core'

const logger = createLogger('selection-persistence')

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PersistAutoSelectionsInput {
  client: PoolClient
  workspaceId: string
  attemptId: string
  /**
   * Auto-selected assignments from runAutoSelection().
   * question_order within this array is 0-indexed relative to
   * the auto portion of the final set. Call with offset when
   * manual IDs precede them.
   */
  assignments: BlockAssignment[]
  /** Offset applied to question_order for hybrid mode (manual count). */
  orderOffset?: number
}

export interface PersistManualSelectionsInput {
  client: PoolClient
  workspaceId: string
  attemptId: string
  /** Manually-assigned question IDs in their original order. Occupy order = 0..N-1. */
  manualQuestionIds: string[]
}

// ── Auto-selection persistence ────────────────────────────────────────────────

/**
 * Insert attempt_questions rows for auto-selected candidates.
 *
 * Uses ON CONFLICT DO NOTHING to tolerate idempotency re-runs. After the
 * INSERT the row count is asserted — a mismatch indicates a concurrency
 * duplicate and the caller should abort the transaction.
 *
 * @throws Error when insertedCount !== assignments.length (after offset handling)
 */
export async function persistAutoSelections({
  client,
  workspaceId,
  attemptId,
  assignments,
  orderOffset = 0,
}: PersistAutoSelectionsInput): Promise<void> {
  if (assignments.length === 0) return

  // Build parameterized VALUES for a single multi-row INSERT
  const values: unknown[] = []
  const placeholders: string[] = []
  let paramIdx = 1

  for (const assignment of assignments) {
    const order = assignment.order + orderOffset
    placeholders.push(
      `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
    )
    values.push(workspaceId, attemptId, assignment.questionId, order, assignment.criteriaBlockId)
  }

  const sql = `
    INSERT INTO attempt_questions
      (workspace_id, attempt_id, question_id, question_order, criteria_block_id)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (attempt_id, question_id) DO NOTHING
  `

  const result = await client.query(sql, values)

  if (result.rowCount !== assignments.length) {
    logger.warn('selection-persistence: row count mismatch — possible duplicate', {
      expected: assignments.length,
      inserted: result.rowCount,
      attemptId,
      workspaceId,
    })
    // Row count mismatch after idempotency guard — treat as duplicate conflict
    throw new Error(
      `AUTO_SELECTION_DUPLICATE: expected ${assignments.length} rows, inserted ${result.rowCount}`
    )
  }
}

// ── Manual-selection persistence ─────────────────────────────────────────────

/**
 * Insert attempt_questions rows for manually-assigned questions in a hybrid exam.
 * Manual questions occupy order positions 0..N-1.
 */
export async function persistManualSelections({
  client,
  workspaceId,
  attemptId,
  manualQuestionIds,
}: PersistManualSelectionsInput): Promise<void> {
  if (manualQuestionIds.length === 0) return

  const values: unknown[] = []
  const placeholders: string[] = []
  let paramIdx = 1

  for (let i = 0; i < manualQuestionIds.length; i++) {
    const questionId = manualQuestionIds[i]!
    placeholders.push(
      `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
    )
    values.push(workspaceId, attemptId, questionId, i, null)
  }

  const sql = `
    INSERT INTO attempt_questions
      (workspace_id, attempt_id, question_id, question_order, criteria_block_id)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (attempt_id, question_id) DO NOTHING
  `

  await client.query(sql, values)
}
