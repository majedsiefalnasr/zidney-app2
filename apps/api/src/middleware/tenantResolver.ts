/**
 * TenantResolver - Resolve tenant database from request context
 *
 * Purpose: Extract workspace slug and return connection pool for tenant database
 * Pattern: Middleware that runs FIRST on all workspace requests
 *
 * Task: T014 – Implement tenant resolver (connection pool lookup)
 * Phase: 01 – Platform Foundation
 * Stage: STAGE_05_TENANT_PROVISIONING_SERVICE
 */

import { createLogger } from '@zidney/logger'
import type { Context, MiddlewareHandler, Next } from 'hono'
import { Pool } from 'pg'

const logger = createLogger('tenant-resolver')

export interface TenantContext {
  slug: string
  database_name: string
  pool: Pool
  license_id: number
  organization_id: number
}

/**
 * TenantResolver: Responsible for resolving workspace slug and returning connection pool
 */
export class TenantResolver {
  private master_pool: Pool
  private pool_map: Map<string, Pool> = new Map()
  private registry_cache: Map<string, any> = new Map()
  private cache_ttl_ms: number = 5 * 60 * 1000 // 5 minutes

  constructor(master_pool: Pool) {
    this.master_pool = master_pool
  }

  /**
   * Extract workspace slug from request (subdomain or path)
   * Subdomain format: acme-university.zidney.app → acme-university
   * Path format: /workspace/acme-university/exams → acme-university
   */
  private extractSlug(c: Context): string | null {
    // Try subdomain extraction first
    const host = c.req.header('host')
    if (host && host !== 'localhost') {
      const parts = host.split('.')
      if (parts.length >= 3) {
        // Return first part as slug (e.g., acme-university.zidney.app → acme-university)
        return parts[0]
      }
    }

    // Try path extraction
    const path = c.req.path
    const path_match = path.match(/^\/workspace\/([a-z0-9-]+)/)
    if (path_match) {
      return path_match[1]
    }

    // Try URL parameter
    const workspaceSlug = c.req.param('workspace_slug')
    if (workspaceSlug) {
      return workspaceSlug
    }

    return null
  }

  /**
   * Query master database for tenant registry entry
   * Returns: { license_id, database_name, expected_schema_version, is_active }
   */
  private async getRegistryEntry(slug: string): Promise<any> {
    // Check cache first
    const cache_key = `registry:${slug}`
    const cached = this.registry_cache.get(cache_key)
    if (cached && Date.now() - cached.timestamp < this.cache_ttl_ms) {
      return cached.data
    }

    try {
      const client = await this.master_pool.connect()
      try {
        const result = await client.query(
          `
          SELECT id, license_id, workspace_slug, database_name, expected_schema_version, is_active, archived_at
          FROM tenants_registry
          WHERE workspace_slug = $1 AND is_active = true
          LIMIT 1
          `,
          [slug]
        )

        if (result.rows.length === 0) {
          return null
        }

        const entry = result.rows[0]

        // Cache result
        this.registry_cache.set(cache_key, {
          data: entry,
          timestamp: Date.now(),
        })

        return entry
      } finally {
        client.release()
      }
    } catch (error) {
      logger.error('Failed to query tenants_registry', {
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Get connection pool for tenant (from in-memory map)
   * Returns null if pool not yet registered
   */
  getPool(slug: string): Pool | null {
    return this.pool_map.get(slug) || null
  }

  /**
   * Register connection pool for tenant
   * Called after successful provisioning
   */
  registerPool(slug: string, pool: Pool): void {
    this.pool_map.set(slug, pool)
  }

  /**
   * Remove connection pool for tenant (on deletion/archival)
   */
  removePool(slug: string): void {
    this.pool_map.delete(slug)
  }

  /**
   * Middleware function for Hono
   * Attaches tenant context to request or returns error
   */
  middleware(): MiddlewareHandler {
    return async (c: Context, next: Next) => {
      try {
        // Extract slug
        const slug = this.extractSlug(c)
        if (!slug) {
          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: 'INVALID_REQUEST',
                message: 'Missing or invalid workspace slug',
              },
            },
            400
          )
        }

        // Query registry
        const registry_entry = await this.getRegistryEntry(slug)
        if (!registry_entry) {
          return c.json(
            {
              success: false,
              data: null,
              error: { code: 'WS_001', message: 'Workspace not found' },
            },
            404
          )
        }

        // Get connection pool
        const pool = this.getPool(slug)
        if (!pool) {
          // Pool not registered yet (provisioning in progress?)
          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: 'WS_002',
                message:
                  'Workspace is still provisioning, please try again later',
              },
            },
            503
          )
        }

        // Attach tenant context to request
        c.set('tenant', {
          slug,
          database_name: registry_entry.database_name,
          pool,
          license_id: registry_entry.license_id,
          organization_id: registry_entry.organization_id,
          schema_version: registry_entry.expected_schema_version,
        } as TenantContext)

        // Propagate or generate correlation ID
        c.set(
          'correlation_id',
          c.req.header('x-correlation-id') || crypto.randomUUID()
        )

        return next()
      } catch (error) {
        logger.error('TenantResolver error', {
          error: error instanceof Error ? error.message : String(error),
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'SYSTEM_ERROR',
              message: 'Failed to resolve tenant',
            },
          },
          500
        )
      }
    }
  }

  /**
   * Invalidate cache for slug
   */
  invalidateCache(slug: string): void {
    this.registry_cache.delete(`registry:${slug}`)
  }

  /**
   * Cleanup: Close all pools
   */
  async cleanup(): Promise<void> {
    for (const [slug, pool] of this.pool_map.entries()) {
      try {
        await pool.end()
      } catch (error) {
        logger.error('Failed to close pool', {
          slug,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    this.pool_map.clear()
  }
}

export default TenantResolver
