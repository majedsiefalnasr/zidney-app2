/**
 * Lock Retry Handler
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase D, T033
 *
 * Purpose: Handle pessimistic lock acquisition with retry strategy
 * Requirements: 5s timeout, 3 retries with exponential backoff (100ms, 200ms, 400ms)
 *
 * Responsibilities:
 * - Acquire SELECT...FOR UPDATE NOWAIT lock
 * - Implement exponential backoff on lock timeout
 * - Retry up to 3 times
 * - Return 409 CONFLICT after 3 failures
 *
 * Constitutional Compliance:
 * - ADR-0001: workspace_id on all queries (scoped queries only)
 * - Pessimistic locking for concurrency safety
 * - Structured logging with correlation_id
 * - No global state
 *
 * Pattern:
 * ```typescript
 * const result = await executeWithLockRetry(
 *   tenantDb, attemptId, workspaceId,
 *   async (attempt) => {
 *     return submitAttempt(attempt)
 *   }
 * )
 * ```
 */

import { Pool, PoolClient } from 'pg'
import Logger from '../utils/logger'

/**
 * Options for lock retry execution
 */
interface LockRetryOptions {
  maxRetries?: number // Default: 3
  initialBackoffMs?: number // Default: 100
  correlationId?: string
}

/**
 * Execute operation with pessimistic lock and retry strategy
 *
 * Algorithm:
 * 1. Attempt FOR UPDATE NOWAIT lock (5s timeout, PostgreSQL default)
 * 2. On lock timeout (40P01):
 *    - Wait exponentially increasing time (100ms, 200ms, 400ms)
 *    - Retry lock acquisition
 * 3. On 3rd failure: Return 409 CONFLICT
 *
 * @param db - Database connection (tenant-scoped)
 * @param attemptId - Attempt UUID to lock
 * @param workspaceId - Workspace UUID (scoping)
 * @param operation - Async operation to execute inside lock
 * @param options - Retry configuration
 * @returns Promise<T> - Result from operation or error
 * @throws Error with code 'LOCK_TIMEOUT' if all retries exhausted
 */
export async function executeWithLockRetry<T>(
  db: PoolClient | Pool,
  attemptId: string,
  workspaceId: string,
  operation: (attempt: any) => Promise<T>,
  options: LockRetryOptions = {}
): Promise<T> {
  const logger = new Logger('lock-retry-handler')
  const maxRetries = options.maxRetries ?? 3
  const initialBackoffMs = options.initialBackoffMs ?? 100
  const correlationId = options.correlationId || 'unknown'

  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Calculate backoff: 100ms, 200ms, 400ms
      if (attempt > 0) {
        const backoffMs = initialBackoffMs * Math.pow(2, attempt - 1)
        logger.debug('Lock acquisition failed, backing off', {
          correlation_id: correlationId,
          workspace_id: workspaceId,
          attempt_id: attemptId,
          retry_attempt: attempt,
          backoff_ms: backoffMs,
        })
        await sleep(backoffMs)
      }

      // Attempt pessimistic lock with NOWAIT (5s timeout)
      // NOWAIT means don't wait; if locked, return 40P01 (lock timeout) immediately
      const lockResult = await db.query(
        `
        SELECT * FROM attempts
        WHERE id = $1 AND workspace_id = $2
        FOR UPDATE NOWAIT
        `,
        [attemptId, workspaceId]
      )

      if (lockResult.rows.length === 0) {
        // Attempt not found
        const error = new Error('Attempt not found')
        ;(error as any).code = 'ATTEMPT_NOT_FOUND'
        ;(error as any).statusCode = 404
        throw error
      }

      const attemptRecord = lockResult.rows[0]

      // Lock acquired; execute operation
      logger.debug('Pessimistic lock acquired', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        attempt_id: attemptId,
        retry_attempt: attempt,
      })

      const result = await operation(attemptRecord)

      logger.debug('Lock operation completed', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        attempt_id: attemptId,
        retry_attempt: attempt,
      })

      return result
    } catch (err) {
      lastError = err as Error

      // Check if error is lock timeout (PostgreSQL error code 40P01)
      const pgError = err as any
      if (pgError.code === '40P01' || pgError.message?.includes('deadlock')) {
        logger.warn('Lock timeout (40P01)', {
          correlation_id: correlationId,
          workspace_id: workspaceId,
          attempt_id: attemptId,
          retry_attempt: attempt,
          error: pgError.message,
        })

        // Continue to retry
        if (attempt === maxRetries - 1) {
          // Last retry exhausted
          const error = new Error(`Lock timeout after ${maxRetries} retries`)
          ;(error as any).code = 'ATTEMPT_LOCKED'
          ;(error as any).statusCode = 409
          throw error
        }
      } else {
        // Non-lock error; don't retry
        logger.error('Non-lock error during lock acquisition', {
          correlation_id: correlationId,
          workspace_id: workspaceId,
          attempt_id: attemptId,
          retry_attempt: attempt,
          error: pgError.message,
          pg_code: pgError.code,
        })
        throw err
      }
    }
  }

  // Should not reach here, but if we do, throw the last error
  throw lastError || new Error('Lock retry exhausted')
}

/**
 * Simple sleep utility
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
