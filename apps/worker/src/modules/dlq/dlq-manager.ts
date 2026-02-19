import { v4 as uuidv4 } from 'uuid'
import { logger } from '../../infrastructure/logger'
import { db } from '../../infrastructure/postgres'
import { JobQueueEntry } from '../queue/job-queue'

/**
 * T052: Dead-letter queue manager
 *
 * Manages DLQ operations:
 * - Create DLQ entries for failed jobs
 * - Store job metadata and error info
 * - Log DLQ moves with correlation_id
 * - Send alert if DLQ size > 10
 */

export class DLQManager {
  /**
   * Move job to dead-letter queue
   */
  async moveToDLQ(
    job: JobQueueEntry,
    errorMessage: string,
    errorStack: string
  ): Promise<string> {
    const dlqId = uuidv4()

    try {
      await db.query(
        `
        INSERT INTO dead_letter_queue (
          id,
          job_id,
          job_type,
          workspace_id,
          workspace_slug,
          attempt_id,
          user_id,
          correlation_id,
          original_payload,
          error_message,
          error_stack,
          retry_count,
          max_retries,
          created_at,
          moved_to_dlq_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
        `,
        [
          dlqId,
          job.job_id,
          job.type,
          job.workspace_id,
          job.workspace_slug,
          job.payload?.attempt_id || null,
          job.user_id,
          job.correlation_id,
          JSON.stringify(job.payload || {}),
          errorMessage,
          errorStack,
          job.retry_count,
          job.max_retries,
          job.created_at,
        ]
      )

      logger.warn(`Job moved to DLQ`, {
        dlq_id: dlqId,
        job_id: job.job_id,
        job_type: job.type,
        workspace_id: job.workspace_id,
        workspace_slug: job.workspace_slug,
        user_id: job.user_id,
        correlation_id: job.correlation_id,
        error_message: errorMessage,
        retry_count: job.retry_count,
        max_retries: job.max_retries,
      })

      // Check DLQ size and alert if needed
      await this.checkDLQSize(job.workspace_id)

      return dlqId
    } catch (error) {
      logger.error(`DLQ insert error`, {
        job_id: job.job_id,
        workspace_id: job.workspace_id,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }

  /**
   *Check DLQ size and send alert if threshold exceeded
   */
  private async checkDLQSize(workspaceId: string): Promise<void> {
    try {
      const result = await db.query(
        `
        SELECT COUNT(*) as count
        FROM dead_letter_queue
        WHERE workspace_id = $1 AND moved_to_dlq_at > NOW() - INTERVAL '1 hour'
        `,
        [workspaceId]
      )

      const dlqSize = result.rows[0].count

      if (dlqSize > 10) {
        logger.error(`DLQ alert: high failure rate`, {
          workspace_id: workspaceId,
          dlq_size_1h: dlqSize,
          threshold: 10,
        })

        // TODO: Send notification to admin channel (Slack/PagerDuty)
      }
    } catch (error) {
      logger.warn(`DLQ size check error`, {
        workspace_id: workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Get DLQ entry details
   */
  async getDLQEntry(dlqId: string, workspaceId: string) {
    try {
      const result = await db.query(
        `
        SELECT * FROM dead_letter_queue
        WHERE id = $1 AND workspace_id = $2
        `,
        [dlqId, workspaceId]
      )

      return result.rows[0] || null
    } catch (error) {
      logger.error(`DLQ entry retrieval error`, {
        dlq_id: dlqId,
        workspace_id: workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }

  /**
   * Get DLQ size for workspace
   */
  async getDLQSize(workspaceId: string): Promise<number> {
    try {
      const result = await db.query(
        `
        SELECT COUNT(*) as count FROM dead_letter_queue
        WHERE workspace_id = $1
        `,
        [workspaceId]
      )

      return parseInt(result.rows[0].count || '0')
    } catch (error) {
      logger.error(`DLQ size query error`, {
        workspace_id: workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })

      return -1
    }
  }
}

export const dlqManager = new DLQManager()
