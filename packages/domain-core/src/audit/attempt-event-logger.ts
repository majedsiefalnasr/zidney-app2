/**
 * Attempt Event Logger
 *
 * Append-only event logging for attempt lifecycle.
 * INSERT only - UPDATEs blocked by trigger.
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T030 (Event logger service)
 */

import { createLogger } from '@zidney/logging'
import { Pool, PoolClient } from 'pg'

const logger = createLogger('AttemptEventLogger')

export type AttemptEventType =
  | 'START'
  | 'RESUME'
  | 'PAUSE'
  | 'ANSWER_SUBMIT'
  | 'TIME_WARNING'
  | 'SUBMIT_REQUEST'
  | 'FINALIZED'
  | 'GRADED'
  | 'ARCHIVED'

export interface LogAttemptEventOptions {
  attemptId: string
  eventType: AttemptEventType
  payload?: Record<string, any>
  client?: PoolClient // Optional - use existing transaction
  currentUserId?: string
}

export interface AttemptEvent {
  id: string
  attempt_id: string
  event_type: string
  event_payload: Record<string, any>
  occurred_at: Date
  created_at: Date
  created_by: string
}

const VALID_EVENTS: AttemptEventType[] = [
  'START',
  'RESUME',
  'PAUSE',
  'ANSWER_SUBMIT',
  'TIME_WARNING',
  'SUBMIT_REQUEST',
  'FINALIZED',
  'GRADED',
  'ARCHIVED',
]

/**
 * Log an attempt event (append-only)
 *
 * Validates event_type is in allowed ENUM
 * Sets occurred_at = NOW() (server-authoritative)
 * Retries on lock timeout with exponential backoff
 */
export async function logAttemptEvent(
  options: LogAttemptEventOptions,
  pool: Pool
): Promise<void> {
  const {
    attemptId,
    eventType,
    payload = {},
    client,
    currentUserId = 'system',
  } = options

  // Validate event_type
  if (!VALID_EVENTS.includes(eventType)) {
    throw new Error(`Invalid event_type: ${eventType}`)
  }

  // Use provided client or get from pool
  const conn = client || (await pool.connect())

  let attempt = 0
  let lastError: Error | null = null

  try {
    // Retry logic: exponential backoff on lock timeout
    while (attempt < 3) {
      try {
        await conn.query(
          `INSERT INTO attempt_events 
           (attempt_id, event_type, event_payload, occurred_at, created_at, created_by)
           VALUES ($1, $2, $3, now(), now(), $4)`,
          [attemptId, eventType, JSON.stringify(payload), currentUserId]
        )

        logger.info('Attempt event logged', {
          attempt_id: attemptId,
          event_type: eventType,
          attempt_number: attempt + 1,
          correlation_id: (global as any).correlationId,
        })

        return
      } catch (error: any) {
        // Lock timeout - retry
        if (error.code === 'LOCK_TIMEOUT' && attempt < 2) {
          const backoffMs = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
          logger.warn('Lock timeout, retrying', {
            attempt: attempt + 1,
            backoff_ms: backoffMs,
          })
          await new Promise((r) => setTimeout(r, backoffMs))
          attempt++
          lastError = error
          continue
        }

        throw error
      }
    }

    if (lastError) throw lastError
  } finally {
    // Release connection if we got it from pool
    if (!client && conn) {
      try {
        (conn as any).release?.()
      } catch (_) {
        // Ignore release errors
      }
    }
  }
}

/**
 * Query attempt event history (read-only)
 */
export async function getAttemptEventHistory(
  attemptId: string,
  pool: Pool
): Promise<AttemptEvent[]> {
  const result = await pool.query(
    `SELECT id, attempt_id, event_type, event_payload, occurred_at, created_at, created_by
     FROM attempt_events 
     WHERE attempt_id = $1 
     ORDER BY occurred_at ASC`,
    [attemptId]
  )

  return result.rows as AttemptEvent[]
}

/**
 * Count events by type for an attempt
 */
export async function countAttemptEventsByType(
  attemptId: string,
  pool: Pool
): Promise<Record<string, number>> {
  const result = await pool.query(
    `SELECT event_type, COUNT(*) as count
     FROM attempt_events 
     WHERE attempt_id = $1 
     GROUP BY event_type`,
    [attemptId]
  )

  const counts: Record<string, number> = {}
  for (const row of result.rows) {
    counts[row.event_type] = parseInt(row.count)
  }

  return counts
}
