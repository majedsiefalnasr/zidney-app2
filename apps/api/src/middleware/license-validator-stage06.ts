/**
 * License Validation Middleware — STAGE_06 Attempt Engine
 *
 * Purpose: Validate workspace license status BEFORE any DB access
 * Middleware Priority: SECOND (after tenant resolver; before business logic)
 *
 * Task: T014 – License validator middleware (2nd layer, after tenant resolver)
 * Phase: B – Middleware Integration
 * Stage: STAGE_06_ATTEMPT_ENGINE_FOUNDATION
 *
 * Constitutional Compliance:
 * - ADR-0007: Version compatibility validated (schema_version + product_version)
 * - License middleware is hard requirement for attempt engine
 * - Prevents DB access if license SOFT_LOCKED or ARCHIVED
 * - Forces graceful degradation: 423 (SOFT_LOCKED), 403 (ARCHIVED)
 */

import { Logger } from '@zidney/logging'
import { Context, MiddlewareHandler } from 'hono'

export interface LicenseContextStage06 {
  workspace_id: string
  status: 'ACTIVE' | 'SOFT_LOCKED' | 'ARCHIVED' | 'TRIAL'
  product_version: string
  schema_version: number
  correlation_id: string
}

/**
 * License validator middleware for STAGE_06
 * Validates:
 * 1. License exists
 * 2. License is ACTIVE
 * 3. Schema version compatible
 * 4. Product version compatible
 *
 * Error Codes (RFC 7807):
 * - 404: LICENSE_NOT_FOUND
 * - 403: LICENSE_ARCHIVED / WORKSPACE_ARCHIVED
 * - 423: LICENSE_SOFT_LOCKED / WORKSPACE_SOFT_LOCKED
 * - 426: SCHEMA_VERSION_INCOMPATIBLE / PRODUCT_VERSION_INCOMPATIBLE
 */
export function createLicenseValidatorStage06(
  logger: Logger
): MiddlewareHandler {
  return async (c: Context, next) => {
    const correlation_id = c.get('correlationId') || 'unknown'
    const tenant = c.get('tenant')
    const workspace_id = tenant?.id

    if (!workspace_id) {
      logger.warn('License validator: Missing tenant context', {
        correlation_id,
      })
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing tenant context',
          },
        },
        400
      )
    }

    try {
      // Query master database for license
      // Assumption: req.masterDb is attached by tenant resolver
      const masterDb = c.get('masterDb')
      if (!masterDb) {
        logger.error('License validator: Master DB not available', {
          correlation_id,
          workspace_id,
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'DATABASE_UNAVAILABLE',
              message: 'License validation service temporarily unavailable',
            },
          },
          503
        )
      }

      const result = await masterDb.query(
        `
        SELECT
          l.status,
          l.product_version,
          w.schema_version
        FROM licenses l
        JOIN workspaces w ON l.workspace_id = w.id
        WHERE l.workspace_id = $1
        LIMIT 1
        `,
        [workspace_id]
      )

      // License not found
      if (result.rows.length === 0) {
        logger.warn('License validator: License not found', {
          correlation_id,
          workspace_id,
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'LICENSE_NOT_FOUND',
              message: 'No active license found for this workspace',
            },
          },
          404
        )
      }

      const license = result.rows[0]

      // Check license status: ARCHIVED
      if (license.status === 'ARCHIVED') {
        logger.warn('License validator: Workspace archived', {
          correlation_id,
          workspace_id,
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'WORKSPACE_ARCHIVED',
              message: 'Workspace is archived and cannot accept new requests',
            },
          },
          403
        )
      }

      // Check license status: SOFT_LOCKED
      if (license.status === 'SOFT_LOCKED') {
        logger.warn('License validator: Workspace soft-locked', {
          correlation_id,
          workspace_id,
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'WORKSPACE_SOFT_LOCKED',
              message:
                'Workspace is temporarily unavailable. Please try again later.',
            },
          },
          423
        )
      }

      // Check license status: Must be ACTIVE or TRIAL
      if (license.status !== 'ACTIVE' && license.status !== 'TRIAL') {
        logger.warn('License validator: License inactive', {
          correlation_id,
          workspace_id,
          status: license.status,
        })
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

      // Validate schema version compatibility
      const MIN_SUPPORTED_SCHEMA_VERSION = 1
      if (license.schema_version < MIN_SUPPORTED_SCHEMA_VERSION) {
        logger.warn('License validator: Schema version incompatible', {
          correlation_id,
          workspace_id,
          schema_version: license.schema_version,
          min_supported: MIN_SUPPORTED_SCHEMA_VERSION,
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'SCHEMA_VERSION_INCOMPATIBLE',
              message: `Workspace schema version ${license.schema_version} is not compatible with this API version`,
            },
          },
          426
        )
      }

      // Validate product version compatibility
      // For now, accept any product_version >= 1.0.0
      const CURRENT_PRODUCT_VERSION = '1.0.0'
      const versionCompare = (v1: string, v2: string): number => {
        const parts1 = v1.split('.').map(Number)
        const parts2 = v2.split('.').map(Number)
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
          const p1 = parts1[i] || 0
          const p2 = parts2[i] || 0
          if (p1 > p2) return 1
          if (p1 < p2) return -1
        }
        return 0
      }

      const version_cmp = versionCompare(
        license.product_version,
        CURRENT_PRODUCT_VERSION
      )
      if (version_cmp < 0) {
        logger.warn('License validator: Product version incompatible', {
          correlation_id,
          workspace_id,
          product_version: license.product_version,
          current_version: CURRENT_PRODUCT_VERSION,
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'PRODUCT_VERSION_INCOMPATIBLE',
              message: `Product version ${license.product_version} is not compatible with this API version`,
            },
          },
          426
        )
      }

      // Attach license context to request
      const license_context: LicenseContextStage06 = {
        workspace_id,
        status: license.status,
        product_version: license.product_version,
        schema_version: license.schema_version,
        correlation_id,
      }

      c.set('license', license_context)

      logger.debug('License validated successfully', {
        correlation_id,
        workspace_id,
        status: license.status,
      })

      await next()
    } catch (error) {
      logger.error('License validator: Unexpected error', {
        correlation_id,
        workspace_id,
        error: error instanceof Error ? error.message : String(error),
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'License validation failed',
          },
        },
        500
      )
    }
  }
}

export default createLicenseValidatorStage06
