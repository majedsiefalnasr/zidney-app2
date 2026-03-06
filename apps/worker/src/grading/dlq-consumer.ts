/**
 * Dead Letter Queue (DLQ) Consumer
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T041
 *
 * Processes failed grading jobs from dead-letter queue.
 *
 * Key Properties:
 * - MANUAL INVESTIGATION: DLQ jobs require human review
 * - PERSISTENCE: Failed job details stored for audit trail
 * - ALERTING: Notify instructors/ops of grading failures
 * - IDEMPOTENT: Safe to reprocess same DLQ record
 *
 * Behavior:
 * 1. Poll failed_grading_jobs table
 * 2. Store error details (message, stack, retry count)
 * 3. Create alert/notification for instructor
 * 4. Mark as reviewed
 * 5. Log for manual investigation
 *
 * ADRs: ADR-0001 (tenant isolation)
 */

import { logger } from '@zidney/logger'
import { randomUUID } from 'crypto'
import type { Pool } from 'pg'

/**
 * Interface: DLQ Record
 */
interface DLQRecord {
  id: string
  job_id: string
  attempt_id: string
  workspace_id: string
  error_message: string
  error_stack?: string
  last_retry_at: Date
  num_retries: number
  created_at: Date
  reviewed?: boolean
  reviewed_at?: Date | null
}

/**
 * Interface: DLQ Consumer State
 */
interface DLQConsumerState {
  isRunning: boolean
  recordsProcessed: number
  recordsFailed: number
}

const dlqConsumerState: DLQConsumerState = {
  isRunning: false,
  recordsProcessed: 0,
  recordsFailed: 0,
}

/**
 * Start DLQ Consumer
 *
 * Continuously polls failed_grading_jobs table for unreviewed failures.
 * Processes each failure by storing details and creating notifications.
 *
 * @param masterDb - Master database pool
 * @returns Promise that resolves when consumer stops
 */
export async function startDLQConsumer(masterDb: Pool): Promise<void> {
  dlqConsumerState.isRunning = true

  logger.info(
    {
      service: 'dlq-consumer',
      action: 'consumer_started',
    },
    'DLQ consumer started'
  )

  try {
    while (dlqConsumerState.isRunning) {
      try {
        // Poll for unreviewed DLQ records
        const records = await getDLQRecords(masterDb, {
          reviewed: false,
          limit: 10,
        })

        if (records.length === 0) {
          // No pending records; backpressure
          await sleep(1000)
          continue
        }

        logger.debug(
          {
            service: 'dlq-consumer',
            action: 'dlq_records_fetched',
            count: records.length,
          },
          'Fetched pending DLQ records'
        )

        // Process each record
        for (const record of records) {
          try {
            await processDLQRecord(masterDb, record)
            dlqConsumerState.recordsProcessed++
          } catch (err) {
            logger.error(
              {
                service: 'dlq-consumer',
                action: 'dlq_record_processing_error',
                dlq_id: record.id,
                job_id: record.job_id,
                attempt_id: record.attempt_id,
                error: err instanceof Error ? err.message : String(err),
              },
              'Error processing DLQ record'
            )

            dlqConsumerState.recordsFailed++
          }
        }

        // Backpressure
        await sleep(500)
      } catch (err) {
        logger.error(
          {
            service: 'dlq-consumer',
            action: 'consumer_error',
            error: err instanceof Error ? err.message : String(err),
            error_stack: err instanceof Error ? err.stack : undefined,
          },
          'Consumer loop error'
        )

        await sleep(1000)
      }
    }
  } finally {
    logger.info(
      {
        service: 'dlq-consumer',
        action: 'consumer_stopped',
        records_processed: dlqConsumerState.recordsProcessed,
        records_failed: dlqConsumerState.recordsFailed,
      },
      'DLQ consumer stopped'
    )
  }
}

/**
 * Stop DLQ consumer gracefully
 */
export async function stopDLQConsumer(): Promise<void> {
  logger.info(
    {
      service: 'dlq-consumer',
      action: 'consumer_stop_requested',
    },
    'Stop signal received for DLQ consumer'
  )

  dlqConsumerState.isRunning = false
}

/**
 * Process a single DLQ record
 *
 * Steps:
 * 1. Log detailed error information
 * 2. Create notification for instructor/ops
 * 3. Mark record as reviewed
 * 4. Store evidence for audit trail
 *
 * @param masterDb - Master database pool
 * @param record - DLQ record to process
 */
async function processDLQRecord(masterDb: Pool, record: DLQRecord): Promise<void> {
  logger.error(
    {
      service: 'dlq-consumer',
      action: 'dlq_record_details',
      dlq_id: record.id,
      job_id: record.job_id,
      attempt_id: record.attempt_id,
      workspace_id: record.workspace_id,
      num_retries: record.num_retries,
      error_message: record.error_message,
      error_snippet: record.error_stack
        ? record.error_stack.split('\n').slice(0, 3).join('\n')
        : undefined,
      last_retry_at: record.last_retry_at,
    },
    'Failed grading job moved to DLQ (requires manual inspection)'
  )

  // Mark as reviewed
  await markDLQRecordReviewed(masterDb, record.id)

  // Create notification (placeholder; implement per notification system)
  await createGradingFailureNotification(
    masterDb,
    record.workspace_id,
    record.attempt_id,
    record.error_message
  )

  logger.info(
    {
      service: 'dlq-consumer',
      action: 'dlq_record_processed',
      dlq_id: record.id,
      job_id: record.job_id,
      attempt_id: record.attempt_id,
      workspace_id: record.workspace_id,
    },
    'DLQ record processed and marked for review'
  )
}

/**
 * Database: Get DLQ records
 *
 * @param masterDb - Master database pool
 * @param options - Filter options (reviewed, limit)
 * @returns Array of DLQ records
 */
async function getDLQRecords(
  masterDb: Pool,
  options?: { reviewed?: boolean; limit?: number }
): Promise<DLQRecord[]> {
  const limit = options?.limit || 10

  let query = `
    SELECT 
      id,
      job_id,
      attempt_id,
      workspace_id,
      error_message,
      error_stack,
      last_retry_at,
      num_retries,
      created_at,
      reviewed,
      reviewed_at
    FROM failed_grading_jobs
  `

  const params: any[] = []

  if (options?.reviewed !== undefined) {
    query += ` WHERE reviewed = $1`
    params.push(options.reviewed)
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`
  params.push(limit)

  const result = await masterDb.query(query, params)

  return result.rows.map((row) => ({
    id: row.id,
    job_id: row.job_id,
    attempt_id: row.attempt_id,
    workspace_id: row.workspace_id,
    error_message: row.error_message,
    error_stack: row.error_stack,
    last_retry_at: row.last_retry_at,
    num_retries: row.num_retries,
    created_at: row.created_at,
    reviewed: row.reviewed,
    reviewed_at: row.reviewed_at,
  }))
}

/**
 * Database: Mark DLQ record as reviewed
 *
 * @param masterDb - Master database pool
 * @param dlqId - DLQ record ID
 */
async function markDLQRecordReviewed(masterDb: Pool, dlqId: string): Promise<void> {
  await masterDb.query(
    `
    UPDATE failed_grading_jobs
    SET 
      reviewed = true,
      reviewed_at = NOW(),
      updated_at = NOW()
    WHERE id = $1
    `,
    [dlqId]
  )
}

/**
 * Create notification for grading failure
 *
 * Placeholder for notification system integration.
 * In production, this would:
 * - Create record in notifications table
 * - Send email to instructor
 * - Update ops dashboard
 *
 * @param masterDb - Master database pool
 * @param workspaceId - Workspace UUID
 * @param attemptId - Attempt UUID
 * @param errorMessage - Error for notification
 */
async function createGradingFailureNotification(
  masterDb: Pool,
  workspaceId: string,
  attemptId: string,
  errorMessage: string
): Promise<void> {
  // Check if notifications table exists
  try {
    const notificationId = randomUUID()
    const createdAt = new Date()

    await masterDb.query(
      `
      INSERT INTO notifications (
        id,
        workspace_id,
        type,
        related_entity_type,
        related_entity_id,
        title,
        body,
        read,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        notificationId,
        workspaceId,
        'GRADING_FAILED',
        'ATTEMPT',
        attemptId,
        'Grading Failed',
        `Automatic grading failed for attempt ${attemptId}: ${errorMessage}. Manual review required.`,
        false,
        createdAt,
        createdAt,
      ]
    )

    logger.debug(
      {
        service: 'dlq-consumer',
        action: 'notification_created',
        notification_id: notificationId,
        workspace_id: workspaceId,
        attempt_id: attemptId,
      },
      'Grading failure notification created'
    )
  } catch (err) {
    // Notifications table may not exist; log but don't fail
    logger.warn(
      {
        service: 'dlq-consumer',
        action: 'notification_creation_failed',
        attempt_id: attemptId,
        error: err instanceof Error ? err.message : String(err),
      },
      'Could not create notification (table may not exist)'
    )
  }
}

/**
 * Get DLQ consumer state (for monitoring)
 */
export function getDLQConsumerState() {
  return { ...dlqConsumerState }
}

/**
 * Utility: Sleep for milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
