/**
 * Schema Provisioning API Controller
 *
 * HTTP Endpoints:
 * - POST /api/workspaces/:workspace_id/schema/initialize
 * - GET /api/workspaces/:workspace_id/schema/status/:task_id
 *
 * Middleware stack (applied before routes):
 * 1. correlationIdMiddleware
 * 2. tenantResolver
 * 3. licenseMiddleware
 * 4. schemaVersionMiddleware
 *
 * Task: T025 - Provisioning endpoint
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 */

import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'
import type { RedisClient } from './idempotency.service'
import type { WorkerQueue } from './schema.service'
import { getSchemaInitStatus, initializeTenantSchema } from './schema.service'

/**
 * POST /api/workspaces/:workspace_id/schema/initialize
 *
 * Initialize baseline schema for new tenant
 *
 * Request:
 * {
 *   "idempotency_key": "optional-client-key"
 * }
 *
 * Response (202 Accepted):
 * {
 *   "success": true,
 *   "data": {
 *     "task_id": "uuid",
 *     "workspace_id": "uuid",
 *     "status": "QUEUED",
 *     "idempotency_key": "provided-or-generated"
 *   },
 *   "error": null
 * }
 *
 * Returns:
 * - 202 Accepted: Task enqueued
 * - 409 Conflict: Already initialized (idempotent replay)
 * - 423 Locked: License soft-locked (from middleware)
 * - 403 Forbidden: License archived (from middleware)
 * - 503 Service Unavailable: Service temporarily down
 */
export async function initializeSchemaHandler(
  ctx: Context,
  redis: RedisClient | null,
  queue: WorkerQueue
): Promise<Response> {
  const correlationId = ctx.get('correlationId')
  const tenant = ctx.get('tenant')
  const workspace_id = tenant?.workspace_id

  const logger = createLogger('POST /schema/initialize')
  const startTime = Date.now()

  try {
    // Extract request body
    const body = await ctx.req.json().catch(() => ({}))
    const { idempotency_key } = body

    logger.debug('Schema initialization request received', {
      workspace_id,
      correlationId,
      idempotency_key: idempotency_key ? '***provided***' : 'not-provided',
    })

    // Validate workspace_id from tenant context
    if (!workspace_id) {
      logger.error('Missing workspace context', { correlationId })
      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'MISSING_TENANT_CONTEXT',
            message: 'Workspace context not found',
          },
        },
        500
      )
    }

    // Get database pool from tenant context
    const pool = tenant?.pool
    if (!pool) {
      logger.error('Missing database pool', { workspace_id, correlationId })
      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'DB_CONNECTION_FAILED',
            message: 'Database connection not available',
          },
        },
        503
      )
    }

    // Call service layer
    const result = await initializeTenantSchema(
      { workspace_id, idempotency_key },
      redis,
      pool,
      queue
    )

    const statusCode = result.status === 'ALREADY_INITIALIZED' ? 409 : 202

    logger.info('Schema initialization endpoint success', {
      workspace_id,
      task_id: result.task_id,
      status: result.status,
      correlationId,
      duration_ms: Date.now() - startTime,
    })

    return ctx.json(
      {
        success: true,
        data: result,
        error: null,
      },
      statusCode
    )
  } catch (error) {
    logger.error('Schema initialization endpoint error', {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
      duration_ms: Date.now() - startTime,
    })

    return ctx.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INITIALIZATION_FAILED',
          message: 'Schema initialization request failed',
        },
      },
      503
    )
  }
}

/**
 * GET /api/workspaces/:workspace_id/schema/status/:task_id
 *
 * Poll schema initialization status
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "task_id": "uuid",
 *     "status": "PENDING" | "COMPLETED" | "FAILED",
 *     "version": "1.0.0",
 *     "applied_at": "2026-02-16T12:34:56Z"
 *   },
 *   "error": null
 * }
 *
 * Returns:
 * - 200 OK: Status retrieved
 * - 404 Not Found: Task not found
 */
export async function getSchemaStatusHandler(
  ctx: Context,
  redis: RedisClient | null
): Promise<Response> {
  const correlationId = ctx.get('correlationId')
  const tenant = ctx.get('tenant')
  const workspace_id = tenant?.workspace_id
  const task_id = ctx.req.param('task_id')

  const logger = createLogger('GET /schema/status/:task_id')

  try {
    logger.debug('Schema status request', {
      workspace_id,
      task_id,
      correlationId,
    })

    if (!workspace_id || !task_id) {
      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing workspace or task ID',
          },
        },
        400
      )
    }

    const pool = tenant?.pool
    if (!pool) {
      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'DB_CONNECTION_FAILED',
            message: 'Database unavailable',
          },
        },
        503
      )
    }

    // Get status from service
    const status = await getSchemaInitStatus(workspace_id, task_id, redis, pool)

    logger.debug('Schema status retrieved', {
      workspace_id,
      task_id,
      status: status.status,
      correlationId,
    })

    return ctx.json(
      {
        success: true,
        data: status,
        error: null,
      },
      200
    )
  } catch (error) {
    logger.error('Schema status endpoint error', {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    })

    return ctx.json(
      {
        success: false,
        data: null,
        error: {
          code: 'STATUS_LOOKUP_FAILED',
          message: 'Failed to retrieve status',
        },
      },
      500
    )
  }
}

export default {
  initializeSchemaHandler,
  getSchemaStatusHandler,
}
