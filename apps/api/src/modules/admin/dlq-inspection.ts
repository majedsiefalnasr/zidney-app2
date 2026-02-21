import { createLogger } from '@zidney/logging'
import { Hono } from 'hono'
import { db } from '../../infrastructure/postgres'

const logger = createLogger('dlq-inspection')

/**
 * T036: GET /admin/workspace/{id}/dlq
 *
 * Retrieve dead-letter queue entries for a workspace
 * RBAC: org_admin or super_admin role required
 * Pagination: limit 100 jobs, order by moved_to_dlq_at DESC
 */

export interface DLQEntry {
  id: string
  job_id: string
  job_type: string
  attempt_id?: string
  user_id?: string
  error_message: string
  retry_count: number
  max_retries: number
  moved_to_dlq_at: string
  created_at: string
}

export interface DLQListResponse {
  success: boolean
  data: {
    entries: DLQEntry[]
    total: number
    page: number
    limit: number
    pages: number
  }
  error?: {
    code: string
    message: string
  }
}

async function dlqInspection(c: Hono): Promise<Response | void> {
  const correlationId = c.state.requestId
  const workspace = c.state.workspace
  const userId = c.state.userId
  const userRoles = c.state.userRoles || []

  try {
    // RBAC check: require org_admin or super_admin
    const hasAdminRole =
      userRoles.includes('org_admin') || userRoles.includes('super_admin')

    if (!hasAdminRole) {
      logger.warn(`DLQ inspection rejected: insufficient permissions`, {
        correlation_id: correlationId,
        workspace_slug: workspace.slug,
        workspace_id: workspace.id,
        user_id: userId,
        user_roles: userRoles,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions for DLQ inspection',
          },
        },
        403
      )
    }

    // Parse pagination parameters
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 100)

    const offset = (page - 1) * limit

    logger.info(`DLQ inspection requested`, {
      correlation_id: correlationId,
      workspace_slug: workspace.slug,
      workspace_id: workspace.id,
      user_id: userId,
      page,
      limit,
    })

    // Query DLQ entries from tenant database
    const { rows: entries, rowCount: total } = await db.query(
      `
      SELECT
        id,
        job_id,
        job_type,
        attempt_id,
        user_id,
        error_message,
        retry_count,
        max_retries,
        moved_to_dlq_at,
        created_at
      FROM dead_letter_queue
      WHERE workspace_id = $1
      ORDER BY moved_to_dlq_at DESC
      LIMIT $2 OFFSET $3
      `,
      [workspace.id, limit, offset]
    )

    const totalCount = await db.query(
      `
      SELECT COUNT(*) as count FROM dead_letter_queue WHERE workspace_id = $1
      `,
      [workspace.id]
    )

    const count = parseInt(totalCount.rows[0].count)
    const pages = Math.ceil(count / limit)

    logger.info(`DLQ inspection completed`, {
      correlation_id: correlationId,
      workspace_slug: workspace.slug,
      workspace_id: workspace.id,
      user_id: userId,
      entries_returned: entries.length,
      total_count: count,
    })

    return c.json({
      success: true,
      data: {
        entries: entries.map((row) => ({
          id: row.id,
          job_id: row.job_id,
          job_type: row.job_type,
          attempt_id: row.attempt_id,
          user_id: row.user_id,
          error_message: row.error_message,
          retry_count: row.retry_count,
          max_retries: row.max_retries,
          moved_to_dlq_at: row.moved_to_dlq_at,
          created_at: row.created_at,
        })),
        total: count,
        page,
        limit,
        pages,
      },
      error: null,
    })
  } catch (error) {
    logger.error(`DLQ inspection error`, {
      correlation_id: correlationId,
      workspace_slug: workspace.slug,
      workspace_id: workspace.id,
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    })

    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve DLQ entries',
        },
      },
      500
    )
  }
}

export { dlqInspection }
