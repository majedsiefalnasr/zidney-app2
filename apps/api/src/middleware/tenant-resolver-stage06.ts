/**
 * Tenant Resolver Middleware — STAGE_06 Attempt Engine
 *
 * Purpose: Extract workspace slug from request, resolve tenant database
 * Middleware Priority: FIRST workspace middleware (after correlationId)
 *
 * Task: T013 – Tenant resolver middleware (provides req.tenantContext)
 * Phase: B – Middleware Integration
 * Stage: STAGE_06_ATTEMPT_ENGINE_FOUNDATION
 *
 * Constitutional Compliance:
 * - ADR-0001: Database-per-tenant (each workspace has isolated DB)
 * - Attachment: req.tenant {id, slug, schema_version, pool}
 * - All downstream queries use tenant context
 *
 * Flow:
 * 1. Extract workspace slug from request (subdomain or path param)
 * 2. Query master registry for workspace
 * 3. Obtain connection pool from pool manager
 * 4. Attach to context for downstream use
 * 5. If any step fails: return error (400, 404, 503)
 */

import type { Logger } from '@zidney/logger'
import type { Context, MiddlewareHandler } from 'hono'

export interface TenantContextStage06 {
  id: string
  slug: string
  database_name: string
  schema_version: number
  license_id: string
  organization_id: string
  pool: unknown // Database pool (actual type depends on DB driver)
}

interface RegistryEntryStage06 {
  id: string
  workspace_slug: string
  database_name: string
  schema_version: number
  license_id: string
  organization_id: string
}

/**
 * Create tenant resolver middleware for STAGE_06
 *
 * Usage:
 * ```
 * app.use(
 *   '/api/workspaces/*',
 *   createTenantResolverStage06(logger, poolManager)
 * )
 * ```
 *
 * Dependencies:
 * - logger: Logger instance
 * - poolManager: Tenant pool manager (getTenantDatabase, etc.)
 * - masterDb: Master DB connection (for tenant registry query)  [attached by setup]
 */
export function createTenantResolverStage06(
  logger: Logger,
  poolManager?: { getTenantPool?: (workspaceId: string) => Promise<unknown> }
): MiddlewareHandler {
  return async (c: Context, next) => {
    const correlation_id = c.get('correlationId') || 'unknown'

    try {
      // Extract workspace slug from request
      const slug = extractSlugFromRequest(c)

      if (!slug) {
        logger.warn('Tenant resolver: Missing workspace slug', {
          correlation_id,
          path: c.req.path,
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Missing or invalid workspace slug in request',
            },
          },
          400
        )
      }

      // Query master database for tenant registry entry
      // Assumption: c.get('masterDb') is available (set during app setup)
      const masterDb = c.get('masterDb')
      if (!masterDb) {
        logger.error('Tenant resolver: Master DB not configured', {
          correlation_id,
          slug,
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'DATABASE_UNAVAILABLE',
              message: 'Tenant resolution service temporarily unavailable',
            },
          },
          503
        )
      }

      // Query master registry
      let registry_entry: RegistryEntryStage06 | null = null
      try {
        const result = await masterDb.query(
          `
          SELECT
            id,
            workspace_slug,
            database_name,
            schema_version,
            license_id,
            organization_id,
            is_active,
            archived_at
          FROM workspaces
          WHERE workspace_slug = $1 AND is_active = true
          LIMIT 1
          `,
          [slug]
        )

        if (result.rows.length === 0) {
          logger.warn('Tenant resolver: Workspace not found or archived', {
            correlation_id,
            slug,
          })
          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: 'WORKSPACE_NOT_FOUND',
                message: 'Workspace not found or has been archived',
              },
            },
            404
          )
        }

        registry_entry = result.rows[0]
      } catch (db_error) {
        logger.error('Tenant resolver: Master DB query failed', {
          correlation_id,
          slug,
          error: db_error instanceof Error ? db_error.message : String(db_error),
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'DATABASE_ERROR',
              message: 'Failed to resolve workspace',
            },
          },
          503
        )
      }

      // Get or create tenant database connection pool
      let pool: unknown = null
      try {
        if (poolManager) {
          // Use pool manager to get/create pool
          pool = await poolManager.getTenantPool?.(registry_entry.id)
        } else {
          // Fallback: try to get pool from cache (advanced usage)
          pool = c.get('poolCache')?.get(registry_entry.id)
        }

        if (!pool) {
          logger.error('Tenant resolver: Failed to obtain database pool', {
            correlation_id,
            slug,
            workspace_id: registry_entry.id,
          })
          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: 'DATABASE_UNAVAILABLE',
                message: 'Workspace database connection unavailable',
              },
            },
            503
          )
        }
      } catch (pool_error) {
        logger.error('Tenant resolver: Pool manager error', {
          correlation_id,
          slug,
          error: pool_error instanceof Error ? pool_error.message : String(pool_error),
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'DATABASE_UNAVAILABLE',
              message: 'Failed to establish database connection',
            },
          },
          503
        )
      }

      // Attach tenant context to request
      const tenant_context: TenantContextStage06 = {
        id: registry_entry.id,
        slug: registry_entry.workspace_slug,
        database_name: registry_entry.database_name,
        schema_version: registry_entry.schema_version,
        license_id: registry_entry.license_id,
        organization_id: registry_entry.organization_id,
        pool,
      }

      c.set('tenant', tenant_context)
      c.set('tenantDb', pool) // Also attach pool directly for convenience

      logger.debug('Tenant resolved successfully', {
        correlation_id,
        slug,
        workspace_id: registry_entry.id,
        schema_version: registry_entry.schema_version,
      })

      await next()
    } catch (error) {
      logger.error('Tenant resolver: Unexpected error', {
        correlation_id,
        error: error instanceof Error ? error.message : String(error),
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to resolve tenant',
          },
        },
        500
      )
    }
  }
}

/**
 * Extract workspace slug from request
 *
 * Priority order:
 * 1. URL path parameter: /api/workspaces/:slug/*
 * 2. Subdomain: acme-university.zidney.app → acme-university
 * 3. Query parameter: ?workspace=acme-university [lowest priority, security concern]
 */
function extractSlugFromRequest(c: Context): string | null {
  // 1. Try path parameter (if using /api/workspaces/:slug/*)
  const slug_param = c.req.param('slug')
  if (slug_param && isValidSlug(slug_param)) {
    return slug_param
  }

  // 2. Try subdomain extraction
  const host = c.req.header('host') || ''
  if (host && !host.includes('localhost')) {
    // Extract subdomain (first part before first dot)
    const parts = host.split('.')
    if (parts.length >= 3) {
      const subdomain = parts[0]
      if (subdomain && isValidSlug(subdomain)) {
        return subdomain
      }
    }
  }

  // 3. Try query parameter (less secure, use as fallback)
  const query_slug = c.req.query('workspace')
  if (query_slug && isValidSlug(query_slug)) {
    return query_slug
  }

  return null
}

/**
 * Validate workspace slug format
 * Allowed: lowercase alphanumeric + hyphens, 1-63 chars
 */
function isValidSlug(slug: string): boolean {
  if (!slug || slug.length === 0 || slug.length > 63) {
    return false
  }
  return /^[a-z0-9-]+$/.test(slug)
}

export default createTenantResolverStage06
