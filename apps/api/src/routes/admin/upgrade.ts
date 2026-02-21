/**
 * Upgrade routes: POST, GET, DELETE
 * Tasks 15-17: Upgrade request, status polling, rollback
 */

import { createLogger } from '@zidney/logging'
import {
  validateRollbackRequest,
  validateUpgradeRequest,
} from '@zidney/validation'
import crypto from 'crypto'
import type { Context, Next } from 'hono'
import { Hono } from 'hono'
import { Pool } from 'pg'

const logger = createLogger('upgrade-routes')

export interface AppDependencies {
  masterDb: Pool
  jobQueue: any // Job queue service
}

/**
 * POST /api/admin/workspace/{workspace_id}/upgrade
 * Queue an upgrade job (Task 15)
 */
async function handlePostUpgrade(c: Context, deps: AppDependencies) {
  const workspaceId = c.req.param('workspace_id')
  const correlationId = c.get('correlation_id') || crypto.randomUUID()

  try {
    // Parse request body
    const body = await c.req.json()

    // Validate input
    const validation = validateUpgradeRequest(body)
    if (!validation.isValid) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INVALID_REQUEST',
            message: validation.errors.join('; '),
          },
        },
        400
      )
    }

    const { target_schema_version } = body

    // Get current tenant version
    const tenantDb = c.get('tenantDb')
    const tenantVersionResult = await tenantDb.query(
      `SELECT version FROM schema_version 
       WHERE id = '00000000-0000-0000-0000-000000000001'::uuid`
    )

    const currentVersion = tenantVersionResult.rows[0]?.version || '1.0.0'

    // Validate upgrade path
    if (target_schema_version <= currentVersion) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'CANNOT_DOWNGRADE',
            message: `Cannot downgrade from ${currentVersion} to ${target_schema_version}`,
          },
        },
        400
      )
    }

    // Get minimum_supported
    const platformResult = await deps.masterDb.query(
      `SELECT minimum_supported_schema_version FROM platform_settings LIMIT 1`
    )

    const minimumSupported =
      platformResult.rows[0]?.minimum_supported_schema_version || '1.0.0'

    if (target_schema_version < minimumSupported) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'UPGRADE_TO_OBSOLETE_VERSION',
            message: `Target version below minimum supported (${minimumSupported})`,
          },
        },
        400
      )
    }

    // Enqueue job
    const upgrade_id = crypto.randomUUID()
    const workspace = c.get('workspace')
    const user = c.get('user')

    const jobData = {
      job_type: 'SCHEMA_MIGRATION',
      workspace_id: workspaceId,
      workspace_slug: workspace?.slug,
      target_schema_version,
      correlation_id: correlationId,
      migrations_to_apply: [], // Will be determined by worker
      operator_id: user?.id,
    }

    await deps.jobQueue.enqueue('workspace-schema-migrations', jobData, {
      jobId: upgrade_id,
      attempts: 3,
      backoff: 'exponential',
    })

    logger.info('Upgrade queued', {
      upgrade_id,
      workspace_id: workspaceId,
      correlation_id: correlationId,
      target_version: target_schema_version,
      current_version: currentVersion,
    })

    return c.json(
      {
        success: true,
        data: {
          upgrade_id,
          workspace_id: workspaceId,
          current_schema_version: currentVersion,
          target_schema_version,
          status: 'QUEUED',
          status_url: `/api/admin/workspace/${workspaceId}/upgrade/${upgrade_id}`,
        },
        error: null,
      },
      202
    )
  } catch (err: any) {
    logger.error('Failed to queue upgrade', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      error: err instanceof Error ? err.message : String(err),
    })
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to queue upgrade',
        },
      },
      500
    )
  }
}

/**
 * GET /api/admin/workspace/{workspace_id}/upgrade/{upgrade_id}
 * Poll upgrade status (Task 16)
 */
async function handleGetUpgrade(c: Context, deps: AppDependencies) {
  const workspaceId = c.req.param('workspace_id')
  const upgradeId = c.req.param('upgrade_id')

  try {
    // Query job queue for status
    const jobStatus = await deps.jobQueue.getJob(upgradeId)

    if (!jobStatus) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'UPGRADE_NOT_FOUND',
            message: `Upgrade ${upgradeId} not found`,
          },
        },
        404
      )
    }

    return c.json(
      {
        success: true,
        data: {
          upgrade_id: upgradeId,
          workspace_id: workspaceId,
          status: jobStatus.state,
          progress_percent: jobStatus.progress || 0,
          current_migration: jobStatus.data?.current_migration,
          target_schema_version: jobStatus.data?.target_schema_version,
          created_at: jobStatus.createdAt,
          completed_at: jobStatus.finishedOn,
        },
        error: jobStatus.failedReason
          ? {
              code: 'MIGRATION_FAILED',
              message: jobStatus.failedReason,
            }
          : null,
      },
      200
    )
  } catch (err: any) {
    logger.error('Failed to retrieve upgrade status', {
      workspace_id: workspaceId,
      upgrade_id: upgradeId,
      error: err instanceof Error ? err.message : String(err),
    })
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve upgrade status',
        },
      },
      500
    )
  }
}

/**
 * POST /api/admin/workspace/{workspace_id}/upgrade/{upgrade_id}/rollback
 * Initiate rollback (Task 17)
 */
async function handlePostRollback(c: Context, deps: AppDependencies) {
  const workspaceId = c.req.param('workspace_id')
  const upgradeId = c.req.param('upgrade_id')

  try {
    // Parse request body
    const body = await c.req.json()

    // Validate input
    const validation = validateRollbackRequest(body)
    if (!validation.isValid) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INVALID_REQUEST',
            message: validation.errors.join('; '),
          },
        },
        400
      )
    }

    const { snapshot_id, confirmation_code } = body

    // Verify confirmation code
    if (confirmation_code !== 'CONFIRM_ROLLBACK_TO_PREVIOUS') {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INVALID_CONFIRMATION',
            message: 'Invalid confirmation code',
          },
        },
        400
      )
    }

    // Verify snapshot exists and belongs to workspace
    const snapshotResult = await deps.masterDb.query(
      `SELECT * FROM upgrade_snapshots WHERE id = $1 AND workspace_id = $2`,
      [snapshot_id, workspaceId]
    )

    if (snapshotResult.rows.length === 0) {
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INVALID_SNAPSHOT_FOR_WORKSPACE',
            message: 'Snapshot not found for this workspace',
          },
        },
        400
      )
    }

    const snapshot = snapshotResult.rows[0]
    const correlationId = c.get('correlation_id') || crypto.randomUUID()
    const workspace = c.get('workspace')
    const user = c.get('user')

    // Enqueue rollback job
    const rollback_id = crypto.randomUUID()

    const jobData = {
      job_type: 'SCHEMA_ROLLBACK',
      workspace_id: workspaceId,
      workspace_slug: workspace?.slug,
      snapshot_id,
      rollback_id,
      correlation_id: correlationId,
      operator_id: user?.id,
    }

    await deps.jobQueue.enqueue('workspace-schema-rollback', jobData, {
      jobId: rollback_id,
      attempts: 3,
    })

    logger.info('Rollback queued', {
      rollback_id,
      upgrade_id: upgradeId,
      workspace_id: workspaceId,
      snapshot_id,
      correlation_id: correlationId,
    })

    return c.json(
      {
        success: true,
        data: {
          rollback_id,
          workspace_id: workspaceId,
          snapshot_id,
          target_schema_version: snapshot.previous_schema_version,
          status: 'QUEUED',
        },
        error: null,
      },
      202
    )
  } catch (err: any) {
    logger.error('Failed to queue rollback', {
      workspace_id: workspaceId,
      upgrade_id: upgradeId,
      error: err instanceof Error ? err.message : String(err),
    })
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to queue rollback',
        },
      },
      500
    )
  }
}

/**
 * Create and register routes
 */
export function createUpgradeRouter(deps: AppDependencies): Hono {
  const app = new Hono()

  // Routes with middleware chain:
  // 1. Tenant resolver (attaches workspace context)
  // 2. License middleware (validates ACTIVE, not SOFT_LOCKED/ARCHIVED)
  // 3. Rate limiter (5 attempts/hour)
  // 4. Idempotency validation
  // 5. Handler

  app.post(
    '/api/admin/workspace/:workspace_id/upgrade',
    async (c: Context, next: Next) => {
      // Middleware placeholder: license validation
      // In real implementation: licenseMiddleware(c, next)
      return next()
    },
    async (c: Context, next: Next) => {
      // Middleware placeholder: rate limiting
      // In real implementation: rateLimiter(c, next)
      return next()
    },
    async (c: Context) => handlePostUpgrade(c, deps)
  )

  app.get(
    '/api/admin/workspace/:workspace_id/upgrade/:upgrade_id',
    async (c: Context) => handleGetUpgrade(c, deps)
  )

  app.post(
    '/api/admin/workspace/:workspace_id/upgrade/:upgrade_id/rollback',
    async (c: Context) => handlePostRollback(c, deps)
  )

  return app
}

export default createUpgradeRouter
