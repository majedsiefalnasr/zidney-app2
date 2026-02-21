/**
 * Submission Idempotency Validator
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase D, T029
 *
 * Purpose: Triple-layer idempotency check (Redis fast-path, PostgreSQL persistent, status-based)
 * Requirements: Fast idempotency lookup, prevent duplicate submission storage, handle retries gracefully
 *
 * Responsibilities:
 * - Check Redis cache (fast path, 24h TTL)
 * - Check PostgreSQL UNIQUE constraint (persistent layer)
 * - Validate attempt status (final validation)
 * - Return cached response on replay
 *
 * Constitutional Compliance:
 * - ADR-0001: workspace_id on all queries
 * - Idempotency prevents duplicate state mutations
 * - Structured logging with correlation_id
 * - No timestamp trust (server time only)
 *
 * Flow (3 Layers):
 * Layer 1 (Redis): { key: "idempotency:${idempotencyKey}", ttl: 24h }
 * Layer 2 (PostgreSQL): submission_idempotency_keys table UNIQUE constraint
 * Layer 3 (Status): Check attempt status (SUBMITTED/FINALIZED = no-op)
 */

import { Logger } from '@zidney/logging'
import { Pool, PoolClient } from 'pg'

/**
 * Idempotency check result
 */
export interface IdempotencyCheckResult {
  isRetry: boolean // true if this is a replay of previous request
  cachedJobId?: string // job_id from previous attempt (if retry)
  submissionSequence?: number // submission sequence number for this attempt
}

/**
 * Validate submission idempotency using triple-layer approach
 *
 * @param db - Tenant database connection
 * @param redis - Redis client (optional, for fast-path)
 * @param workspaceId - Workspace UUID
 * @param attemptId - Attempt UUID
 * @param idempotencyKey - Client-provided idempotency key (from header)
 * @param logger - Logger instance
 * @param correlationId - Request correlation ID
 * @returns Promise<IdempotencyCheckResult>
 * @throws Error if validation fails
 */
export async function validateSubmissionIdempotency(
  db: PoolClient | Pool,
  redis: any | null,
  workspaceId: string,
  attemptId: string,
  idempotencyKey: string,
  logger: Logger,
  correlationId: string
): Promise<IdempotencyCheckResult> {
  // =========================================================================
  // LAYER 1: Redis Fast-Path (in-memory cache)
  // =========================================================================
  // Fast check if this idempotency key has been seen before
  // Response time: ~1ms compared to ~5-10ms for DB query

  if (redis) {
    const cacheKey = `idempotency:${workspaceId}:${idempotencyKey}`
    const cachedResponse = await redis.get(cacheKey)

    if (cachedResponse) {
      try {
        const cached = JSON.parse(cachedResponse)
        logger.info('Idempotency cache hit (Redis)', {
          correlation_id: correlationId,
          workspace_id: workspaceId,
          attempt_id: attemptId,
          idempotency_key: idempotencyKey,
          cached_job_id: cached.job_id,
        })

        return {
          isRetry: true,
          cachedJobId: cached.job_id,
          submissionSequence: cached.submission_sequence,
        }
      } catch (parseErr) {
        logger.warn('Failed to parse Redis cache entry', {
          correlation_id: correlationId,
          error:
            parseErr instanceof Error ? parseErr.message : String(parseErr),
        })
        // Fall through to Layer 2
      }
    }
  }

  // =========================================================================
  // LAYER 2: PostgreSQL Persistent Layer
  // =========================================================================
  // Check UNIQUE constraint on idempotency_key
  // Ensures exactly one submission per key, persists across restarts

  const dbResult = await db.query(
    `
    SELECT id, submission_sequence, response_status, response_body
    FROM submission_idempotency_keys
    WHERE workspace_id = $1 AND idempotency_key = $2 AND expires_at > NOW()
    LIMIT 1
    `,
    [workspaceId, idempotencyKey]
  )

  if (dbResult.rows.length > 0) {
    const cachedRecord = dbResult.rows[0]

    logger.info('Idempotency cache hit (PostgreSQL)', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      attempt_id: attemptId,
      idempotency_key: idempotencyKey,
      submission_sequence: cachedRecord.submission_sequence,
    })

    // Update Redis cache for next request
    if (redis) {
      const cacheKey = `idempotency:${workspaceId}:${idempotencyKey}`
      const cacheValue = JSON.stringify({
        job_id: cachedRecord.response_body?.data?.job_id,
        submission_sequence: cachedRecord.submission_sequence,
      })

      try {
        await redis.setEx(cacheKey, 24 * 60 * 60, cacheValue) // 24h TTL
      } catch (redisErr) {
        logger.warn('Failed to update Redis cache', {
          correlation_id: correlationId,
          error:
            redisErr instanceof Error ? redisErr.message : String(redisErr),
        })
        // Proceed without cache update; DB layer still works
      }
    }

    return {
      isRetry: true,
      cachedJobId: cachedRecord.response_body?.data?.job_id,
      submissionSequence: cachedRecord.submission_sequence,
    }
  }

  // =========================================================================
  // LAYER 3: Attempt Status Validation (final check)
  // =========================================================================
  // Verify attempt is in valid state for submission
  // Prevents submission of finalized or expired attempts

  const attemptResult = await db.query(
    `
    SELECT id, status
    FROM attempts
    WHERE id = $1 AND workspace_id = $2
    `,
    [attemptId, workspaceId]
  )

  if (attemptResult.rows.length === 0) {
    const err = new Error('Attempt not found')
    ;(err as any).code = 'ATTEMPT_NOT_FOUND'
    ;(err as any).statusCode = 404
    throw err
  }

  const attempt = attemptResult.rows[0]

  // Check if attempt is in valid state for new submission
  if (
    attempt.status === 'FINALIZED' ||
    attempt.status === 'EXPIRED' ||
    attempt.status === 'ABORTED'
  ) {
    const err = new Error(`Cannot submit; attempt is ${attempt.status}`)
    ;(err as any).code = 'ATTEMPT_INVALID_STATE'
    ;(err as any).statusCode = 409
    throw err
  }

  // This is a fresh submission (not a retry)
  logger.debug('Idempotency validation: fresh submission', {
    correlation_id: correlationId,
    workspace_id: workspaceId,
    attempt_id: attemptId,
    idempotency_key: idempotencyKey,
    attempt_status: attempt.status,
  })

  return {
    isRetry: false,
    cachedJobId: undefined,
    submissionSequence: undefined,
  }
}

/**
 * Store submission idempotency key + response for future replay
 *
 * Called AFTER successful submission to cache the response.
 *
 * @param db - Tenant database connection
 * @param redis - Redis client (optional)
 * @param workspaceId - Workspace UUID
 * @param attemptId - Attempt UUID
 * @param idempotencyKey - Client-provided key
 * @param submissionSequence - Ordinal submission number
 * @param responseStatus - HTTP status code
 * @param responseBody - Full response JSON
 * @param logger - Logger instance
 * @param correlationId - Request correlation ID
 * @returns Promise<void>
 */
export async function storeSubmissionIdempotencyKey(
  db: PoolClient | Pool,
  redis: any | null,
  workspaceId: string,
  attemptId: string,
  idempotencyKey: string,
  submissionSequence: number,
  responseStatus: number,
  responseBody: Record<string, any>,
  logger: Logger,
  correlationId: string
): Promise<void> {
  try {
    // Store in PostgreSQL (persistent)
    await db.query(
      `
      INSERT INTO submission_idempotency_keys (
        id, workspace_id, attempt_id, submission_sequence,
        idempotency_key, request_timestamp,
        response_status, response_body,
        created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, NOW(), NOW() + INTERVAL '24 hours')
      ON CONFLICT (attempt_id, submission_sequence) DO UPDATE
      SET response_status = EXCLUDED.response_status,
          response_body = EXCLUDED.response_body
      `,
      [
        crypto.randomUUID(),
        workspaceId,
        attemptId,
        submissionSequence,
        idempotencyKey,
        responseStatus,
        JSON.stringify(responseBody),
      ]
    )

    logger.debug('Stored submission idempotency key (PostgreSQL)', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      attempt_id: attemptId,
      idempotency_key: idempotencyKey,
      submission_sequence: submissionSequence,
    })

    // Update Redis cache (fast-path)
    if (redis) {
      const cacheKey = `idempotency:${workspaceId}:${idempotencyKey}`
      const cacheValue = JSON.stringify({
        job_id: responseBody?.data?.job_id,
        submission_sequence: submissionSequence,
      })

      try {
        await redis.setEx(cacheKey, 24 * 60 * 60, cacheValue) // 24h TTL
        logger.debug('Updated submission idempotency cache (Redis)', {
          correlation_id: correlationId,
          idempotency_key: idempotencyKey,
        })
      } catch (redisErr) {
        logger.warn('Failed to update Redis cache', {
          correlation_id: correlationId,
          error:
            redisErr instanceof Error ? redisErr.message : String(redisErr),
        })
        // Proceed without cache; DB layer still works
      }
    }
  } catch (err) {
    logger.error('Failed to store submission idempotency key', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      attempt_id: attemptId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
