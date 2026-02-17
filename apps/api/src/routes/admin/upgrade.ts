/**
 * Upgrade routes: POST, GET, DELETE
 * Tasks 15-17: Upgrade request, status polling, rollback
 */

import {
  validateRollbackRequest,
  validateUpgradeRequest,
} from '@zidney/validation'
import crypto from 'crypto'
import { Request, Response, Router } from 'express'
import { Database } from 'pg'

export interface AppDependencies {
  masterDb: Database
  jobQueue: any // Job queue service
}

/**
 * POST /api/admin/workspace/{workspace_id}/upgrade
 * Queue an upgrade job (Task 15)
 */
async function handlePostUpgrade(
  req: Request,
  res: Response,
  deps: AppDependencies
) {
  const { workspace_id } = req.params
  const correlation_id = req.headers['x-correlation-id'] || crypto.randomUUID()

  try {
    // Validate input
    const validation = validateUpgradeRequest(req.body)
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_REQUEST',
          message: validation.errors.join('; '),
        },
      })
    }

    const { target_schema_version } = req.body

    // Get current tenant version
    const tenantVersionResult = await req.tenantDb.query(
      `SELECT version FROM schema_version 
       WHERE id = '00000000-0000-0000-0000-000000000001'::uuid`
    )

    const currentVersion = tenantVersionResult.rows[0]?.version || '1.0.0'

    // Validate upgrade path
    if (target_schema_version <= currentVersion) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'CANNOT_DOWNGRADE',
          message: `Cannot downgrade from ${currentVersion} to ${target_schema_version}`,
        },
      })
    }

    // Get minimum_supported
    const platformResult = await deps.masterDb.query(
      `SELECT minimum_supported_schema_version FROM platform_settings LIMIT 1`
    )

    const minimumSupported =
      platformResult.rows[0]?.minimum_supported_schema_version || '1.0.0'

    if (target_schema_version < minimumSupported) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'UPGRADE_TO_OBSOLETE_VERSION',
          message: `Target version below minimum supported (${minimumSupported})`,
        },
      })
    }

    // Enqueue job
    const upgrade_id = crypto.randomUUID()

    const jobData = {
      job_type: 'SCHEMA_MIGRATION',
      workspace_id,
      workspace_slug: req.workspace.slug,
      target_schema_version,
      correlation_id,
      migrations_to_apply: [], // Will be determined by worker
      operator_id: req.user?.id,
    }

    await deps.jobQueue.enqueue('workspace-schema-migrations', jobData, {
      jobId: upgrade_id,
      attempts: 3,
      backoff: 'exponential',
    })

    console.log(
      JSON.stringify({
        level: 'INFO',
        service: 'api-upgrade',
        event: 'upgrade_queued',
        upgrade_id,
        workspace_id,
        correlation_id,
        target_version: target_schema_version,
        current_version: currentVersion,
        timestamp: new Date().toISOString(),
      })
    )

    return res.status(202).json({
      success: true,
      data: {
        upgrade_id,
        workspace_id,
        current_schema_version: currentVersion,
        target_schema_version,
        status: 'QUEUED',
        status_url: `/api/admin/workspace/${workspace_id}/upgrade/${upgrade_id}`,
      },
      error: null,
    })
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to queue upgrade',
      },
    })
  }
}

/**
 * GET /api/admin/workspace/{workspace_id}/upgrade/{upgrade_id}
 * Poll upgrade status (Task 16)
 */
async function handleGetUpgrade(
  req: Request,
  res: Response,
  deps: AppDependencies
) {
  const { workspace_id, upgrade_id } = req.params

  try {
    // Query job queue for status
    const jobStatus = await deps.jobQueue.getJob(upgrade_id)

    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        data: null,
        error: {
          code: 'UPGRADE_NOT_FOUND',
          message: `Upgrade ${upgrade_id} not found`,
        },
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        upgrade_id,
        workspace_id,
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
    })
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve upgrade status',
      },
    })
  }
}

/**
 * POST /api/admin/workspace/{workspace_id}/upgrade/{upgrade_id}/rollback
 * Initiate rollback (Task 17)
 */
async function handlePostRollback(
  req: Request,
  res: Response,
  deps: AppDependencies
) {
  const { workspace_id, upgrade_id } = req.params

  try {
    // Validate input
    const validation = validateRollbackRequest(req.body)
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_REQUEST',
          message: validation.errors.join('; '),
        },
      })
    }

    const { snapshot_id, confirmation_code } = req.body

    // Verify confirmation code
    if (confirmation_code !== 'CONFIRM_ROLLBACK_TO_PREVIOUS') {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_CONFIRMATION',
          message: 'Invalid confirmation code',
        },
      })
    }

    // Verify snapshot exists and belongs to workspace
    const snapshotResult = await deps.masterDb.query(
      `SELECT * FROM upgrade_snapshots WHERE id = $1 AND workspace_id = $2`,
      [snapshot_id, workspace_id]
    )

    if (snapshotResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_SNAPSHOT_FOR_WORKSPACE',
          message: 'Snapshot not found for this workspace',
        },
      })
    }

    const snapshot = snapshotResult.rows[0]

    // Enqueue rollback job
    const rollback_id = crypto.randomUUID()
    const correlation_id =
      req.headers['x-correlation-id'] || crypto.randomUUID()

    const jobData = {
      job_type: 'SCHEMA_ROLLBACK',
      workspace_id,
      workspace_slug: req.workspace.slug,
      snapshot_id,
      rollback_id,
      correlation_id,
      operator_id: req.user?.id,
    }

    await deps.jobQueue.enqueue('workspace-schema-rollback', jobData, {
      jobId: rollback_id,
      attempts: 3,
    })

    console.log(
      JSON.stringify({
        level: 'INFO',
        service: 'api-upgrade',
        event: 'rollback_queued',
        rollback_id,
        upgrade_id,
        workspace_id,
        snapshot_id,
        correlation_id,
        timestamp: new Date().toISOString(),
      })
    )

    return res.status(202).json({
      success: true,
      data: {
        rollback_id,
        workspace_id,
        snapshot_id,
        target_schema_version: snapshot.previous_schema_version,
        status: 'QUEUED',
      },
      error: null,
    })
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to queue rollback',
      },
    })
  }
}

/**
 * Create and register routes
 */
export function createUpgradeRouter(deps: AppDependencies): Router {
  const router = Router()

  // Routes with middleware chain:
  // 1. Tenant resolver (attaches workspace context)
  // 2. License middleware (validates ACTIVE, not SOFT_LOCKED/ARCHIVED)
  // 3. Rate limiter (5 attempts/hour)
  // 4. Idempotency validation
  // 5. Handler

  router.post(
    '/api/admin/workspace/:workspace_id/upgrade',
    (req, res, next) => {
      // Middleware placeholder: license validation
      // In real implementation: licenseMiddleware(req, res, next)
      next()
    },
    (req, res, next) => {
      // Middleware placeholder: rate limiting
      // In real implementation: rateLimiter(req, res, next)
      next()
    },
    (req, res) => handlePostUpgrade(req, res, deps)
  )

  router.get(
    '/api/admin/workspace/:workspace_id/upgrade/:upgrade_id',
    (req, res) => handleGetUpgrade(req, res, deps)
  )

  router.post(
    '/api/admin/workspace/:workspace_id/upgrade/:upgrade_id/rollback',
    (req, res) => handlePostRollback(req, res, deps)
  )

  return router
}
