/**
 * License Status Handler
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Handles GET /v1/mmc/licenses/{license_id} endpoint.
 * Returns current provisioning status and metadata.
 *
 * Clients poll this endpoint to check provisioning progress:
 * - PENDING_PROVISION: Still provisioning, retry in 5s
 * - ACTIVE: Provisioning complete, workspace ready
 * - PROVISION_FAILED: Failed, check error message, operator intervention needed
 */

import { createCorrelationId } from '@zidney/logger/correlation-context'
import { getErrorDetails, ProvisioningErrorCode } from '@zidney/types/errors/provisioning-errors'
import { getLicenseHttpStatus, LicenseStatus } from '@zidney/types/licenses/license-state'
import type { Context } from 'hono'
import { createErrorResponse, createLicenseStatusResponse } from './license-response'

/**
 * License Status Handler
 */
export async function getLicenseStatusHandler(c: Context): Promise<Response> {
  const correlationId = c.get('correlationId') || createCorrelationId()
  const logger = c.get('logger')
  const licenseId = c.req.param('license_id')

  if (!licenseId) {
    const error = getErrorDetails(ProvisioningErrorCode.LICENSE_NOT_FOUND)
    c.status(error.httpStatus as any)
    return c.json(
      createErrorResponse(ProvisioningErrorCode.LICENSE_NOT_FOUND, 'License ID is required')
    )
  }

  try {
    logger?.logStep('status-query', 'Querying license status', {
      license_id: licenseId,
    })

    // Query license from database
    const license = await queryLicenseById(licenseId)

    if (!license) {
      logger?.logWarn('License not found', {
        license_id: licenseId,
      })

      const error = getErrorDetails(ProvisioningErrorCode.LICENSE_NOT_FOUND)
      c.status(error.httpStatus as any)
      return c.json(
        createErrorResponse(
          ProvisioningErrorCode.LICENSE_NOT_FOUND,
          `License ${licenseId} not found`
        )
      )
    }

    logger?.logStep('status-found', 'License status retrieved', {
      license_id: licenseId,
      status: license.status,
    })

    // Build response
    const licenseData = license as any
    const response = createLicenseStatusResponse(
      licenseData.id,
      licenseData.workspace_slug,
      licenseData.organization_name,
      licenseData.status as LicenseStatus,
      (licenseData.created_at as Date).toISOString(),
      licenseData.provisioned_at ? (licenseData.provisioned_at as Date).toISOString() : null,
      licenseData.failed_at ? (licenseData.failed_at as Date).toISOString() : null,
      licenseData.last_provision_error,
      licenseData.retry_count
    )

    // Set appropriate HTTP status based on license state
    const httpStatus = (getLicenseHttpStatus(licenseData.status as LicenseStatus) || 200) as any

    // Add headers
    c.header('X-Correlation-ID', correlationId)
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate')

    // Add retry guidance for polling
    if (licenseData.status === LicenseStatus.PENDING_PROVISION) {
      c.header('Retry-After', '5')
    } else if (licenseData.status === LicenseStatus.PROVISION_FAILED) {
      c.header('Retry-After', '30')
    }

    c.status(httpStatus)
    return c.json(response)
  } catch (error) {
    logger?.logError(
      'License status query failed',
      error instanceof Error ? error : new Error(String(error))
    )

    const generalError = getErrorDetails(ProvisioningErrorCode.PROVISION_FAILED)
    c.status(generalError.httpStatus as any)
    return c.json(
      createErrorResponse(
        ProvisioningErrorCode.PROVISION_FAILED,
        'Failed to retrieve license status'
      )
    )
  }
}

/**
 * Query license by ID from master database
 */
async function queryLicenseById(licenseId: string): Promise<Record<string, unknown> | null> {
  const db = require('../../db.ts').getDb()

  const result = await db.query(
    `SELECT 
      id, workspace_slug, organization_name, status,
      created_at, provisioned_at, failed_at, 
      last_provision_error, retry_count,
      schema_version, product_version
    FROM licenses
    WHERE id = $1`,
    [licenseId]
  )

  return result.rows[0] || null
}

/**
 * License Status Data Type
 */
export interface LicenseStatusData {
  id: string
  workspace_slug: string
  organization_name: string
  status: string
  created_at: Date
  provisioned_at: Date | null
  failed_at: Date | null
  last_provision_error: string | null
  retry_count: number
  schema_version: string
  product_version: string
}
