/**
 * Schema Version Validation Middleware
 *
 * Execution order: THIRD (after license middleware)
 *
 * Responsibility:
 * 1. Get tenant database connection from pool
 * 2. Query current schema version from tenant DB
 * 3. Get expected version from license product version compatibility
 * 4. Validate versions match:
 *    - 409 if actual > expected (tenant ahead of product)
 *    - 503 + enqueue migration if actual < expected
 *    - Proceed if actual == expected
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 */

import { createLogger } from '@zidney/logging'
import type { Context, MiddlewareHandler, Next } from 'hono'

const logger = createLogger('schema-version-middleware')

export interface SchemaVersionInfo {
  version: string
  applied_at: Date
  checksum: string
}

/**
 * Schema Version Validation Middleware
 *
 * @param ctx - Hono context (with tenant and license information)
 * @param next - Next middleware function
 */
export const schemaVersionMiddleware: MiddlewareHandler = async (
  ctx: Context,
  next: Next
) => {
  const correlationId = ctx.get('correlation_id')
  const tenant = ctx.get('tenant')
  const license = ctx.get('license')

  if (!tenant || !license) {
    logger.error(
      'Schema version middleware called without tenant/license context',
      { correlationId }
    )
    return ctx.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Missing tenant/license context',
        },
      },
      500
    )
  }

  try {
    // TODO: Get tenant database connection from pool
    // const pool = tenant.pool;

    // TODO: Query current schema version from tenant DB
    // SELECT version, applied_at, checksum FROM schema_version LIMIT 1
    const currentVersion = await getCurrentSchemaVersion(tenant) // Implementation stub

    const expectedVersion = license.product_version_compatibility

    if (!currentVersion) {
      // Schema not initialized - return 503 and enqueue initialization
      logger.info('Schema not initialized for workspace', {
        workspace_id: tenant.workspace_id,
        correlationId,
      })

      // TODO: Enqueue INIT_TENANT_SCHEMA task
      // await enqueueSchemaInitTask(tenant.workspace_id);

      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'SCHEMA_NOT_INITIALIZED',
            message: 'Workspace schema initialization in progress',
          },
        },
        503 // HTTP 503 Service Unavailable
      )
    }

    // Parse versions for comparison
    const [currentMajor, currentMinor, currentPatch] = parseVersion(
      currentVersion.version
    )
    const [expectedMajor, expectedMinor, expectedPatch] =
      parseVersion(expectedVersion)

    // Tenant ahead of product (should not happen in normal flow)
    if (
      currentMajor > expectedMajor ||
      (currentMajor === expectedMajor && currentMinor > expectedMinor) ||
      (currentMajor === expectedMajor &&
        currentMinor === expectedMinor &&
        currentPatch > expectedPatch)
    ) {
      logger.warn('Tenant schema version ahead of product', {
        workspace_id: tenant.workspace_id,
        current_version: currentVersion.version,
        expected_version: expectedVersion,
        correlationId,
      })

      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'SCHEMA_VERSION_CONFLICT',
            message: 'Workspace schema version is ahead of platform',
          },
        },
        409 // HTTP 409 Conflict
      )
    }

    // Tenant behind product version (migration needed)
    if (
      currentMajor < expectedMajor ||
      (currentMajor === expectedMajor && currentMinor < expectedMinor) ||
      (currentMajor === expectedMajor &&
        currentMinor === expectedMinor &&
        currentPatch < expectedPatch)
    ) {
      logger.info('Schema migration required for workspace', {
        workspace_id: tenant.workspace_id,
        current_version: currentVersion.version,
        expected_version: expectedVersion,
        correlationId,
      })

      // TODO: Enqueue APPLY_MIGRATION task
      // await enqueueMigrationTask(tenant.workspace_id, currentVersion.version, expectedVersion);

      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'SCHEMA_MIGRATION_REQUIRED',
            message: 'Workspace requires schema migration',
          },
        },
        503 // HTTP 503 Service Unavailable (temporary)
      )
    }

    // Versions match - proceed
    logger.debug('Schema version validated', {
      workspace_id: tenant.workspace_id,
      version: currentVersion.version,
      correlationId,
    })

    ctx.set('schema_version', currentVersion)

    await next()
  } catch (error) {
    logger.error('Schema version validation error', {
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    })

    return ctx.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      },
      500
    )
  }
}

/**
 * Get current schema version from tenant database (stub)
 * TODO: Implement actual DB query
 */
async function getCurrentSchemaVersion(
  _tenant: any
): Promise<SchemaVersionInfo | null> {
  // Stub implementation
  throw new Error('Not implemented')
}

/**
 * Parse version string to semver components
 */
function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.')
  return [
    parseInt(parts[0] || '0', 10),
    parseInt(parts[1] || '0', 10),
    parseInt(parts[2] || '0', 10),
  ]
}

export default schemaVersionMiddleware
