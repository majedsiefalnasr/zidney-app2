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

import { Database } from 'better-sqlite3'
import { Context, MiddlewareHandler } from 'hono'
import { Logger } from 'pino'
import { ACCESSIBLE_STATUSES } from '../../../packages/domain-core/src/licenses/constants'
import {
  LicenseError,
  LicenseNotFoundError,
} from '../../../packages/domain-core/src/licenses/errors'
import { LicenseStatus } from '../../../packages/domain-core/src/licenses/types'

interface LicenseMiddlewareContext extends Context {
  license?: any
  correlation_id?: string
}

export function createLicenseMiddleware(
  masterDb: Database,
  logger: Logger
): MiddlewareHandler {
  return async (ctx: LicenseMiddlewareContext, next) => {
    try {
      // Get workspace slug from request context
      // This should be set by tenant resolver middleware
      const workspaceSlug =
        ctx.req.header('x-workspace-slug') ||
        ctx.req.query('workspace_slug') ||
        ctx.workspaceSlug

      if (!workspaceSlug) {
        // If no workspace specified, allow (e.g., for public endpoints)
        return next()
      }

      // T039: Query master_db for license
      const stmt = masterDb.prepare(`
        SELECT * FROM licenses 
        WHERE workspace_slug = ? AND deleted_at IS NULL
      `)

      const license = stmt.get(workspaceSlug) as any

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
        const updateStmt = masterDb.prepare(`
          UPDATE licenses 
          SET status = ?, archived_at = NOW(), updated_at = NOW()
          WHERE id = ? AND status = ? AND soft_lock_until < NOW()
          RETURNING *
        `)

        const updated = updateStmt.get(
          LicenseStatus.ARCHIVED,
          license.id,
          LicenseStatus.SOFT_LOCKED
        ) as any

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

        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: response.code,
              message: response.message,
              status: response.status,
            },
          },
          response.status
        )
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
        return ctx.json(error.toResponse(), error.httpStatus)
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
