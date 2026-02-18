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

import { NextFunction, Request, Response } from 'express'
import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'

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
  private extractSlug(req: Request): string | null {
    // Try subdomain extraction first
    const host = req.hostname
    if (host && host !== 'localhost') {
      const parts = host.split('.')
      if (parts.length >= 3) {
        // Return first part as slug (e.g., acme-university.zidney.app → acme-university)
        return parts[0]
      }
    }

    // Try path extraction
    const path_match = req.path.match(/^\/workspace\/([a-z0-9-]+)/)
    if (path_match) {
      return path_match[1]
    }

    // Try URL parameter
    if (req.params.workspace_slug) {
      return req.params.workspace_slug
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
      console.error(`Failed to query tenants_registry:`, error)
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
   * Middleware function for Express
   * Attaches tenant context to request  or returns error
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Extract slug
        const slug = this.extractSlug(req)
        if (!slug) {
          return res.status(400).json({
            success: false,
            data: null,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Missing or invalid workspace slug',
            },
          })
        }

        // Query registry
        const registry_entry = await this.getRegistryEntry(slug)
        if (!registry_entry) {
          return res.status(404).json({
            success: false,
            data: null,
            error: { code: 'WS_001', message: 'Workspace not found' },
          })
        }

        // Get connection pool
        const pool = this.getPool(slug)
        if (!pool) {
          // Pool not registered yet (provisioning in progress?)
          return res.status(503).json({
            success: false,
            data: null,
            error: {
              code: 'WS_002',
              message:
                'Workspace is still provisioning, please try again later',
            },
          })
        }

        // Attach tenant context to request
        ;(req as any).tenant = {
          slug,
          database_name: registry_entry.database_name,
          pool,
          license_id: registry_entry.license_id,
          organization_id: registry_entry.organization_id,
          schema_version: registry_entry.expected_schema_version,
        } as TenantContext

        // Propagate or generate correlation ID
        ;(req as any).correlation_id =
          req.headers['x-correlation-id'] || uuidv4()

        next()
      } catch (error) {
        console.error(`TenantResolver error:`, error)
        return res.status(500).json({
          success: false,
          data: null,
          error: { code: 'SYSTEM_ERROR', message: 'Failed to resolve tenant' },
        })
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
        console.error(`Failed to close pool for ${slug}:`, error)
      }
    }
    this.pool_map.clear()
  }
}

export default TenantResolver
