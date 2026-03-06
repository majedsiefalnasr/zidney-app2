/**
 * License Validation Middleware
 *
 * Validates license status before allowing access to protected routes.
 * Returns appropriate HTTP status codes:
 * - 423 Locked if SOFT_LOCKED
 * - 403 Forbidden if ARCHIVED
 * - 404 Not Found if LICENSE_NOT_FOUND
 *
 * Stage: STAGE_09_PRODUCTS
 * Task: T029
 * ADR-0003: License Enforcement Model
 */

import { createLogger } from '@zidney/logger'
import { ErrorCodes } from '@zidney/types/errors/ErrorCodes'
import type { Context, Next } from 'hono'

const logger = createLogger('api')

/**
 * License status enum
 */
enum LicenseStatus {
  ACTIVE = 'ACTIVE',
  SOFT_LOCKED = 'SOFT_LOCKED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

/**
 * License validation middleware
 *
 * Validator at mandatory for all workspace-bound routes.
 * Must execute AFTER authentication but BEFORE business logic.
 */
export async function licenseMiddleware(c: Context, next: Next): Promise<Response | undefined> {
  // Get workspace from context (set by auth middleware)
  const workspaceId = c.get('workspaceId')
  const workspaceSlug = c.get('workspaceSlug')
  const correlationId = c.get('correlationId')

  if (!workspaceId || !workspaceSlug) {
    logger.warn('workspace_context_missing', {
      correlation_id: correlationId,
      action: 'license_middleware',
    })
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
          message: 'Workspace context not found',
        },
      },
      401
    )
  }

  // TODO: Fetch license status from database (Stage 10)
  // For now, assume ACTIVE status
  const licenseStatus = (c.get('licenseStatus') as LicenseStatus) || LicenseStatus.ACTIVE

  // Validate license status
  if (licenseStatus === LicenseStatus.SOFT_LOCKED) {
    logger.warn('workspace_locked', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      workspace_slug: workspaceSlug,
      action: 'license_middleware',
    })
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: ErrorCodes.WORKSPACE_LOCKED,
          message: 'Workspace is locked',
        },
      },
      423
    )
  }

  if (licenseStatus === LicenseStatus.ARCHIVED) {
    logger.warn('workspace_archived', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      workspace_slug: workspaceSlug,
      action: 'license_middleware',
    })
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: ErrorCodes.WORKSPACE_ARCHIVED,
          message: 'Workspace is archived',
        },
      },
      403
    )
  }

  if (licenseStatus === LicenseStatus.DELETED) {
    logger.warn('license_not_found', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      workspace_slug: workspaceSlug,
      action: 'license_middleware',
    })
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: ErrorCodes.LICENSE_NOT_FOUND,
          message: 'License not found',
        },
      },
      404
    )
  }

  // License is valid, continue
  await next()
}

/**
 * Get license status from context
 */
export function getLicenseStatus(c: Context): string {
  return c.get('licenseStatus') || LicenseStatus.ACTIVE
}
