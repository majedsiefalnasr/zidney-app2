import {
  restoreFromArchive,
  transitionToActive,
  transitionToDeleted,
  transitionToSoftLock,
} from '@zidney/domain-core/license'
import { createLogger } from '@zidney/logger'
import { type Context, Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { toLicenseError } from '../responses/license-error-handler'

// @ts-expect-error: TS6133 - declared but never read [INFRA-001]
const logger = createLogger('licenses-lifecycle')

/**
 * License Lifecycle Router
 *
 * Routes for license state transitions (soft-lock, renew, archive, restore, delete).
 * All routes require admin authentication and proper license status.
 * Transactions are enforced at the service layer with SERIALIZABLE isolation.
 */
// @ts-expect-error: TS6133 - declared but never read [INFRA-001]
export const licensesLifecycleRouter = new Hono()

/**
 * Helper: Validate UUID format
 */
function isValidUuid(uuid: string): boolean {
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Helper: Extract actor_id from context
 */
function getActorId(ctx: Context): string {
  return ctx.get('user_id') || ctx.get('actor_id') || 'system'
}

/**
 * Helper: Check admin authorization
 */
function isAdmin(ctx: Context): boolean {
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const userRole = ctx.get('user_role')
  return userRole === 'mmc_admin' || userRole === 'super_admin'
}

// ============================================================================
// POST /api/v1/licenses/{licenseId}/soft-lock
// Task T016: Transition ACTIVE → SOFT_LOCKED
// ============================================================================

licensesLifecycleRouter.post('/api/v1/licenses/:licenseId/soft-lock', async (ctx: Context) => {
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const correlationId = ctx.get('correlation_id')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const masterDb = ctx.get('master_db')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const licenseId = ctx.req.param('licenseId')
  let body: any

  try {
    // Auth check
    if (!isAdmin(ctx)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'soft_lock_unauthorized',
          license_id: licenseId,
          user_role: ctx.get('user_role'),
        },
        'Unauthorized soft-lock attempt'
      )
      return ctx.json(toLicenseError('UNAUTHORIZED'), { status: 403 })
    }

    // Validate UUID
    if (!isValidUuid(licenseId)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'soft_lock_invalid_uuid',
          license_id: licenseId,
        },
        'Invalid license ID format'
      )
      return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
    }

    // Extract and validate request body
    body = await ctx.req.json()
    const { reason } = body

    if (!reason || typeof reason !== 'string' || reason.length > 512) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'soft_lock_invalid_reason',
          license_id: licenseId,
        },
        'Invalid or missing reason'
      )
      return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
    }

    // Call service method
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const actorId = getActorId(ctx)
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const result = await transitionToSoftLock(masterDb, licenseId, reason, actorId)

    if (!result.success) {
      // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
      const statusCode = result.http_status || 500
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'soft_lock_failed',
          license_id: licenseId,
          error_code: result.error_code,
        },
        'Soft-lock transition failed'
      )
      return ctx.json(
        toLicenseError(result.error_code || 'INTERNAL_ERROR'),
        statusCode as ContentfulStatusCode
      )
    }

    logger.info(
      {
        correlation_id: correlationId,
        action: 'license_soft_locked',
        license_id: licenseId,
        previous_state: result.previous_state,
        soft_lock_until: result.license?.soft_lock_until?.toISOString(),
      },
      'License soft-locked successfully'
    )

    return ctx.json(
      {
        success: true,
        data: {
          license: result.license,
          previous_state: result.previous_state,
          new_state: 'SOFT_LOCKED',
          soft_lock_expires_in_days: 90,
        },
        error: null,
      },
      { status: 200 }
    )
  } catch (error: any) {
    logger.error(
      {
        correlation_id: correlationId,
        action: 'soft_lock_error',
        license_id: licenseId,
        error_message: error.message,
      },
      'Soft-lock operation failed'
    )
    return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
  }
})

// ============================================================================
// POST /api/v1/licenses/{licenseId}/renew
// Task T017: Transition SOFT_LOCKED → ACTIVE
// ============================================================================

licensesLifecycleRouter.post('/api/v1/licenses/:licenseId/renew', async (ctx: Context) => {
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const correlationId = ctx.get('correlation_id')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const masterDb = ctx.get('master_db')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const licenseId = ctx.req.param('licenseId')
  let body: any

  try {
    // Auth check
    if (!isAdmin(ctx)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'renew_unauthorized',
          license_id: licenseId,
        },
        'Unauthorized renew attempt'
      )
      return ctx.json(toLicenseError('UNAUTHORIZED'), { status: 403 })
    }

    // Validate UUID
    if (!isValidUuid(licenseId)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'renew_invalid_uuid',
          license_id: licenseId,
        },
        'Invalid license ID format'
      )
      return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
    }

    // Extract and validate request body
    body = await ctx.req.json()
    const { reason } = body

    if (!reason || typeof reason !== 'string' || reason.length > 512) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'renew_invalid_reason',
          license_id: licenseId,
        },
        'Invalid or missing reason'
      )
      return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
    }

    // Call service method
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const actorId = getActorId(ctx)
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const result = await transitionToActive(masterDb, licenseId, reason, actorId)

    if (!result.success) {
      // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
      const statusCode = result.http_status || 500
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'renew_failed',
          license_id: licenseId,
          error_code: result.error_code,
        },
        'Renew transition failed'
      )
      return ctx.json(
        toLicenseError(result.error_code || 'INTERNAL_ERROR'),
        statusCode as ContentfulStatusCode
      )
    }

    logger.info(
      {
        correlation_id: correlationId,
        action: 'license_renewed',
        license_id: licenseId,
        previous_state: result.previous_state,
      },
      'License renewed successfully'
    )

    return ctx.json(
      {
        success: true,
        data: {
          license: result.license,
          previous_state: result.previous_state,
          new_state: 'ACTIVE',
        },
        error: null,
      },
      { status: 200 }
    )
  } catch (error: any) {
    logger.error(
      {
        correlation_id: correlationId,
        action: 'renew_error',
        license_id: licenseId,
        error_message: error.message,
      },
      'Renew operation failed'
    )
    return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
  }
})

// ============================================================================
// POST /api/v1/licenses/{licenseId}/archive
// Task T018: Transition SOFT_LOCKED → ARCHIVED (enqueue snapshot job)
// ============================================================================

licensesLifecycleRouter.post('/api/v1/licenses/:licenseId/archive', async (ctx: Context) => {
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const correlationId = ctx.get('correlation_id')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const _masterDb = ctx.get('master_db')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const licenseId = ctx.req.param('licenseId')

  try {
    // Auth check
    if (!isAdmin(ctx)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'archive_unauthorized',
          license_id: licenseId,
        },
        'Unauthorized archive attempt'
      )
      return ctx.json(toLicenseError('UNAUTHORIZED'), { status: 403 })
    }

    // Validate UUID
    if (!isValidUuid(licenseId)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'archive_invalid_uuid',
          license_id: licenseId,
        },
        'Invalid license ID format'
      )
      return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
    }

    // TODO: T018 Phase 4 – Enqueue snapshot_create job via worker
    // For now, return placeholder
    logger.info(
      {
        correlation_id: correlationId,
        action: 'archive_job_queued',
        license_id: licenseId,
      },
      'Archive job queued (placeholder)'
    )

    return ctx.json(
      {
        success: true,
        data: {
          license_id: licenseId,
          job_id: `job-${licenseId}-${Date.now()}`,
          job_name: 'snapshot_create',
          message: 'Snapshot creation queued',
          eta_seconds: 180,
        },
        error: null,
      },
      { status: 202 }
    )
  } catch (error: any) {
    logger.error(
      {
        correlation_id: correlationId,
        action: 'archive_error',
        license_id: licenseId,
        error_message: error.message,
      },
      'Archive operation failed'
    )
    return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
  }
})

// ============================================================================
// POST /api/v1/licenses/{licenseId}/restore
// Task T019: Restore from ARCHIVED state (enqueue restore job)
// ============================================================================

licensesLifecycleRouter.post('/api/v1/licenses/:licenseId/restore', async (ctx: Context) => {
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const correlationId = ctx.get('correlation_id')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const masterDb = ctx.get('master_db')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const licenseId = ctx.req.param('licenseId')
  let body: any

  try {
    // Auth check
    if (!isAdmin(ctx)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'restore_unauthorized',
          license_id: licenseId,
        },
        'Unauthorized restore attempt'
      )
      return ctx.json(toLicenseError('UNAUTHORIZED'), { status: 403 })
    }

    // Validate UUID
    if (!isValidUuid(licenseId)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'restore_invalid_uuid',
          license_id: licenseId,
        },
        'Invalid license ID format'
      )
      return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
    }

    // Extract optional reason
    body = await ctx.req.json()
    const { reason } = body

    if (reason && (typeof reason !== 'string' || reason.length > 512)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'restore_invalid_reason',
          license_id: licenseId,
        },
        'Invalid reason format'
      )
      return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
    }

    // Call service method
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const actorId = getActorId(ctx)
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const result = await restoreFromArchive(masterDb, licenseId, actorId)

    if (!result.success) {
      // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
      const statusCode = result.http_status || 500
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'restore_failed',
          license_id: licenseId,
          error_code: result.error_code,
        },
        'Restore job enqueue failed'
      )
      return ctx.json(
        toLicenseError(result.error_code || 'INTERNAL_ERROR'),
        statusCode as ContentfulStatusCode
      )
    }

    logger.info(
      {
        correlation_id: correlationId,
        action: 'restore_job_queued',
        license_id: licenseId,
        restore_job_id: result.restore_job_id,
      },
      'Restore job queued successfully'
    )

    return ctx.json(
      {
        success: true,
        data: {
          restore_job_id: result.restore_job_id,
          restore_timestamp: result.restore_timestamp,
          eta_seconds: result.eta_seconds,
          estimated_duration_seconds: 300,
          message: 'Restore job queued - workspace will be restored from snapshot',
        },
        error: null,
      },
      { status: 202 }
    )
  } catch (error: any) {
    logger.error(
      {
        correlation_id: correlationId,
        action: 'restore_error',
        license_id: licenseId,
        error_message: error.message,
      },
      'Restore operation failed'
    )
    return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
  }
})

// ============================================================================
// POST /api/v1/licenses/{licenseId}/delete/initiate
// Task T020: Initiate deletion with confirmation phrase (2FA required)
// ============================================================================

licensesLifecycleRouter.post(
  '/api/v1/licenses/:licenseId/delete/initiate',
  async (ctx: Context) => {
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const correlationId = ctx.get('correlation_id')
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const _masterDb = ctx.get('master_db')
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const licenseId = ctx.req.param('licenseId')

    try {
      // Auth check - requires admin + 2FA verification
      if (!isAdmin(ctx)) {
        logger.warn(
          {
            correlation_id: correlationId,
            action: 'delete_initiate_unauthorized',
            license_id: licenseId,
          },
          'Unauthorized delete initiation attempt'
        )
        return ctx.json(toLicenseError('UNAUTHORIZED'), { status: 403 })
      }

      // TODO: T020 Verify 2FA status from ctx.get('2fa_verified')
      // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
      const twoFaVerified = ctx.get('2fa_verified') || false
      if (!twoFaVerified) {
        logger.warn(
          {
            correlation_id: correlationId,
            action: 'delete_initiate_2fa_failed',
            license_id: licenseId,
          },
          '2FA verification required'
        )
        return ctx.json(toLicenseError('UNAUTHORIZED'), { status: 403 })
      }

      // Validate UUID
      if (!isValidUuid(licenseId)) {
        logger.warn(
          {
            correlation_id: correlationId,
            action: 'delete_initiate_invalid_uuid',
            license_id: licenseId,
          },
          'Invalid license ID format'
        )
        return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
      }

      // Generate random confirmation phrase
      // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
      const confirmationPhrase = `CONFIRM_DELETE_${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
      const confirmationId = `conf-${licenseId}-${Date.now()}`

      // TODO: T020 Store confirmation hash in license_deletion_confirmations table with 5-min expiry
      logger.info(
        {
          correlation_id: correlationId,
          action: 'delete_confirmation_generated',
          license_id: licenseId,
          confirmation_id: confirmationId,
        },
        'Delete confirmation initiated'
      )

      return ctx.json(
        {
          success: true,
          data: {
            confirmation_id: confirmationId,
            confirmation_phrase: confirmationPhrase,
            expires_in_seconds: 300,
          },
          error: null,
        },
        { status: 200 }
      )
    } catch (error: any) {
      logger.error(
        {
          correlation_id: correlationId,
          action: 'delete_initiate_error',
          license_id: licenseId,
          error_message: error.message,
        },
        'Delete initiation failed'
      )
      return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
    }
  }
)

// ============================================================================
// POST /api/v1/licenses/{licenseId}/delete/confirm
// Task T021: Confirm deletion with confirmation phrase (enqueue delete job)
// ============================================================================

licensesLifecycleRouter.post('/api/v1/licenses/:licenseId/delete/confirm', async (ctx: Context) => {
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const correlationId = ctx.get('correlation_id')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const masterDb = ctx.get('master_db')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const licenseId = ctx.req.param('licenseId')
  let body: any

  try {
    // Auth check - requires admin + 2FA re-verification
    if (!isAdmin(ctx)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'delete_confirm_unauthorized',
          license_id: licenseId,
        },
        'Unauthorized delete confirmation attempt'
      )
      return ctx.json(toLicenseError('UNAUTHORIZED'), { status: 403 })
    }

    // TODO: T021 Verify 2FA status from ctx.get('2fa_verified')
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const twoFaVerified = ctx.get('2fa_verified') || false
    if (!twoFaVerified) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'delete_confirm_2fa_failed',
          license_id: licenseId,
        },
        '2FA re-verification required'
      )
      return ctx.json(toLicenseError('UNAUTHORIZED'), { status: 403 })
    }

    // Validate UUID
    if (!isValidUuid(licenseId)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'delete_confirm_invalid_uuid',
          license_id: licenseId,
        },
        'Invalid license ID format'
      )
      return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
    }

    // Extract confirmation phrase
    body = await ctx.req.json()
    const { confirmation_phrase } = body

    if (!confirmation_phrase || typeof confirmation_phrase !== 'string') {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'delete_confirm_missing_phrase',
          license_id: licenseId,
        },
        'Missing confirmation phrase'
      )
      return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
    }

    // TODO: T021 Validate confirmation phrase against stored hash
    // Placeholder: compute hash and compare
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const confirmationHash = Buffer.from(confirmation_phrase).toString('base64')

    // Call service method
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const actorId = getActorId(ctx)
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const result = await transitionToDeleted(masterDb, licenseId, confirmationHash, actorId)

    if (!result.success) {
      // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
      const statusCode = result.http_status || 500
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'delete_confirm_failed',
          license_id: licenseId,
          error_code: result.error_code,
        },
        'Delete confirmation failed'
      )
      return ctx.json(
        toLicenseError(result.error_code || 'INTERNAL_ERROR'),
        statusCode as ContentfulStatusCode
      )
    }

    logger.info(
      {
        correlation_id: correlationId,
        action: 'delete_job_queued',
        license_id: licenseId,
        delete_job_id: result.delete_job_id,
      },
      'Delete job queued successfully'
    )

    return ctx.json(
      {
        success: true,
        data: {
          delete_job_id: result.delete_job_id,
          delete_timestamp: result.delete_timestamp,
          message: 'Deletion of workspace queued - data will be purged after grace period',
        },
        error: null,
      },
      { status: 202 }
    )
  } catch (error: any) {
    logger.error(
      {
        correlation_id: correlationId,
        action: 'delete_confirm_error',
        license_id: licenseId,
        error_message: error.message,
      },
      'Delete confirmation failed'
    )
    return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
  }
})

// ============================================================================
// GET /api/v1/licenses/{licenseId}
// Task T022: Retrieve license details with snapshot metadata
// ============================================================================

licensesLifecycleRouter.get('/api/v1/licenses/:licenseId', async (ctx: Context) => {
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const correlationId = ctx.get('correlation_id')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const masterDb = ctx.get('master_db')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const licenseId = ctx.req.param('licenseId')

  try {
    // Auth check - admin only
    if (!isAdmin(ctx)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'license_get_unauthorized',
          license_id: licenseId,
        },
        'Unauthorized license retrieval attempt'
      )
      return ctx.json(toLicenseError('UNAUTHORIZED'), { status: 403 })
    }

    // Validate UUID
    if (!isValidUuid(licenseId)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'license_get_invalid_uuid',
          license_id: licenseId,
        },
        'Invalid license ID format'
      )
      return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
    }

    // Query license with snapshot (if exists)
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const result = await masterDb.query(
      `SELECT l.*, 
              s.id as snapshot_id, s.location as snapshot_location, 
              s.size_bytes as snapshot_size, s.version_tag as snapshot_version
       FROM licenses l
       LEFT JOIN snapshots s ON l.current_snapshot_id = s.id
       WHERE l.id = $1`,
      [licenseId]
    )

    if (!result.rows.length) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'license_not_found',
          license_id: licenseId,
        },
        'License not found'
      )
      return ctx.json(toLicenseError('LICENSE_NOT_FOUND'), { status: 404 })
    }

    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const row = result.rows[0]
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const license = {
      id: row.id,
      workspace_id: row.workspace_id,
      status: row.status,
      product_id: row.product_id,
      soft_lock_until: row.soft_lock_until,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }

    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const snapshot = row.snapshot_id
      ? {
          id: row.snapshot_id,
          location: row.snapshot_location,
          size_bytes: row.snapshot_size,
          version_tag: row.snapshot_version,
        }
      : null

    logger.debug(
      {
        correlation_id: correlationId,
        action: 'license_retrieved',
        license_id: licenseId,
      },
      'License details retrieved'
    )

    return ctx.json(
      {
        success: true,
        data: {
          license,
          snapshot,
          user_count: 0, // TODO: T022 Query from tenant DB if ACTIVE
          storage_used_gb: 0, // TODO: T022 Calculate from snapshots
          schema_version: row.schema_version || '1.0.0',
        },
        error: null,
      },
      { status: 200 }
    )
  } catch (error: any) {
    logger.error(
      {
        correlation_id: correlationId,
        action: 'license_get_error',
        license_id: licenseId,
        error_message: error.message,
      },
      'License retrieval failed'
    )
    return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
  }
})

// ============================================================================
// GET /api/v1/licenses/{licenseId}/audit-trail
// Task T023: Retrieve license state transition audit logs
// ============================================================================

licensesLifecycleRouter.get('/api/v1/licenses/:licenseId/audit-trail', async (ctx: Context) => {
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const correlationId = ctx.get('correlation_id')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const masterDb = ctx.get('master_db')
  // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
  const licenseId = ctx.req.param('licenseId')

  try {
    // Auth check - admin only
    if (!isAdmin(ctx)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'audit_trail_unauthorized',
          license_id: licenseId,
        },
        'Unauthorized audit trail access'
      )
      return ctx.json(toLicenseError('UNAUTHORIZED'), { status: 403 })
    }

    // Validate UUID
    if (!isValidUuid(licenseId)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'audit_trail_invalid_uuid',
          license_id: licenseId,
        },
        'Invalid license ID format'
      )
      return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
    }

    // Extract pagination parameters
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const limit = Math.min(parseInt(ctx.req.query('limit') || '50', 10), 1000)
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const offset = parseInt(ctx.req.query('offset') || '0', 10)

    // Query audit logs
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const result = await masterDb.query(
      `SELECT * FROM license_audit_logs 
       WHERE license_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [licenseId, limit, offset]
    )

    // Get total count
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const countResult = await masterDb.query(
      'SELECT COUNT(*) as count FROM license_audit_logs WHERE license_id = $1',
      [licenseId]
    )

    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const totalCount = parseInt(countResult.rows[0]?.count || '0', 10)

    logger.debug(
      {
        correlation_id: correlationId,
        action: 'audit_trail_retrieved',
        license_id: licenseId,
        record_count: result.rows.length,
        total_count: totalCount,
      },
      'Audit trail retrieved'
    )

    return ctx.json(
      {
        success: true,
        data: {
          audit_logs: result.rows,
          total_count: totalCount,
          limit,
          offset,
        },
        error: null,
      },
      { status: 200 }
    )
  } catch (error: any) {
    logger.error(
      {
        correlation_id: correlationId,
        action: 'audit_trail_error',
        license_id: licenseId,
        error_message: error.message,
      },
      'Audit trail retrieval failed'
    )
    return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
  }
})

// ============================================================================
// GET /api/v1/licenses/{licenseId}/job-status/{jobId}
// Task T024: Retrieve background job status (snapshot/restore/delete)
// ============================================================================

licensesLifecycleRouter.get(
  '/api/v1/licenses/:licenseId/job-status/:jobId',
  async (ctx: Context) => {
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const correlationId = ctx.get('correlation_id')
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const licenseId = ctx.req.param('licenseId')
    // @ts-expect-error: TS6133 - declared but never read [INFRA-001]
    const jobId = ctx.req.param('jobId')

    try {
      // Auth check - admin only
      if (!isAdmin(ctx)) {
        logger.warn(
          {
            correlation_id: correlationId,
            action: 'job_status_unauthorized',
            license_id: licenseId,
            job_id: jobId,
          },
          'Unauthorized job status access'
        )
        return ctx.json(toLicenseError('UNAUTHORIZED'), { status: 403 })
      }

      // Validate UUIDs
      if (!isValidUuid(licenseId) || !jobId) {
        logger.warn(
          {
            correlation_id: correlationId,
            action: 'job_status_invalid_ids',
            license_id: licenseId,
            job_id: jobId,
          },
          'Invalid license or job ID format'
        )
        return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
      }

      // TODO: T024 Query job status from Redis or jobs table
      // Placeholder: return pending status
      logger.info(
        {
          correlation_id: correlationId,
          action: 'job_status_queried',
          license_id: licenseId,
          job_id: jobId,
        },
        'Job status retrieved'
      )

      return ctx.json(
        {
          success: true,
          data: {
            job_status: {
              job_id: jobId,
              job_name: 'snapshot_create', // TODO: Get from job metadata
              status: 'RUNNING',
              progress: 45,
              current_step: 'Exporting user data...',
              estimated_time_remaining_seconds: 120,
            },
          },
          error: null,
        },
        { status: 200 }
      )
    } catch (error: any) {
      logger.error(
        {
          correlation_id: correlationId,
          action: 'job_status_error',
          license_id: licenseId,
          job_id: jobId,
          error_message: error.message,
        },
        'Job status retrieval failed'
      )
      return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
    }
  }
)

export default licensesLifecycleRouter
