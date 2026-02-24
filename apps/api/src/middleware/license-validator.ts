/**
 * License validation middleware (Task 18)
 * Validates license status before upgrade execution
 * Applied to: POST /api/admin/workspace/{workspace_id}/upgrade*
 */

import { createLogger } from '@zidney/logger'
import crypto from 'crypto'
import type { Context, MiddlewareHandler, Next } from 'hono'
import { Pool } from 'pg'

const logger = createLogger('license-validator')

export interface LicenseContext {
  workspace_id: string
  status: string
  product_version: string
}

/**
 * Middleware: Validate license status
 * ACTIVE: proceed
 * SOFT_LOCKED: return 423
 * ARCHIVED: return 403
 */
export function createLicenseMiddleware(masterDb: Pool): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const workspaceId = c.req.param('workspace_id')
    const correlationId = c.get('correlation_id') || crypto.randomUUID()

    try {
      const result = await masterDb.query(
        `SELECT status, product_version FROM licenses WHERE workspace_id = $1`,
        [workspaceId]
      )

      if (result.rows.length === 0) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'LICENSE_NOT_FOUND',
              message: 'No active license for this workspace',
            },
          },
          403
        )
      }

      const license = result.rows[0]

      if (license.status === 'SOFT_LOCKED') {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'LICENSE_SOFT_LOCKED',
              message: 'Workspace is temporarily unavailable',
            },
          },
          423
        )
      }

      if (license.status === 'ARCHIVED') {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'LICENSE_ARCHIVED',
              message: 'Workspace is archived and cannot be upgraded',
            },
          },
          403
        )
      }

      if (license.status !== 'ACTIVE') {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'LICENSE_INACTIVE',
              message: 'Workspace license is not active',
            },
          },
          403
        )
      }

      // Attach license context to request
      c.set('licenseContext', {
        workspace_id: workspaceId,
        status: license.status,
        product_version: license.product_version,
      } as LicenseContext)

      logger.debug('License validated', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        license_status: license.status,
      })

      return next()
    } catch (error) {
      logger.error('License validation error', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Failed to validate license',
          },
        },
        500
      )
    }
  }
}

export default createLicenseMiddleware
