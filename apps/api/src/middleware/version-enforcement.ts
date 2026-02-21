import { VersionValidator } from '@zidney/domain-core/license'
import { createLogger } from '@zidney/logging'
import type { Context, Next } from 'hono'
import { toLicenseError } from '../responses/license-error-handler'

const logger = createLogger('version-enforcement')

/**
 * Version Enforcement Middleware (T026, T027)
 *
 * Task: T026 – Add Version Checking to Middleware
 * Task: T027 – Create Version Mismatch Error Cases
 *
 * Validates schema and product version compatibility.
 * Returns 426 (Upgrade Required) if versions don't match.
 *
 * Executes AFTER license status check but BEFORE handler.
 */
export async function versionEnforcementMiddleware(ctx: Context, next: Next) {
  const correlationId = ctx.get('correlation_id') || 'unknown'
  const license = ctx.get('license')
  const tenantDb = ctx.get('tenant_db')

  try {
    // Skip if no license (non-tenant route)
    if (!license) {
      return await next()
    }

    const runtimeVersion = ctx.get('runtime_version') || '1.0.0'
    const validator = new VersionValidator()

    // ===========================================================================
    // STEP 1: Validate schema version (forward-compatible: tenant ≥ license)
    // ===========================================================================
    if (tenantDb) {
      try {
        const tenantResult = await tenantDb.query(
          'SELECT current_schema_version FROM schema_versions ORDER BY created_at DESC LIMIT 1'
        )

        if (tenantResult.rows.length) {
          const tenantSchemaVersion =
            tenantResult.rows[0].current_schema_version
          const schemaValid = validator.validateSchemaVersion(
            tenantSchemaVersion,
            license.expected_schema_version
          )

          // tenantSchemaVersion must be >= expected_schema_version
          if (!schemaValid) {
            logger.warn('Schema version mismatch', {
              correlation_id: correlationId,
              action: 'version_check',
              type: 'schema',
              tenant_version: tenantSchemaVersion,
              expected_version: license.expected_schema_version,
              result: 'fail',
              error_code: 'SCHEMA_VERSION_MISMATCH',
            })

            return ctx.json(toLicenseError('SCHEMA_VERSION_MISMATCH'), {
              status: 426,
            })
          }

          logger.debug('Schema version compatible', {
            correlation_id: correlationId,
            action: 'version_check',
            type: 'schema',
            tenant_version: tenantSchemaVersion,
            expected_version: license.expected_schema_version,
            result: 'pass',
          })
        }
      } catch (error: any) {
        logger.warn('Schema version check failed (non-blocking)', {
          correlation_id: correlationId,
          action: 'version_check_schema_error',
          error_message: error.message,
        })
        // Continue; schema version check is informational
      }
    }

    // ===========================================================================
    // STEP 2: Validate product version (MAJOR version must match per ADR-0008)
    // ===========================================================================
    const productValid = validator.validateProductVersion(
      license.expected_product_version,
      runtimeVersion
    )

    // MAJOR version must match
    if (!productValid) {
      logger.warn('Product version mismatch', {
        correlation_id: correlationId,
        action: 'version_check',
        type: 'product',
        runtime_version: runtimeVersion,
        license_version: license.expected_product_version,
        result: 'fail',
        error_code: 'UPGRADE_REQUIRED',
      })

      return ctx.json(toLicenseError('UPGRADE_REQUIRED'), { status: 426 })
    }

    logger.debug('Product version compatible', {
      correlation_id: correlationId,
      action: 'version_check',
      type: 'product',
      runtime_version: runtimeVersion,
      license_version: license.expected_product_version,
      result: 'pass',
    })

    // ===========================================================================
    // STEP 3: Proceed to next middleware
    // ===========================================================================
    return await next()
  } catch (error: any) {
    logger.error('Version enforcement middleware error', {
      correlation_id: correlationId,
      action: 'version_enforcement_error',
      error_message: error.message,
    })

    return ctx.json(toLicenseError('INTERNAL_ERROR'), { status: 500 })
  }
}

export default versionEnforcementMiddleware
