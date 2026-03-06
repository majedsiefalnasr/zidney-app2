/**
 * License Enforcement Middleware
 *
 * File: apps/api/src/middleware/license.middleware.ts
 * Tasks: T039, T041
 *
 * Validates license status before allowing tenant API access.
 * Enforces atomic check-and-update for soft-lock auto-transition.
 * Blocks access based on license status:
 * - ACTIVE: Allow
 * - PENDING_PROVISION: Block (503 SERVICE_UNAVAILABLE)
 * - SOFT_LOCKED: Block (403 FORBIDDEN)
 * - ARCHIVED: Block (403 FORBIDDEN)
 * - PROVISION_FAILED: Block (503 SERVICE_UNAVAILABLE)
 * - DELETED: Block (404 NOT_FOUND)
 */

import { ACCESSIBLE_STATUSES } from '@zidney/domain-core/licenses/constants'
import { LicenseError, LicenseNotFoundError } from '@zidney/domain-core/licenses/errors'
import { LicenseStatus } from '@zidney/domain-core/licenses/types'
import type { Logger } from '@zidney/logger'
import type { Context, MiddlewareHandler } from 'hono'
import type { Pool } from 'pg'

interface LicenseMiddlewareContext extends Context {
  license?: any
  correlation_id?: string
  workspaceSlug?: string
}

export function createLicenseMiddleware(masterDb: Pool, logger: Logger): MiddlewareHandler {
  return async (ctx: LicenseMiddlewareContext, next) => {
    try {
      // Get workspace slug from request context
      // This should be set by tenant resolver middleware
      const workspaceSlug =
        ctx.req.header('x-workspace-slug') || ctx.req.query('workspace_slug') || ctx.workspaceSlug

      if (!workspaceSlug) {
        // If no workspace specified, allow (e.g., for public endpoints)
        return next()
      }

      // T039: Query master_db for license
      const licenseResult = await masterDb.query(
        `
        SELECT * FROM licenses
        WHERE workspace_slug = $1 AND deleted_at IS NULL
      `,
        [workspaceSlug]
      )
      const license = licenseResult.rows[0] as any

      if (!license) {
        throw new LicenseNotFoundError()
      }

      // Check license status
      const status: LicenseStatus = license.status

      // T041: Atomic check-and-update for soft-lock expiration
      if (
        status === LicenseStatus.SOFT_LOCKED &&
        license.soft_lock_until &&
        new Date(license.soft_lock_until) < new Date()
      ) {
        // Grace period expired, auto-transition to ARCHIVED
        const updatedResult = await masterDb.query(
          `
          UPDATE licenses
          SET status = $1, archived_at = NOW(), updated_at = NOW()
          WHERE id = $2 AND status = $3 AND soft_lock_until < NOW()
          RETURNING *
        `,
          [LicenseStatus.ARCHIVED, license.id, LicenseStatus.SOFT_LOCKED]
        )
        const updated = updatedResult.rows[0] as any

        if (updated) {
          logger.info({
            event: 'soft_lock_auto_transitioned',
            license_id: license.id,
            workspace_slug: workspaceSlug,
            correlation_id: ctx.correlation_id,
          })

          // Return 403 FORBIDDEN (now archived)
          return ctx.json(
            {
              success: false,
              data: null,
              error: {
                code: 'LICENSE_ARCHIVED',
                message: 'License is archived. Access denied',
                status: 403,
              },
            },
            403
          )
        }
      }

      // Validate status is in accessible list
      if (!ACCESSIBLE_STATUSES.includes(status)) {
        const statusBlockMap: Record<LicenseStatus, any> = {
          [LicenseStatus.PENDING_PROVISION]: {
            status: 503,
            code: 'LICENSE_PENDING_PROVISION',
            message: 'License provisioning in progress',
          },
          [LicenseStatus.SOFT_LOCKED]: {
            status: 403,
            code: 'LICENSE_SOFT_LOCKED',
            message: 'License is soft-locked. Access denied',
          },
          [LicenseStatus.ARCHIVED]: {
            status: 403,
            code: 'LICENSE_ARCHIVED',
            message: 'License is archived. Access denied',
          },
          [LicenseStatus.PROVISION_FAILED]: {
            status: 503,
            code: 'PROVISIONING_FAILED',
            message: 'License provisioning failed. Access denied',
          },
          [LicenseStatus.DELETED]: {
            status: 404,
            code: 'LICENSE_NOT_FOUND',
            message: 'License not found',
          },
          [LicenseStatus.ACTIVE]: {
            status: 200,
            code: 'OK',
            message: 'OK',
          }, // Should not reach here
        }

        const response = statusBlockMap[status]

        logger.warn({
          event: 'license_middleware_blocked',
          workspace_slug: workspaceSlug,
          license_status: status,
          block_reason: response.code,
          correlation_id: ctx.correlation_id,
        })

        ctx.status(response.status as any)
        return ctx.json({
          success: false,
          data: null,
          error: {
            code: response.code,
            message: response.message,
            status: response.status,
          },
        })
      }

      // Attach license to context for downstream handlers
      ctx.license = license

      logger.debug({
        event: 'license_middleware_pass',
        workspace_slug: workspaceSlug,
        license_id: license.id,
        correlation_id: ctx.correlation_id,
      })

      // Pass to next middleware
      return next()
    } catch (error: any) {
      logger.error({
        event: 'license_middleware_error',
        error_message: error.message,
        error_code: error.code,
        correlation_id: ctx.correlation_id,
      })

      if (error instanceof LicenseError) {
        ctx.status(error.httpStatus as any)
        return ctx.json(error.toResponse())
      }

      // Generic error
      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            status: 500,
          },
        },
        500
      )
    }
  }
}

export default createLicenseMiddleware
