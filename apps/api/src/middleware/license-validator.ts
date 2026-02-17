/**
 * License validation middleware (Task 18)
 * Validates license status before upgrade execution
 * Applied to: POST /api/admin/workspace/{workspace_id}/upgrade*
 */

import { NextFunction, Request, Response } from 'express'
import { Database } from 'pg'

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
export function createLicenseMiddleware(masterDb: Database) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { workspace_id } = req.params
    const correlation_id =
      req.headers['x-correlation-id'] || crypto.randomUUID()

    try {
      const result = await masterDb.query(
        `SELECT status, product_version FROM licenses WHERE workspace_id = $1`,
        [workspace_id]
      )

      if (result.rows.length === 0) {
        return res.status(403).json({
          success: false,
          data: null,
          error: {
            code: 'LICENSE_NOT_FOUND',
            message: 'No active license for this workspace',
          },
        })
      }

      const license = result.rows[0]

      if (license.status === 'SOFT_LOCKED') {
        return res.status(423).json({
          success: false,
          data: null,
          error: {
            code: 'LICENSE_SOFT_LOCKED',
            message: 'Workspace is temporarily unavailable',
          },
        })
      }

      if (license.status === 'ARCHIVED') {
        return res.status(403).json({
          success: false,
          data: null,
          error: {
            code: 'LICENSE_ARCHIVED',
            message: 'Workspace is archived and cannot be upgraded',
          },
        })
      }

      if (license.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          data: null,
          error: {
            code: 'LICENSE_INACTIVE',
            message: 'Workspace license is not active',
          },
        })
      }

      // Attach license context to request
      ;(req as any).licenseContext = {
        workspace_id,
        status: license.status,
        product_version: license.product_version,
      } as LicenseContext

      console.log(
        JSON.stringify({
          level: 'DEBUG',
          service: 'license-middleware',
          event: 'license_validated',
          correlation_id,
          workspace_id,
          license_status: license.status,
          timestamp: new Date().toISOString(),
        })
      )

      next()
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        data: null,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to validate license',
        },
      })
    }
  }
}

import crypto from 'crypto'
