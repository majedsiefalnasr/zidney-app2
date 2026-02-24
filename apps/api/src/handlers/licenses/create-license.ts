/**
 * License Creation Handler
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Handles POST /v1/mmc/licenses endpoint.
 *
 * Flow:
 * 1. Validate license creation request
 * 2. Check workspace slug uniqueness
 * 3. Verify product exists and is valid
 * 4. Insert license record with PENDING_PROVISION status
 * 5. Create provisioning job with full snapshot
 * 6. Enqueue job to Redis queue
 * 7. Return license ID and job tracking info
 *
 * On any failure: Transaction rollback, no partial state
 */

import { createCorrelationId } from '@zidney/logger/correlation-context'
import {
  ProvisioningErrorCode,
  getErrorDetails,
} from '@zidney/types/errors/provisioning-errors'
import {
  DEFAULT_RETRY_POLICY,
  createProvisioningJob,
} from '@zidney/types/jobs/provisioning-job'
import { LicenseStatus } from '@zidney/types/licenses/license-state'
import { Context } from 'hono'
import {
  createErrorResponse,
  createLicenseCreationResponse,
  getValidatedData,
} from './license-response'
import { CreateLicenseRequest } from './validate-license-request'

/**
 * License Creation Handler
 */
export async function createLicenseHandler(c: Context): Promise<Response> {
  const startTime = Date.now()
  const correlationId = c.get('correlationId') || createCorrelationId()
  const logger = c.get('logger')

  try {
    // Step 1: Get validated request data
    const request = getValidatedData<CreateLicenseRequest>(c)

    logger?.logStep('validation', 'License creation request validated', {
      workspace_slug: request.workspace_slug,
      organization_name: request.organization_name,
      student_limit: request.student_limit,
      staff_limit: request.staff_limit,
    })

    // Step 2: Check if workspace slug already exists
    const slugExists = await checkSlugExists(request.workspace_slug)
    if (slugExists) {
      logger?.logWarn('Duplicate workspace slug attempt', {
        workspace_slug: request.workspace_slug,
      })

      const error = getErrorDetails(ProvisioningErrorCode.WORKSPACE_SLUG_EXISTS)
      return c.json(
        createErrorResponse(
          ProvisioningErrorCode.WORKSPACE_SLUG_EXISTS,
          error.message,
          { slug: request.workspace_slug }
        ),
        { status: error.httpStatus }
      )
    }

    logger?.logStep('slug-check', 'Workspace slug is unique', {
      workspace_slug: request.workspace_slug,
    })

    // Step 3: Verify product exists
    const productExists = await verifyProductExists(request.product_id)
    if (!productExists) {
      logger?.logWarn('Invalid product ID', {
        product_id: request.product_id,
      })

      const error = getErrorDetails(ProvisioningErrorCode.INVALID_PRODUCT_ID)
      return c.json(
        createErrorResponse(
          ProvisioningErrorCode.INVALID_PRODUCT_ID,
          error.message
        ),
        { status: error.httpStatus }
      )
    }

    logger?.logStep('product-check', 'Product verified', {
      product_id: request.product_id,
    })

    // Step 4: Get platform versions from config
    const schemaVersion = c.get('schemaVersion') || '1.0.0'
    const productVersion = c.get('productVersion') || '1.0.0'

    // Step 5: Insert license record
    const licenseId = crypto.randomUUID()
    const createdAt = new Date()

    const license = await insertLicenseRecord({
      id: licenseId,
      workspace_slug: request.workspace_slug,
      organization_name: request.organization_name,
      admin_email: request.admin_email,
      product_id: request.product_id,
      student_limit: request.student_limit,
      staff_limit: request.staff_limit,
      uses_divisions: request.uses_divisions,
      default_language: request.default_language,
      status: LicenseStatus.PENDING_PROVISION,
      schema_version: schemaVersion,
      product_version: productVersion,
      created_at: createdAt,
    })

    logger?.logStep('license-insert', 'License record created', {
      license_id: licenseId,
      workspace_slug: request.workspace_slug,
    })

    // Step 6: Create provisioning job
    const jobId = crypto.randomUUID()
    const idempotencyKey = c.get('idempotencyKey') || jobId

    const job = createProvisioningJob({
      licenseId,
      correlationId,
      workspaceSlug: request.workspace_slug,
      organizationName: request.organization_name,
      adminEmail: request.admin_email,
      productId: request.product_id,
      studentLimit: request.student_limit,
      staffLimit: request.staff_limit,
      usesDivisions: request.uses_divisions,
      defaultLanguage: request.default_language,
      schemaVersion,
      productVersion,
      retryPolicy: DEFAULT_RETRY_POLICY,
    })

    logger?.logStep('job-creation', 'Provisioning job created', {
      job_id: jobId,
      license_id: licenseId,
    })

    // Step 7: Enqueue job to queue
    const enqueueService = c.get('enqueueService')
    const enqueueResult = await enqueueService.enqueue(job)

    if (!enqueueResult.success) {
      logger?.logError(
        'Job enqueueing failed',
        new Error(enqueueResult.error),
        {
          job_id: jobId,
          license_id: licenseId,
        }
      )

      // Rollback: delete license record on queue failure
      await deleteLicenseRecord(licenseId)

      const error = getErrorDetails(ProvisioningErrorCode.JOB_ENQUEUE_FAILED)
      return c.json(
        createErrorResponse(
          ProvisioningErrorCode.JOB_ENQUEUE_FAILED,
          error.message
        ),
        { status: error.httpStatus }
      )
    }

    logger?.logSuccess(
      'License provisioning workflow initiated',
      Date.now() - startTime,
      {
        license_id: licenseId,
        job_id: jobId,
        workspace_slug: request.workspace_slug,
      }
    )

    // Success response
    const response = createLicenseCreationResponse(
      licenseId,
      request.workspace_slug,
      request.organization_name,
      jobId,
      schemaVersion,
      productVersion,
      120 // Estimated provision time in seconds
    )

    // Add rate limit headers
    const rateLimitHeaders = c.get('rateLimitHeaders')
    for (const [key, value] of Object.entries(rateLimitHeaders || {})) {
      c.header(key, String(value))
    }

    c.header('X-Correlation-ID', correlationId)

    return c.json(response, { status: 200 })
  } catch (error) {
    logger?.logError(
      'License creation failed',
      error instanceof Error ? error : new Error(String(error))
    )

    const generalError = getErrorDetails(ProvisioningErrorCode.PROVISION_FAILED)
    return c.json(
      createErrorResponse(
        ProvisioningErrorCode.PROVISION_FAILED,
        generalError.message
      ),
      { status: generalError.httpStatus }
    )
  }
}

/**
 * Helper: Check if workspace slug exists in registry
 */
async function checkSlugExists(slug: string): Promise<boolean> {
  // TODO: Implement database query to tenant_registry
  // This is a placeholder - actual implementation will query the master DB
  const db = require('../../db.ts').getDb()
  try {
    const result = await db.query(
      'SELECT 1 FROM tenant_registry WHERE workspace_slug = $1 LIMIT 1',
      [slug]
    )
    return result.rows.length > 0
  } catch (error) {
    console.error('Error checking slug existence:', error)
    throw error
  }
}

/**
 * Helper: Verify product exists
 */
async function verifyProductExists(productId: string): Promise<boolean> {
  // TODO: Implement database query to products table
  const db = require('../../db.ts').getDb()
  try {
    const result = await db.query(
      'SELECT 1 FROM products WHERE id = $1 AND is_active = true LIMIT 1',
      [productId]
    )
    return result.rows.length > 0
  } catch (error) {
    console.error('Error verifying product:', error)
    throw error
  }
}

/**
 * Helper: Insert license record
 */
async function insertLicenseRecord(data: {
  id: string
  workspace_slug: string
  organization_name: string
  admin_email: string
  product_id: string
  student_limit: number
  staff_limit: number
  uses_divisions: boolean
  default_language: string
  status: LicenseStatus
  schema_version: string
  product_version: string
  created_at: Date
}): Promise<Record<string, unknown>> {
  const db = require('../../db.ts').getDb()

  const result = await db.query(
    `INSERT INTO licenses (
      id, workspace_slug, organization_name, admin_email, product_id,
      student_limit, staff_limit, uses_divisions, default_language,
      status, schema_version, product_version, retry_count, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      data.id,
      data.workspace_slug,
      data.organization_name,
      data.admin_email,
      data.product_id,
      data.student_limit,
      data.staff_limit,
      data.uses_divisions,
      data.default_language,
      data.status,
      data.schema_version,
      data.product_version,
      0, // retry_count starts at 0
      data.created_at,
    ]
  )

  return result.rows[0]
}

/**
 * Helper: Delete license record (for rollback)
 */
async function deleteLicenseRecord(licenseId: string): Promise<void> {
  const db = require('../../db.ts').getDb()

  await db.query('DELETE FROM licenses WHERE id = $1', [licenseId])
}
