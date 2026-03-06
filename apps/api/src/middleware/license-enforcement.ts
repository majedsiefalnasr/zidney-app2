/**
 * License Enforcement Middleware
 *
 * File: apps/api/src/middleware/license-enforcement.ts
 * Task: T008 – Create License Middleware
 *
 * Executes on every workspace-bound request.
 * 3rd in middleware stack (after correlation-id, tenant-resolver; before schema-version).
 *
 * Validates:
 * 1. License exists and status is valid
 * 2. Soft-lock hasn't expired (auto-transition if needed)
 * 3. Schema version compatibility (forward-compatible)
 * 4. Product version compatibility
 *
 * Returns:
 * - 200: License valid, proceed to handler
 * - 423: License SOFT_LOCKED (not expired)
 * - 403: License ARCHIVED or SOFT_LOCKED_EXPIRED
 * - 404: License not found or DELETED
 * - 426: Version mismatch (schema or product)
 */

import { LicenseStatus } from '@zidney/domain-core/license'
import { createLogger } from '@zidney/logger'
import type { Context, Next } from 'hono'

const logger = createLogger('license-engine')

// Would import from actual implementations:
// import { toLicenseError } from '@/responses/license-error-handler'
// import { logger } from '@/logging'

/**
 * License Enforcement Middleware
 *
 * @param ctx - Hono context
 * @param next - Next middleware
 */
export async function licenseEnforcementMiddleware(ctx: Context, next: Next) {
  try {
    // Extract workspace slug from context (set by tenant resolver)
    const workspace_slug = (ctx.req.param('workspace_slug') || ctx.get('workspace_slug')) as string
    const correlation_id = ctx.get('correlation_id') || 'unknown'

    if (!workspace_slug) {
      // If no workspace_slug, skip license check (non-tenant route)
      return await next()
    }

    // Get dependencies (would be injected in real implementation)
    // const resolver = ctx.app.get('licenseResolver') as InstanceType<typeof LicenseResolver>
    // const validator = ctx.app.get('versionValidator') as InstanceType<typeof VersionValidator>
    const resolver = ctx.get('licenseResolver') // From app context
    const versionValidator = ctx.get('versionValidator')

    // ===========================================================================
    // STEP 1: Validate license status
    // ===========================================================================
    const validationResult = await resolver.validateLicenseStatus(workspace_slug)

    if (!validationResult.valid && validationResult.status !== LicenseStatus.ACTIVE) {
      // Log: License invalid
      const log = {
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'license-engine',
        correlation_id,
        workspace_slug,
        action: 'middleware_check',
        status: validationResult.status,
        error_code: validationResult.error_code,
        result: 'fail',
      }

      logger.warn('License validation failed', log)

      // Return error response (would use toLicenseError helper)
      const httpStatus = validationResult.http_status || 403
      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: validationResult.error_code,
            message: validationResult.error_message,
            correlationId: correlation_id,
          },
        },
        { status: httpStatus }
      )
    }

    // ===========================================================================
    // STEP 2: Check for soft-lock expiry and auto-transition
    // ===========================================================================
    const license = await resolver.getLicenseBySlug(workspace_slug)
    const transitionService =
      ctx.get('transitionLicenseState') ||
      (await import('@zidney/domain-core/license').then((m) => m.transitionLicenseState))

    if (
      license &&
      license.status === LicenseStatus.SOFT_LOCKED &&
      license.soft_lock_until &&
      new Date() > license.soft_lock_until
    ) {
      // Soft-lock has expired: auto-transition to ARCHIVED (Clarification Q4: Every request)
      // Execute transition atomically with SELECT FOR UPDATE
      const masterDb = ctx.get('master_db')
      try {
        const result = await transitionService(masterDb, {
          license_id: license.id,
          target_state: 'ARCHIVED',
          reason: 'soft_lock_expired_auto_transition',
        })

        const log = {
          timestamp: new Date().toISOString(),
          level: 'warn',
          service: 'license-engine',
          correlation_id,
          workspace_slug,
          action: 'soft_lock_expiry',
          old_status: LicenseStatus.SOFT_LOCKED,
          new_status: LicenseStatus.ARCHIVED,
          result: 'success',
          transition_result: result.success ? 'executed' : 'failed',
        }
        logger.warn('License soft-lock auto-transitioned to ARCHIVED', log)
      } catch (transitionError) {
        const log = {
          timestamp: new Date().toISOString(),
          level: 'error',
          service: 'license-engine',
          correlation_id,
          workspace_slug,
          action: 'soft_lock_expiry_transition_error',
          error_message:
            transitionError instanceof Error ? transitionError.message : String(transitionError),
        }
        logger.error('License soft-lock auto-transition failed', log)
        // Continue to return 403 anyway (license is expired)
      }

      // Return 403 (Forbidden) - soft-lock is active/expired
      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'LICENSE_SOFT_LOCKED_EXPIRED',
            message: 'Workspace soft-lock grace period has expired',
            correlationId: correlation_id,
          },
        },
        { status: 403 }
      )
    }

    // ===========================================================================
    // STEP 3: Validate schema version (forward-compatible)
    // ===========================================================================
    const tenant_schema_version = (ctx.get('tenant_schema_version') || '1.0.0') as string

    const schemaValid = await resolver.validateVersions(workspace_slug, tenant_schema_version)
    if (!schemaValid) {
      const log = {
        timestamp: new Date().toISOString(),
        level: 'error',
        service: 'license-engine',
        correlation_id,
        workspace_slug,
        action: 'version_check',
        type: 'schema',
        tenant_version: tenant_schema_version,
        expected_version: license?.expected_schema_version,
        result: 'fail',
        error_code: 'SCHEMA_VERSION_MISMATCH',
      }
      logger.error('Schema version incompatible', log)

      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'SCHEMA_VERSION_MISMATCH',
            message: 'Workspace requires schema upgrade',
            correlationId: correlation_id,
          },
        },
        { status: 426 }
      )
    }

    // ===========================================================================
    // STEP 4: Validate product version (ADR-0008)
    // ===========================================================================
    if (license && versionValidator) {
      const runtime_version = (ctx.get('runtime_version') || '1.0.0') as string
      const productValid = versionValidator.validateProductVersion(
        license.expected_product_version,
        runtime_version
      )

      if (!productValid) {
        const log = {
          timestamp: new Date().toISOString(),
          level: 'error',
          service: 'license-engine',
          correlation_id,
          workspace_slug,
          action: 'version_check',
          type: 'product',
          license_version: license.expected_product_version,
          runtime_version,
          result: 'fail',
          error_code: 'UPGRADE_REQUIRED',
        }
        logger.error('Product version incompatible', log)

        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'UPGRADE_REQUIRED',
              message: 'Workspace license requires product upgrade',
              correlationId: correlation_id,
            },
          },
          { status: 426 }
        )
      }
    }

    // ===========================================================================
    // STEP 5: Attach license context and proceed
    // ===========================================================================
    if (license) {
      ctx.set('license_id', license.id)
      ctx.set('license_status', license.status)
      ctx.set('student_limit', String(license.student_limit ?? 'unlimited'))
      ctx.set('staff_limit', String(license.staff_limit ?? 'unlimited'))
      // BLOCK-2 FIX: Inject enabled_modules and product_version for BackofficeContext
      ctx.set('enabled_modules', license.enabled_modules ?? [])
      ctx.set('product_version', license.expected_product_version ?? '1.0.0')
    }

    // Log: Middleware check passed
    logger.info('License middleware check passed', {
      correlation_id,
      workspace_slug,
      action: 'middleware_check',
      status: license?.status ?? 'UNKNOWN',
      result: 'pass',
    })

    return await next()
  } catch (error) {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'license-engine',
      correlation_id: ctx.get('correlation_id') || 'unknown',
      action: 'middleware_check',
      result: 'error',
      error_message: error instanceof Error ? error.message : String(error),
    }
    logger.error('License middleware check failed with unhandled error', log)

    return ctx.json(
      {
        success: false,
        data: null,
        error: {
          code: 'LICENSE_CHECK_FAILED',
          message: 'License validation failed',
          correlationId: ctx.get('correlationId') ?? ctx.get('correlation_id') ?? 'unknown',
        },
      },
      { status: 500 }
    )
  }
}

export default licenseEnforcementMiddleware
