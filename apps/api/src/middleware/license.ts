/**
 * License Validation Middleware
 *
 * Execution order: SECOND (after tenant resolver)
 *
 * Responsibility:
 * 1. Query MMC master DB for license status
 * 2. Validate status is in (ACTIVE, TRIAL)
 * 3. Return appropriate error codes:
 *    - 423 if SOFT_LOCKED
 *    - 403 if ARCHIVED
 *    - 404 if license not found
 * 4. Inject license info into request context
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 */

import { createLogger } from '@zidney/logging'
import type { Context, MiddlewareHandler, Next } from 'hono'

const logger = createLogger('license-middleware')

/**
 * License statuses
 */
enum LicenseStatus {
  ACTIVE = 'ACTIVE',
  TRIAL = 'TRIAL',
  SOFT_LOCKED = 'SOFT_LOCKED',
  ARCHIVED = 'ARCHIVED',
}

export interface LicenseInfo {
  workspace_id: string
  status: LicenseStatus
  product_version_compatibility: string
  plan_type: string
  expires_at?: Date
}

/**
 * License Validation Middleware
 *
 * @param ctx - Hono context (with tenant information from tenant resolver)
 * @param next - Next middleware function
 */
export const licenseMiddleware: MiddlewareHandler = async (
  ctx: Context,
  next: Next
) => {
  const correlationId = ctx.get('correlation_id')
  const tenant = ctx.get('tenant')

  if (!tenant) {
    logger.error('License middleware called without tenant context', {
      correlationId,
    })
    return ctx.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'Missing tenant context' },
      },
      500
    )
  }

  try {
    // TODO: Query MMC master DB for license
    // SELECT status, product_version_compatibility, plan_type, expires_at
    // FROM licenses WHERE workspace_id = ? LIMIT 1

    // TODO: Validate license status
    const license = await getLicenseInfo(tenant.workspace_id) // Implementation stub

    if (!license) {
      logger.warn('License not found for workspace', {
        workspace_id: tenant.workspace_id,
        correlationId,
      })
      return ctx.json(
        {
          success: false,
          data: null,
          error: { code: 'LICENSE_NOT_FOUND', message: 'License not found' },
        },
        404
      )
    }

    // Validate license status
    if (license.status === LicenseStatus.SOFT_LOCKED) {
      logger.warn('Workspace license is soft-locked', {
        workspace_id: tenant.workspace_id,
        correlationId,
      })
      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'LICENSE_SOFT_LOCKED',
            message: 'Workspace access temporarily suspended',
          },
        },
        423 // HTTP 423 Locked
      )
    }

    if (license.status === LicenseStatus.ARCHIVED) {
      logger.warn('Workspace license is archived', {
        workspace_id: tenant.workspace_id,
        correlationId,
      })
      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'LICENSE_ARCHIVED',
            message: 'Workspace access denied',
          },
        },
        403
      )
    }

    if (![LicenseStatus.ACTIVE, LicenseStatus.TRIAL].includes(license.status)) {
      logger.warn('License status not permissible', {
        workspace_id: tenant.workspace_id,
        status: license.status,
        correlationId,
      })
      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'LICENSE_INVALID_STATUS',
            message: 'Workspace cannot be accessed in current license state',
          },
        },
        403
      )
    }

    // Inject license info into context
    ctx.set('license', license)

    logger.debug('License validated', {
      workspace_id: tenant.workspace_id,
      status: license.status,
      correlationId,
    })

    await next()
  } catch (error) {
    logger.error('License validation error', {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    })

    return ctx.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      },
      500
    )
  }
}

/**
 * Get license info for workspace (stub)
 * TODO: Implement actual DB query
 */
async function getLicenseInfo(
  _workspace_id: string
): Promise<LicenseInfo | null> {
  // Stub implementation
  throw new Error('Not implemented')
}

export default licenseMiddleware
