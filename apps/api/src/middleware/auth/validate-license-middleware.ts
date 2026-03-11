/**
 * License Validation Middleware
 *
 * File: apps/api/src/middleware/auth/validate-license-middleware.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Check workspace license state and block access if soft-locked or archived.
 * Integrates with STAGE_04 (License Engine).
 *
 * License States:
 * - ACTIVE: All operations allowed
 * - SOFT_LOCKED: Grace period, limited operations (423 Temporary Unavailable)
 * - ARCHIVED: Workspace deleted/suspended (403 Forbidden)
 * - DELETED: Workspace destroyed (403 Forbidden)
 *
 * Timing:
 * - First check: During login (before token generation)
 * - Second check: On every authenticated request (via middleware)
 * - Reason: License can change AFTER token issuance
 *
 * Example Scenario:
 * 1. User logs in, workspace ACTIVE → token issued
 * 2. License expires → workspace SOFT_LOCKED
 * 3. User's old token becomes invalid → 423 response
 * 4. Frontend redirects to license payment page
 *
 * Errors:
 * - 423: Workspace SOFT_LOCKED (temporary, grace period)
 * - 403: Workspace ARCHIVED or DELETED
 */

import { logLicenseBlocked } from '@zidney/domain-core/auth'
import { logger } from '@zidney/logger'
import type { Context, Next } from 'hono'

/**
 * Validate workspace license state
 *
 * Execution Order: 4th (after JWT + token version checks, before RBAC)
 * Reason: Fail fast if workspace not licensed
 */
export function validateLicenseMiddleware() {
  return async (c: Context, next: Next): Promise<Response | undefined> => {
    const correlationId = c.get('correlationId') || 'unknown'

    try {
      // Check if authenticated (skip for public routes)
      const isAuthenticated = c.get('isAuthenticated')
      if (!isAuthenticated) {
        await next()
        return
      }

      const workspaceSlug = c.get('workspaceSlug') || 'unknown'
      const masterDb = c.get('masterDb')

      // MMC routes don't need license check (platform-level)
      const authPayload = c.get('authPayload')
      if (authPayload && authPayload.scope === 'MMC') {
        await next()
        return
      }

      if (!masterDb) {
        c.status(500)
        return c.json({
          success: false,
          data: null,
          error: {
            code: 'DB_CONTEXT_MISSING',
            message: 'Database context not found',
          },
        })
      }

      // Fetch workspace license state from master database
      const licenseResult = await masterDb.query(
        `SELECT status, product_version FROM licenses
         WHERE workspace_slug = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [workspaceSlug]
      )

      if (licenseResult.rows.length === 0) {
        // No license found
        const userId = c.get('userId')
        await logLicenseBlocked(correlationId, workspaceSlug, 'NO_LICENSE', 403, userId)

        c.status(403)
        return c.json({
          success: false,
          data: null,
          error: {
            code: 'LICENSE_NOT_FOUND',
            message: 'Workspace license not found',
          },
        })
      }

      const license = licenseResult.rows[0]
      const licenseStatus = license.status

      // Check license state
      if (licenseStatus === 'ACTIVE') {
        // License valid - continue
        await next()
        return
      }

      if (licenseStatus === 'SOFT_LOCKED') {
        // Grace period - workspace can still operate
        const userId = c.get('userId')
        await logLicenseBlocked(correlationId, workspaceSlug, licenseStatus, 423, userId)

        c.status(423)
        return c.json({
          success: false,
          data: null,
          error: {
            code: 'WORKSPACE_SOFT_LOCKED',
            message:
              'Workspace is temporarily unavailable due to billing issue. Please contact administrator.',
          },
        })
      }

      if (licenseStatus === 'ARCHIVED' || licenseStatus === 'DELETED') {
        // Workspace no longer available
        const userId = c.get('userId')
        await logLicenseBlocked(correlationId, workspaceSlug, licenseStatus, 403, userId)

        c.status(403)
        return c.json({
          success: false,
          data: null,
          error: {
            code: 'WORKSPACE_UNAVAILABLE',
            message: 'Workspace has been archived or deleted and is no longer available.',
          },
        })
      }

      // Unknown status - treat as blocked
      const userId = c.get('userId')
      await logLicenseBlocked(correlationId, workspaceSlug, licenseStatus, 403, userId)

      c.status(403)
      return c.json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_LICENSE_STATUS',
          message: `License status invalid: ${licenseStatus}`,
        },
      })
    } catch (error) {
      logger.error('License validation error:', { error })
      c.status(500)
      return c.json({
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'License validation failed',
        },
      })
    }
  }
}
