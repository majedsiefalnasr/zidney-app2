/**
 * Idempotency key middleware (Task 22)
 * Prevents duplicate upgrade submissions
 * Applied to: POST /api/admin/workspace/{workspace_id}/upgrade*
 */

import { createLogger } from '@zidney/logger'
import crypto from 'crypto'
import type { Context, MiddlewareHandler, Next } from 'hono'
import { Pool } from 'pg'

const logger = createLogger('idempotency-middleware')

/**
 * Create idempotency middleware
 */
export function createIdempotencyMiddleware(masterDb: Pool): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const workspaceId = c.req.param('workspace_id')
    const body = await c.req.json().catch(() => ({}))
    const { target_schema_version } = body
    const correlationId = c.get('correlation_id') || crypto.randomUUID()

    if (!target_schema_version) {
      return next()
    }

    try {
      // Generate idempotency key
      const idempotencyKey = `upgrade-${workspaceId}-${target_schema_version}`

      // Check if duplicate already in progress
      const result = await masterDb.query(
        `SELECT COUNT(*) as count FROM migration_registry 
         WHERE workspace_id = $1 
         AND target_schema_version = $2 
         AND applied_at > now() - interval '5 minutes'
         AND status = 'SUCCESS'`,
        [workspaceId, target_schema_version]
      )

      if (result.rows[0].count > 0) {
        // Duplicate submission detected, return cached success
        logger.debug('Duplicate submission detected', {
          correlation_id: correlationId,
          workspace_id: workspaceId,
          target_version: target_schema_version,
        })

        return c.json(
          {
            success: true,
            data: {
              workspace_id: workspaceId,
              target_schema_version,
              status: 'QUEUED',
              note: 'This version was recently upgraded. Returning cached status.',
            },
            error: null,
          },
          202
        )
      }

      // Attach idempotency context
      c.set('idempotencyKey', idempotencyKey)

      return next()
    } catch (error) {
      // On error, allow through
      logger.error('Idempotency check error', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return next()
    }
  }
}

export default createIdempotencyMiddleware
