/**
 * LicenseValidation Middleware - Validate license status before workspace access
 *
 * Purpose: Ensure license is ACTIVE before allowing requests
 * Order: Must run AFTER tenant resolver, BEFORE business logic
 *
 * Task: T015 – Integrate license middleware (validation BEFORE pool registration)
 * Phase: 01 – Platform Foundation
 * Stage: STAGE_05_TENANT_PROVISIONING_SERVICE
 *
 * Status mapping:
 * - ACTIVE → Continue
 * - SOFT_LOCKED → 423 Locked
 * - ARCHIVED → 403 Forbidden
 * - FAILED → 503 Service Unavailable
 * - DELETED → 404 Not Found
 * - PROVISIONING → 503 Try Again
 */

import { createLogger } from '@zidney/logger'
import type { Context, MiddlewareHandler, Next } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { Pool } from 'pg'

const logger = createLogger('license-validation')

export interface LicenseStatus {
  id: number
  status: string
  soft_lock_until?: string
}

/**
 * LicenseValidationMiddleware: Validates license status for workspace access
 */
export class LicenseValidationMiddleware {
  private master_pool: Pool
  private license_cache: Map<
    number,
    { status: LicenseStatus; timestamp: number }
  > = new Map()
  private cache_ttl_ms: number = 5 * 60 * 1000 // 5 minutes

  constructor(master_pool: Pool) {
    this.master_pool = master_pool
  }

  /**
   * Get license status from master database
   * Uses cache for performance (5 minute TTL)
   */
  private async getLicenseStatus(
    license_id: number
  ): Promise<LicenseStatus | null> {
    // Check cache
    const cached = this.license_cache.get(license_id)
    if (cached && Date.now() - cached.timestamp < this.cache_ttl_ms) {
      return cached.status
    }

    try {
      const client = await this.master_pool.connect()
      try {
        const result = await client.query(
          `
          SELECT id, status, soft_lock_until
          FROM licenses
          WHERE id = $1
          LIMIT 1
          `,
          [license_id]
        )

        if (result.rows.length === 0) {
          return null
        }

        const status = result.rows[0]

        // Cache result
        this.license_cache.set(license_id, {
          status,
          timestamp: Date.now(),
        })

        return status
      } finally {
        client.release()
      }
    } catch (error) {
      logger.error('Failed to query license status', {
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Map license status to HTTP response
   */
  private getStatusResponse(status: LicenseStatus): {
    http_status: number
    error_code: string
    message: string
  } {
    switch (status.status) {
      case 'ACTIVE':
        return { http_status: 200, error_code: '', message: '' } // Allowed
      case 'SOFT_LOCKED':
        return {
          http_status: 423,
          error_code: 'WS_003',
          message: `Workspace is temporarily locked until ${status.soft_lock_until}`,
        }
      case 'ARCHIVED':
        return {
          http_status: 403,
          error_code: 'WS_004',
          message: 'Workspace has been archived and is no longer accessible',
        }
      case 'FAILED':
        return {
          http_status: 503,
          error_code: 'WS_006',
          message: 'Workspace provisioning failed, please contact support',
        }
      case 'DELETED':
        return {
          http_status: 404,
          error_code: 'WS_001',
          message: 'Workspace has been deleted',
        }
      case 'PROVISIONING':
        return {
          http_status: 503,
          error_code: 'WS_002',
          message:
            'Workspace is still provisioning, please try again in a moment',
        }
      default:
        return {
          http_status: 503,
          error_code: 'WS_007',
          message: `Unknown license status: ${status.status}`,
        }
    }
  }

  /**
   * Hono middleware function
   */
  middleware(): MiddlewareHandler {
    return async (c: Context, next: Next) => {
      try {
        // Require tenant context from tenant resolver
        const tenant = c.get('tenant')
        if (!tenant) {
          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: 'SYSTEM_ERROR',
                message:
                  'Tenant context not found (tenantResolver must run first)',
              },
            },
            500
          )
        }

        // Get license status
        const license_status = await this.getLicenseStatus(tenant.license_id)
        if (!license_status) {
          return c.json(
            {
              success: false,
              data: null,
              error: { code: 'WS_001', message: 'License not found' },
            },
            404
          )
        }

        // Validate license status
        const status_response = this.getStatusResponse(license_status)

        if (status_response.http_status !== 200) {
          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: status_response.error_code,
                message: status_response.message,
              },
            },
            status_response.http_status as ContentfulStatusCode
          )
        }

        // License is ACTIVE, continue
        return next()
      } catch (error) {
        logger.error('LicenseValidation error', {
          error: error instanceof Error ? error.message : String(error),
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'SYSTEM_ERROR',
              message: 'Failed to validate license',
            },
          },
          500
        )
      }
    }
  }

  /**
   * Invalidate cache for license
   */
  invalidateCache(license_id: number): void {
    this.license_cache.delete(license_id)
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.license_cache.clear()
  }
}

export default LicenseValidationMiddleware
