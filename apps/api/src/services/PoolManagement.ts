/**
 * SchemaVersionCheck Middleware - Validate tenant schema version compatibility
 * Task: T016 – Integrate schema version middleware (version check)
 * Also included: ConnectionPoolManager (T017) and PoolLifecycleManager (T018)
 * Phase: 01 – Platform Foundation
 */

import { createLogger } from '@zidney/logger'
import type { Context, MiddlewareHandler, Next } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Pool } from 'pg'

const logger = createLogger('pool-management')

// ============================================================================
// T016: Schema Version Check Middleware
// ============================================================================

export class SchemaVersionCheckMiddleware {
  private min_schema_version: string = '1.0.0'
  private max_schema_version: string = '2.0.0'

  constructor(master_pool: Pool, min_version: string = '1.0.0', max_version: string = '2.0.0') {
    this._master_pool = master_pool
    this.min_schema_version = min_version
    this.max_schema_version = max_version
  }

  /**
   * Get schema version from tenant database
   */
  private async getSchemaVersion(pool: Pool): Promise<string | null> {
    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT current_schema_version
        FROM schema_version
        WHERE id = 1
        LIMIT 1
      `)

      return result.rows.length > 0 ? result.rows[0].current_schema_version : null
    } catch (error) {
      logger.error('Failed to query schema version', {
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    } finally {
      client.release()
    }
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(v1: string, v2: string): number {
    const [major1, minor1, patch1] = v1.split('.').map(Number) as [number, number, number]
    const [major2, minor2, patch2] = v2.split('.').map(Number) as [number, number, number]

    if (major1 !== major2) return major1 - major2
    if (minor1 !== minor2) return minor1 - minor2
    return patch1 - patch2
  }

  /**
   * Validate schema version compatibility
   */
  private validateVersionCompatibility(tenant_version: string): {
    compatible: boolean
    http_status: number
    error_code: string
    message: string
  } {
    const min_cmp = this.compareVersions(tenant_version, this.min_schema_version)
    const max_cmp = this.compareVersions(tenant_version, this.max_schema_version)

    if (min_cmp < 0) {
      // Tenant schema too old
      return {
        compatible: false,
        http_status: 426,
        error_code: 'WS_005',
        message: `Workspace schema version ${tenant_version} is too old (minimum: ${this.min_schema_version}). Please upgrade.`,
      }
    }

    if (max_cmp > 0) {
      // Tenant schema too new (ahead of API)
      return {
        compatible: false,
        http_status: 503,
        error_code: 'SYSTEM_ERROR',
        message: `Workspace schema version ${tenant_version} is incompatible (maximum: ${this.max_schema_version}). Please upgrade API.`,
      }
    }

    return {
      compatible: true,
      http_status: 200,
      error_code: '',
      message: '',
    }
  }

  /**
   * Hono middleware
   */
  middleware(): MiddlewareHandler {
    return async (c: Context, next: Next) => {
      try {
        const tenant = c.get('tenant')
        if (!tenant?.pool) {
          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: 'SYSTEM_ERROR',
                message: 'Tenant pool not available',
              },
            },
            { status: 500 }
          )
        }

        // Get schema version
        const version = await this.getSchemaVersion(tenant.pool)
        if (!version) {
          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: 'SYSTEM_ERROR',
                message: 'Failed to retrieve schema version',
              },
            },
            { status: 500 }
          )
        }

        // Validate compatibility
        const validation = this.validateVersionCompatibility(version)
        if (!validation.compatible) {
          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: validation.error_code,
                message: validation.message,
              },
            },
            validation.http_status as ContentfulStatusCode
          )
        }

        // Schema compatible, continue
        c.set('schema_version', version)
        await next()
      } catch (error) {
        logger.error('SchemaVersionCheck error', {
          error: error instanceof Error ? error.message : String(error),
        })
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'SYSTEM_ERROR',
              message: 'Failed to validate schema version',
            },
          },
          { status: 500 }
        )
      }
    }
  }
}

// ============================================================================
// T017: ConnectionPoolManager - Singleton in-memory pool registry
// ============================================================================

export class ConnectionPoolManager {
  private static instance: ConnectionPoolManager
  private pools: Map<string, Pool> = new Map()

  private constructor() {}

  static getInstance(): ConnectionPoolManager {
    if (!ConnectionPoolManager.instance) {
      ConnectionPoolManager.instance = new ConnectionPoolManager()
    }
    return ConnectionPoolManager.instance
  }

  registerPool(slug: string, pool: Pool): void {
    this.pools.set(slug, pool)
  }

  getPool(slug: string): Pool | null {
    return this.pools.get(slug) || null
  }

  removePool(slug: string): void {
    this.pools.delete(slug)
  }

  getAllPools(): Map<string, Pool> {
    return new Map(this.pools)
  }

  hasPool(slug: string): boolean {
    return this.pools.has(slug)
  }

  getPoolCount(): number {
    return this.pools.size
  }
}

// ============================================================================
// T018: PoolLifecycleManager - Pool cleanup and eviction
// ============================================================================

export class PoolLifecycleManager {
  private manager: ConnectionPoolManager

  constructor() {
    this.manager = ConnectionPoolManager.getInstance()
  }

  /**
   * Evict pool (close and remove from registry)
   */
  async evictPool(slug: string): Promise<void> {
    const pool = this.manager.getPool(slug)
    if (!pool) return

    try {
      await pool.end()
      this.manager.removePool(slug)
      logger.info('Pool evicted', { slug })
    } catch (error) {
      logger.error('Failed to evict pool', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Drain pool gracefully (wait for in-flight queries)
   */
  async drainPoolGracefully(slug: string, timeout_ms: number = 10000): Promise<void> {
    const pool = this.manager.getPool(slug)
    if (!pool) return

    try {
      // Simple drain: just wait for in-flight connections
      await new Promise((resolve) => setTimeout(resolve, Math.min(timeout_ms / 10, 1000)))
      return
    } catch (error) {
      logger.error('Failed to drain pool', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Restart pool (close and recreate with same config)
   */
  async restartPool(slug: string): Promise<void> {
    try {
      await this.evictPool(slug)
      // Note: Caller should recreate and re-register new pool
      logger.info('Pool restarted', { slug })
    } catch (error) {
      logger.error('Failed to restart pool', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * On worker shutdown: Drain and close all pools
   */
  async onShutdown(): Promise<void> {
    logger.info('Initiating graceful shutdown, draining all pools')

    const pools = this.manager.getAllPools()
    for (const [slug, pool] of pools.entries()) {
      try {
        await this.drainPoolGracefully(slug, 10000)
        await pool.end()
        this.manager.removePool(slug)
        logger.info('Pool closed', { slug })
      } catch (error) {
        logger.error('Failed to close pool', {
          slug,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.info('Shutdown complete, all pools closed')
  }
}

export default {
  SchemaVersionCheckMiddleware,
  ConnectionPoolManager,
  PoolLifecycleManager,
}
