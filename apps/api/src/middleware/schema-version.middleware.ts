/**
 * Schema Version Compatibility Check Middleware (T007A)
 *
 * Purpose: Validate that master_db schema version is compatible with API version
 * - Returns 426 if schema version incompatible
 * - Executes AFTER license middleware, BEFORE permission check
 * - Blocks all requests to incompatible schema versions
 *
 * File: apps/api/src/middleware/schema-version.middleware.ts
 * Task: T007A
 * Phase: 1 - Backend Implementation (CRITICAL)
 *
 * Middleware Chain Position:
 * 1. Correlation ID
 * 2. Tenant Resolver
 * 3. License Enforcement (T006)
 * 4. **→ Schema Version Check** (THIS FILE - T007A)
 * 5. Permission Check (T007)
 * 6. Rate Limiting (T007B)
 * 7. Cache Middleware
 * 8. Route Handler
 *
 * Constitutional Compliance:
 * ✓ Schema version compatibility check (mandatory per ADR-0008)
 * ✓ Returns exactly 426 Upgrade Required if incompatible
 * ✓ Prevents access to incompatible schema states
 * ✓ Structured logging with correlation_id
 * ✓ Master DB only (no tenant database queries)
 *
 * Constraint Verification:
 * ✓ Schema Version Check: T023 explicitly requires 426 on mismatch
 * ✓ Executes before route handlers (early validation)
 * ✓ Blocks incompatible states before any data access
 *
 * API Compatibility Matrix:
 * - API requires schema >= 1.2.0 (dashboard indexes present)
 * - Schema < 1.1.0: Cannot support rate limiting, licensing
 * - Schema < 1.2.0: Cannot support dashboard (missing indexes)
 *
 * Error Code: 426 Upgrade Required
 */

import type { Logger } from '@zidney/logger'
import type { Context, Next } from 'hono'
import type { Pool } from 'pg'

/**
 * Current API version - must match schema_versions.version
 * Increment this when breaking schema changes are made
 *
 * Version History:
 * - 1.1.0: Rate limiting + licensing baseline
 * - 1.2.0: Dashboard indexes for analytics (THIS VERSION)
 */
export const API_SCHEMA_VERSION = '1.2.0'

/**
 * Minimum compatible schema version for dashboard endpoints
 */
export const MIN_SCHEMA_VERSION = '1.2.0'

export interface SchemaVersionContext {
  schema_version: string
  is_compatible: boolean
}

/**
 * Schema Version Check Middleware Factory
 *
 * Usage:
 * ```typescript
 * const schemaVersionMiddleware = createSchemaVersionMiddleware(pool, logger)
 * app.use('*', schemaVersionMiddleware)  // After license middleware
 * ```
 */
export function createSchemaVersionMiddleware(
  pool: Pool,
  logger: Logger,
  minRequiredVersion: string = MIN_SCHEMA_VERSION
) {
  // Cache the schema version check (valid for 5 minutes)
  let cachedVersion: string | null = null
  let cacheExpiry: number = 0
  const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

  return async (c: Context, next: Next) => {
    const correlationId = c.get('correlation_id')
    const workspaceSlug = c.get('workspace_slug')

    // Skip version check for non-workspace routes
    if (!workspaceSlug || !workspaceSlug.startsWith('mmc-')) {
      return await next()
    }

    const startTime = Date.now()

    try {
      // Check cache first
      let schemaVersion = cachedVersion
      let fromCache = false

      if (!schemaVersion || Date.now() > cacheExpiry) {
        // Query master_db for schema version
        const versionResult = await pool.query(
          `SELECT version FROM schema_versions 
           ORDER BY applied_at DESC LIMIT 1`
        )

        if (versionResult.rows.length === 0) {
          // No schema version found - likely pre-bootstrap
          schemaVersion = '1.0.0'
        } else {
          schemaVersion = versionResult.rows[0].version
        }

        // Update cache
        cachedVersion = schemaVersion
        cacheExpiry = Date.now() + CACHE_TTL_MS
      } else {
        fromCache = true
      }

      const elapsedMs = Date.now() - startTime

      // Compare versions
      const resolvedSchemaVersion = schemaVersion ?? '0.0.0'
      const isCompatible = compareVersions(resolvedSchemaVersion, minRequiredVersion) >= 0

      logger.debug('Schema version check', {
        correlation_id: correlationId,
        workspace_slug: workspaceSlug,
        schema_version: resolvedSchemaVersion,
        required_version: minRequiredVersion,
        is_compatible: isCompatible,
        from_cache: fromCache,
        query_time_ms: elapsedMs,
      })

      // Version incompatible - return 426 Upgrade Required
      if (!isCompatible) {
        logger.warn('Schema version incompatible - access denied', {
          correlation_id: correlationId,
          workspace_slug: workspaceSlug,
          current_version: schemaVersion,
          required_version: minRequiredVersion,
          error_code: 'SCHEMA_INCOMPATIBLE',
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'SCHEMA_INCOMPATIBLE',
              message: `Schema version upgrade required. Current: ${resolvedSchemaVersion}, Required: >= ${minRequiredVersion}`,
              details: {
                current_schema_version: resolvedSchemaVersion,
                required_schema_version: minRequiredVersion,
                upgrade_required: true,
              },
            },
          },
          {
            status: 426,
            headers: {
              Upgrade: `schema/${minRequiredVersion}`,
              'Retry-After': '3600', // Retry after 1 hour (when upgrade likely complete)
            },
          }
        )
      }

      // Version compatible - attach to context and proceed
      c.set('schema_version', resolvedSchemaVersion)
      c.set('schema_version_context', {
        schema_version: resolvedSchemaVersion,
        is_compatible: true,
      } as SchemaVersionContext)

      await next()
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'

      logger.error('Schema version check error', {
        correlation_id: correlationId,
        workspace_slug: workspaceSlug,
        error_code: 'VERSION_CHECK_FAILED',
        error_message: errorMsg,
      })

      // On error, fail safely (don't allow unless we're sure it's compatible)
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VERSION_CHECK_FAILED',
            message: 'Failed to verify schema version compatibility',
          },
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Compare semantic versions
 *
 * Returns:
 * -  1 if version1 > version2
 * -  0 if equal
 * - -1 if version1 < version2
 *
 * Handles:
 * - Semantic versioning (1.2.3)
 * - Pre-release (1.2.3-alpha)
 * - Build metadata (1.2.3+build)
 */
export function compareVersions(version1: string, version2: string): number {
  // Extract base version (remove pre-release and build metadata)
  const v1Parts = version1.split('-')[0]?.split('+')[0]?.split('.').map(Number)
  const v2Parts = version2.split('-')[0]?.split('+')[0]?.split('.').map(Number)

  // Pad shorter version with zeros
  const maxLength = Math.max(v1Parts.length, v2Parts.length)
  while (v1Parts.length < maxLength) v1Parts.push(0)
  while (v2Parts.length < maxLength) v2Parts.push(0)

  // Compare each part
  for (let i = 0; i < maxLength; i++) {
    const part1 = v1Parts[i] ?? 0
    const part2 = v2Parts[i] ?? 0
    if (part1 > part2) return 1
    if (part1 < part2) return -1
  }

  // Same version
  return 0
}

/**
 * Validate schema version helper
 *
 * Can be used in tests or standalone schema checks
 */
export async function validateSchemaVersion(
  pool: Pool,
  requiredVersion: string = MIN_SCHEMA_VERSION,
  logger?: Logger
): Promise<{
  isValid: boolean
  currentVersion: string
  requiredVersion: string
  upgradeable: boolean
}> {
  try {
    const result = await pool.query(
      `SELECT version FROM schema_versions 
       ORDER BY applied_at DESC LIMIT 1`
    )

    const currentVersion = result.rows[0]?.version || '1.0.0'
    const isValid = compareVersions(currentVersion, requiredVersion) >= 0

    logger?.debug('Schema version validation', {
      current: currentVersion,
      required: requiredVersion,
      is_valid: isValid,
    })

    return {
      isValid,
      currentVersion,
      requiredVersion,
      upgradeable: !isValid, // If not valid, user needs to upgrade schema
    }
  } catch (error) {
    logger?.error('Schema version validation error', {
      error: error instanceof Error ? error.message : 'unknown',
    })

    return {
      isValid: false,
      currentVersion: 'unknown',
      requiredVersion,
      upgradeable: true,
    }
  }
}
