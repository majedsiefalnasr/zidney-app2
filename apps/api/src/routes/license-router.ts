import {
  createLicense,
  deleteLicense,
  transitionLicenseState,
} from '@zidney/domain-core/license'
import { createLogger } from '@zidney/logger'
import { Context, Hono } from 'hono'
import { toLicenseError } from '../responses/license-error-handler'

const logger = createLogger('license-router')

/**
 * License Router
 *
 * Routes for license management (MMC and Admin endpoints).
 * All routes require license enforcement middleware (inherited from parent router).
 */
export const licenseRouter = new Hono()

/**
 * POST /api/mmc/licenses
 * Create a new license for a workspace
 *
 * Auth: MMC role required
 * Idempotency: UNIQUE(workspace_slug) constraint prevents duplicates
 * Transactions: YES (createLicense wraps in SERIALIZABLE)
 * Response: {success, data: {license_id, status, limits, ...}, error}
 */
licenseRouter.post('/mmc/licenses', async (ctx: Context) => {
  const correlationId = ctx.get('correlation_id')
  const masterDb = ctx.get('master_db')
  let body: any

  try {
    // Extract request body
    body = await ctx.req.json()
    const { product_id, workspace_id, workspace_slug } = body

    // Validate input
    if (!product_id || !workspace_id || !workspace_slug) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'license_create_invalid_input',
          workspace_slug,
          error_code: 'INVALID_REQUEST',
        },
        'Invalid license creation request'
      )
      return ctx.json(toLicenseError('INVALID_REQUEST'), { status: 400 })
    }

    // Call domain service (transactional)
    const result = await createLicense(masterDb, {
      product_id,
      workspace_id,
      workspace_slug,
      expected_schema_version: '1.0.0',
      expected_product_version: ctx.get('runtime_version') || '1.0.0',
    })

    logger.info(
      {
        correlation_id: correlationId,
        action: 'license_created',
        license_id: result.id,
        workspace_slug,
        status: result.status,
      },
      'License created successfully'
    )

    return ctx.json(
      {
        success: true,
        data: result,
        error: null,
      },
      { status: 201 }
    )
  } catch (error: any) {
    // Handle duplicate workspace_slug
    if (error.code === '23505' || error.message?.includes('unique')) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'license_create_duplicate',
          workspace_slug: body?.workspace_slug,
          error_code: 'WORKSPACE_ALREADY_EXISTS',
        },
        'Duplicate workspace slug'
      )
      return ctx.json(toLicenseError('WORKSPACE_ALREADY_EXISTS'), {
        status: 409,
      })
    }

    // Log unexpected error
    logger.error(
      {
        correlation_id: correlationId,
        action: 'license_create_error',
        error_message: error.message,
      },
      'License creation failed'
    )

    return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
  }
})

/**
 * GET /api/mmc/licenses/:license_id
 * Retrieve a specific license
 *
 * Auth: MMC role required
 * Transactions: NO (read-only)
 * Response: License object or 404
 */
licenseRouter.get('/mmc/licenses/:license_id', async (ctx: Context) => {
  const correlationId = ctx.get('correlation_id')
  const masterDb = ctx.get('master_db')
  const license_id = ctx.req.param('license_id')

  try {
    // Query license
    const result = await masterDb.query(
      'SELECT * FROM licenses WHERE id = $1 LIMIT 1',
      [license_id]
    )

    if (!result.rows.length) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'license_get_not_found',
          license_id,
          error_code: 'LICENSE_NOT_FOUND',
        },
        'License not found'
      )
      return ctx.json(toLicenseError('LICENSE_NOT_FOUND'), { status: 404 })
    }

    const license = result.rows[0]

    logger.debug(
      {
        correlation_id: correlationId,
        action: 'license_retrieved',
        license_id,
      },
      'License retrieved'
    )

    return ctx.json(
      {
        success: true,
        data: license,
        error: null,
      },
      { status: 200 }
    )
  } catch (error: any) {
    logger.error(
      {
        correlation_id: correlationId,
        action: 'license_get_error',
        license_id,
        error_message: error.message,
      },
      'License retrieval failed'
    )

    return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
  }
})

/**
 * PATCH /api/mmc/licenses/:license_id/state
 * Transition license state
 *
 * Auth: MMC role required
 * Transactions: YES (transitionLicenseState wraps in SERIALIZABLE + SELECT FOR UPDATE)
 * Idempotency: YES (Redis key + 24hr TTL per Clarification Q2)
 * Response: Updated license or error code
 */
licenseRouter.patch('/mmc/licenses/:license_id/state', async (ctx: Context) => {
  const correlationId = ctx.get('correlation_id')
  const masterDb = ctx.get('master_db')
  const license_id = ctx.req.param('license_id')

  try {
    const body = await ctx.req.json()
    const { target_state, reason } = body

    // Validate target state
    const validStates = ['ACTIVE', 'SOFT_LOCKED', 'ARCHIVED', 'DELETED']
    if (!validStates.includes(target_state)) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'license_transition_invalid_state',
          license_id,
          target_state,
          error_code: 'INVALID_STATE_TRANSITION',
        },
        'Invalid target state'
      )
      return ctx.json(toLicenseError('INVALID_STATE_TRANSITION'), {
        status: 409,
      })
    }

    // Call domain service (transactional, idempotent)
    const result = await transitionLicenseState(masterDb, {
      license_id,
      target_state,
      reason,
    })

    if (!result.success) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'license_transition_failed',
          license_id,
          target_state,
          error_code: result.error_code,
        },
        'License transition failed'
      )
      const errorCode = result.error_code || 'INTERNAL_ERROR'
      const status = result.http_status || 500
      ctx.status(status as any)
      return ctx.json(toLicenseError(errorCode))
    }

    logger.info(
      {
        correlation_id: correlationId,
        action: 'license_state_transitioned',
        license_id,
        from_state: result.previous_state,
        to_state: target_state,
      },
      'License state transitioned'
    )

    return ctx.json(
      {
        success: true,
        data: result.license,
        error: null,
      },
      { status: 200 }
    )
  } catch (error: any) {
    logger.error(
      {
        correlation_id: correlationId,
        action: 'license_transition_error',
        license_id,
        error_message: error.message,
      },
      'License transition failed'
    )

    return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
  }
})

/**
 * GET /api/admin/workspace/:workspace_id/license
 * Retrieve license for a workspace (admin view)
 *
 * Auth: Admin or workspace staff role required
 * Transactions: NO (read-only)
 * Response: License object with full details
 */
licenseRouter.get(
  '/admin/workspace/:workspace_id/license',
  async (ctx: Context) => {
    const correlationId = ctx.get('correlation_id')
    const masterDb = ctx.get('master_db')
    const workspace_id = ctx.req.param('workspace_id')

    try {
      // Query license by workspace_id
      const result = await masterDb.query(
        'SELECT * FROM licenses WHERE workspace_id = $1 LIMIT 1',
        [workspace_id]
      )

      if (!result.rows.length) {
        logger.warn(
          {
            correlation_id: correlationId,
            action: 'workspace_license_not_found',
            workspace_id,
            error_code: 'LICENSE_NOT_FOUND',
          },
          'License not found for workspace'
        )
        return ctx.json(toLicenseError('LICENSE_NOT_FOUND'), {
          status: 404,
        })
      }

      const license = result.rows[0]

      logger.debug(
        {
          correlation_id: correlationId,
          action: 'workspace_license_retrieved',
          workspace_id,
          license_id: license.id,
        },
        'Workspace license retrieved'
      )

      return ctx.json(
        {
          success: true,
          data: license,
          error: null,
        },
        { status: 200 }
      )
    } catch (error: any) {
      logger.error(
        {
          correlation_id: correlationId,
          action: 'workspace_license_retrieve_error',
          workspace_id,
          error_message: error.message,
        },
        'Workspace license retrieval failed'
      )

      return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
    }
  }
)

/**
 * DELETE /api/mmc/licenses/:license_id
 * Delete a license (Task T029 – License Deletion Endpoint)
 *
 * Auth: Super-admin MMC role required
 * Transactions: YES (deleteLicense wraps in SERIALIZABLE)
 * Idempotency: NO (destructive operation)
 * Pre-conditions: License ARCHIVED, snapshot exists
 * Response: {success: true, data: {license_id, status: DELETED, deleted_at}}
 */
licenseRouter.delete('/mmc/licenses/:license_id', async (ctx: Context) => {
  const correlationId = ctx.get('correlation_id')
  const masterDb = ctx.get('master_db')
  const license_id = ctx.req.param('license_id')
  const userRole = ctx.get('user_role') // Would be set by auth middleware

  try {
    // Verify super-admin role
    if (userRole !== 'super_admin' && userRole !== 'mmc_admin') {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'license_delete_unauthorized',
          license_id,
          user_role: userRole,
          error_code: 'UNAUTHORIZED',
        },
        'Unauthorized license deletion attempt'
      )
      return ctx.json(toLicenseError('UNAUTHORIZED'), { status: 403 })
    }

    // Extract request body
    const body = await ctx.req.json()
    const { confirm_deletion, reason } = body

    // Call domain service (transactional)
    const result = await deleteLicense(masterDb, license_id, confirm_deletion)

    if (!result.success) {
      logger.warn(
        {
          correlation_id: correlationId,
          action: 'license_delete_failed',
          license_id,
          error_code: result.error_code,
        },
        'License deletion failed'
      )
      const errorCode = result.error_code || 'INTERNAL_ERROR'
      const status = result.http_status || 500
      ctx.status(status as any)
      return ctx.json(toLicenseError(errorCode))
    }

    logger.info(
      {
        correlation_id: correlationId,
        action: 'license_deleted',
        license_id,
        reason,
        deleted_at: result.deleted_at?.toISOString(),
      },
      'License deleted successfully'
    )

    return ctx.json(
      {
        success: true,
        data: {
          license_id,
          status: 'DELETED',
          deleted_at: result.deleted_at,
        },
        error: null,
      },
      { status: 200 }
    )
  } catch (error: any) {
    logger.error(
      {
        correlation_id: correlationId,
        action: 'license_delete_error',
        license_id,
        error_message: error.message,
      },
      'License deletion error'
    )

    return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
  }
})

export default licenseRouter
