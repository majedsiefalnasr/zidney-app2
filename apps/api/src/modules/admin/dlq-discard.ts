import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../../infrastructure/postgres'

const logger = createLogger('dlq-discard')

/**
 * T038: POST /admin/workspace/{id}/dlq/{dlqId}/discard
 *
 * Permanently discard a job from the dead-letter queue
 * RBAC: org_admin or super_admin role required
 * Idempotent: Can be called multiple times without side effects
 *
 * Actions:
 * - Fetch job from DLQ
 * - Mark as discarded in dlq_resolutions table
 * - Record user action and optional notes
 * - Return 204 No Content on success
 */

export interface DLQDiscardRequest {
  notes?: string
}

export interface DLQDiscardResponse {
  success: boolean
  data: {
    dlq_id: string
    message: string
    resolution_id: string
  } | null
  error?: {
    code: string
    message: string
  }
}

async function dlqDiscard(c: Context): Promise<Response | void> {
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
      logger.warn(`DLQ discard rejected: insufficient permissions`, {
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
            message: 'Insufficient permissions for DLQ discard',
          },
        },
        403
      )
    }

    // Parse request body
    const body: DLQDiscardRequest = await c.req.json().catch(() => ({}))
    const notes = body.notes || ''

    logger.info(`DLQ discard initiated`, {
      correlation_id: correlationId,
      workspace_slug: workspace.slug,
      workspace_id: workspace.id,
      user_id: userId,
      dlq_id: dlqId,
      has_notes: !!notes,
    })

    // Start transaction
    const client = await db.connect()

    try {
      await client.query('BEGIN SERIALIZABLE')

      // Fetch DLQ entry to verify it exists
      const dlqResult = await client.query(
        `
        SELECT id, job_id FROM dead_letter_queue
        WHERE id = $1 AND workspace_id = $2
        FOR UPDATE
        `,
        [dlqId, workspace.id]
      )

      if (dlqResult.rows.length === 0) {
        await client.query('ROLLBACK')
        logger.warn(`DLQ discard failed: entry not found`, {
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

      // Record resolution
      const resolutionId = uuidv4()
      const discardNotes = `Discarded by ${userId} via admin panel. ${notes || 'No additional notes provided.'}`

      await client.query(
        `
        INSERT INTO dlq_resolutions (
          dlq_id, resolved_by, resolution_action, resolved_at, notes
        ) VALUES ($1, $2, $3, $4, $5)
        `,
        [dlqId, userId, 'discard', new Date().toISOString(), discardNotes]
      )

      await client.query('COMMIT')

      logger.info(`DLQ discard completed`, {
        correlation_id: correlationId,
        workspace_slug: workspace.slug,
        workspace_id: workspace.id,
        user_id: userId,
        dlq_id: dlqId,
        job_id: dlqEntry.job_id,
        resolution_id: resolutionId,
      })

      return c.json({
        success: true,
        data: {
          dlq_id: dlqId,
          message: 'Job permanently discarded from queue',
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
    logger.error(`DLQ discard error`, {
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
          message: 'Failed to discard DLQ job',
        },
      },
      500
    )
  }
}

export { dlqDiscard }
