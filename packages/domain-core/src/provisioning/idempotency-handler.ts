/**
 * Provisioning Tasks Idempotency Handler
 *
 * Purpose:
 * Handle UNIQUE constraint violations when duplicate provisioning requests arrive.
 * Ensures idempotent behavior at both app and DB level.
 *
 * File: packages/domain-core/src/provisioning/idempotency-handler.ts
 * Created: 2026-02-16
 * Status: CRITICAL - Production gate requirement
 *
 * Scenario:
 * 1. API call #1 inserts provisioning_tasks → SUCCESS
 * 2. API call #2 (duplicate) inserts provisioning_tasks → UNIQUE constraint violation (23505)
 * 3. Handler detects 23505, queries existing task, returns existing task ID
 * 4. Worker processes same task only once (idempotent)
 *
 * Error Code 23505 = UNIQUE violation
 * Error Code 23503 = FK constraint violation (workspace deleted)
 *
 * This layer ensures idempotency is enforced across API + DB.
 */

import { createLogger } from '@zidney/logger'
import type { Pool } from 'pg'

const logger = createLogger('ProvisioningIdempotencyHandler')

export interface ProvisioningTaskRecord {
  id: string
  workspace_id: string
  idempotency_key: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'DLQ'
  created_at: string
  attempt_count: number
}

export interface IdempotencyResult {
  task_id: string
  is_duplicate: boolean
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'DLQ'
  error?: string
}

/**
 * Insert provisioning task with idempotency handling
 *
 * If UNIQUE constraint violated (duplicate):
 * - Query existing task
 * - Return existing task ID
 * - Treat as success (already queued)
 *
 * @param pool Master database pool
 * @param workspace_id Tenant workspace ID
 * @param idempotency_key Unique idempotency token
 * @param task_type Task type (INIT_TENANT_SCHEMA, APPLY_MIGRATION)
 * @param created_by Creator user ID
 * @returns IdempotencyResult with task_id and is_duplicate flag
 */
export async function insertProvisioningTaskIdempotent(
  pool: Pool,
  workspace_id: string,
  idempotency_key: string,
  task_type: string = 'INIT_TENANT_SCHEMA',
  created_by?: string
): Promise<IdempotencyResult> {
  try {
    // Attempt insert (will fail if duplicate)
    const insertResult = await pool.query(
      `
      INSERT INTO provisioning_tasks (
        workspace_id,
        idempotency_key,
        status,
        task_type,
        attempt_count,
        max_attempts,
        created_at,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      RETURNING id, status, TRUE as is_new
      `,
      [workspace_id, idempotency_key, 'PENDING', task_type, 0, 3, created_by]
    )

    const task = insertResult.rows[0]

    logger.info('Provisioning task created (NEW)', {
      task_id: task.id,
      workspace_id,
      idempotency_key,
      is_duplicate: false,
    })

    return {
      task_id: task.id,
      is_duplicate: false,
      status: task.status,
    }
  } catch (error) {
    // Check for UNIQUE constraint violation (error code 23505)
    if (error instanceof Error && error.message && error.message.includes('23505')) {
      logger.warn('UNIQUE constraint violation - duplicate provisioning request', {
        workspace_id,
        idempotency_key,
        error_code: '23505',
      })

      // Query existing task
      try {
        const existingTaskResult = await pool.query(
          `
          SELECT id, status, attempt_count
          FROM provisioning_tasks
          WHERE workspace_id = $1
            AND idempotency_key = $2
          LIMIT 1
          `,
          [workspace_id, idempotency_key]
        )

        if (existingTaskResult.rows.length === 0) {
          logger.error(
            'UNIQUE violation detected but no existing task found (database inconsistency)',
            {
              workspace_id,
              idempotency_key,
            }
          )

          throw new Error('Database inconsistency: UNIQUE violation but task not found')
        }

        const existingTask = existingTaskResult.rows[0]

        logger.info('Provisioning task already exists (DUPLICATE)', {
          task_id: existingTask.id,
          workspace_id,
          idempotency_key,
          status: existingTask.status,
          attempt_count: existingTask.attempt_count,
          is_duplicate: true,
        })

        return {
          task_id: existingTask.id,
          is_duplicate: true,
          status: existingTask.status,
          error: `Duplicate request: task ${existingTask.id} already created (status: ${existingTask.status})`,
        }
      } catch (queryError) {
        logger.error('Failed to query existing task after UNIQUE violation', {
          workspace_id,
          idempotency_key,
          error: queryError instanceof Error ? queryError.message : String(queryError),
        })

        throw queryError
      }
    }

    // Check for FK constraint violation (workspace doesn't exist or is_deleted)
    if (error instanceof Error && error.message && error.message.includes('23503')) {
      logger.warn('FK constraint violation - workspace not found or deleted', {
        workspace_id,
        idempotency_key,
        error_code: '23503',
      })

      throw new Error(`Workspace not found or deleted: ${workspace_id}`)
    }

    // Other errors - propagate
    logger.error('Unexpected error inserting provisioning task', {
      workspace_id,
      idempotency_key,
      error: error instanceof Error ? error.message : String(error),
    })

    throw error
  }
}

/**
 * Check if task is eligible for worker processing
 *
 * Rules:
 * - PENDING: Ready for processing
 * - IN_PROGRESS: Already processing (but timeout elapsed → retry)
 * - COMPLETED: Already done → skip
 * - FAILED: Needs retry → mark IN_PROGRESS
 * - DLQ: Critical error → do not retry
 *
 * @param task Provisioning task record
 * @returns true if task should be processed
 */
export function isTaskEligibleForProcessing(task: ProvisioningTaskRecord): boolean {
  if (task.status === 'PENDING') {
    return true // Ready to process
  }

  if (task.status === 'IN_PROGRESS' && task.attempt_count < 3) {
    // Still retrying - in normal backoff, but if stuck for 1h, retry
    return false // Let timeout handler decide
  }

  if (task.status === 'COMPLETED') {
    return false // Already done
  }

  if (task.status === 'FAILED' && task.attempt_count < 3) {
    return true // Eligible for retry
  }

  if (task.status === 'DLQ') {
    return false // Critical error, manual intervention required
  }

  return false
}

export default {
  insertProvisioningTaskIdempotent,
  isTaskEligibleForProcessing,
}
