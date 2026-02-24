import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../../infrastructure/postgres'
import { redis } from '../../infrastructure/redis'

const logger = createLogger('dlq-retry')

/**
 * T037: POST /admin/workspace/{id}/dlq/{dlqId}/retry
 *
 * Retry a failed job from the dead-letter queue
 * RBAC: org_admin or super_admin role required
 * Idempotent: Can be called multiple times without side effects
 *
 * Actions:
 * - Fetch job from DLQ
 * - Re-enqueue to job queue
 * - Record resolution in dlq_resolutions table
 * - Reset retry_count to 0
 * - Return job moved back to active queue
 */

export interface DLQRetryResponse {
  success: boolean
  data: {
    dlq_id: string
    job_id: string
    message: string
    resolution_id: string
  } | null
  error?: {
    code: string
    message: string
  }
}

async function dlqRetry(c: Context): Promise<Response | void> {
  const correlationId = c.state.requestId
  const workspace = c.state.workspace
  const userId = c.state.userId
  const userRoles = c.state.userRoles || []
  const dlqId = c.req.param('dlqId')

  try {
    // RBAC check: require org_admin or super_admin
    const hasAdminRole =
      userRoles.includes('org_admin') || userRoles.includes('super_admin')

    if (!hasAdminRole) {
      logger.warn(`DLQ retry rejected: insufficient permissions`, {
        correlation_id: correlationId,
        workspace_slug: workspace.slug,
        workspace_id: workspace.id,
        user_id: userId,
        dlq_id: dlqId,
        user_roles: userRoles,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions for DLQ retry',
          },
        },
        403
      )
    }

    logger.info(`DLQ retry initiated`, {
      correlation_id: correlationId,
      workspace_slug: workspace.slug,
      workspace_id: workspace.id,
      user_id: userId,
      dlq_id: dlqId,
    })

    // Start transaction
    const client = await db.connect()

    try {
      await client.query('BEGIN SERIALIZABLE')

      // Fetch DLQ entry
      const dlqResult = await client.query(
        `
        SELECT
          id, job_id, job_type, original_payload, correlation_id
        FROM dead_letter_queue
        WHERE id = $1 AND workspace_id = $2
        FOR UPDATE
        `,
        [dlqId, workspace.id]
      )

      if (dlqResult.rows.length === 0) {
        await client.query('ROLLBACK')
        logger.warn(`DLQ retry failed: entry not found`, {
          correlation_id: correlationId,
          workspace_slug: workspace.slug,
          workspace_id: workspace.id,
          user_id: userId,
          dlq_id: dlqId,
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'NOT_FOUND',
              message: 'DLQ entry not found',
            },
          },
          404
        )
      }

      const dlqEntry = dlqResult.rows[0]

      // Re-enqueue job to Redis queue
      const newJobId = uuidv4()
      const jobPayload = {
        job_id: newJobId,
        type: dlqEntry.job_type,
        ...dlqEntry.original_payload,
        retry_count: 0,
        max_retries: 5,
        correlation_id: dlqEntry.correlation_id,
        created_at: new Date().toISOString(),
      }

      // Push to Redis job queue
      await redis.lPush(
        `queue:jobs:${workspace.id}`,
        JSON.stringify(jobPayload)
      )

      // Record resolution
      const resolutionId = uuidv4()
      await client.query(
        `
        INSERT INTO dlq_resolutions (
          dlq_id, resolved_by, resolution_action, resolved_at, notes
        ) VALUES ($1, $2, $3, $4, $5)
        `,
        [
          dlqId,
          userId,
          'retry',
          new Date().toISOString(),
          `Retried by ${userId} via admin panel. New job_id: ${newJobId}`,
        ]
      )

      await client.query('COMMIT')

      logger.info(`DLQ retry completed`, {
        correlation_id: correlationId,
        workspace_slug: workspace.slug,
        workspace_id: workspace.id,
        user_id: userId,
        dlq_id: dlqId,
        new_job_id: newJobId,
        resolution_id: resolutionId,
      })

      return c.json({
        success: true,
        data: {
          dlq_id: dlqId,
          job_id: newJobId,
          message: 'Job moved back to active queue for retry',
          resolution_id: resolutionId,
        },
        error: null,
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    logger.error(`DLQ retry error`, {
      correlation_id: correlationId,
      workspace_slug: workspace.slug,
      workspace_id: workspace.id,
      user_id: userId,
      dlq_id: dlqId,
      error: error instanceof Error ? error.message : String(error),
    })

    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retry DLQ job',
        },
      },
      500
    )
  }
}

export { dlqRetry }
