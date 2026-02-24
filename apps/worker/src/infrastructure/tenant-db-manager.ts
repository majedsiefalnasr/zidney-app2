import { Pool, PoolClient } from 'pg'
import { logger } from '@zidney/logger'

/**
 * T048: Tenant DB connection management for worker
 *
 * Manages per-tenant database connections:
 * - Get or create tenant DB connection
 * - Reuse connections in pool
 * - Implement connection timeout (30s)
 * - Implement health check
 * - Log connection acquisition
 */

interface PoolConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
}

export class TenantDBManager {
  private pools: Map<string, Pool> = new Map()
  private readonly connectionTimeoutMs = 30000 // 30 seconds
  private readonly maxPoolSize = 10
  private readonly minPoolSize = 2

  /**
   * Get or create connection pool for a tenant
   */
  async getPool(workspaceId: string, config: PoolConfig): Promise<Pool> {
    // Check if pool already exists
    if (this.pools.has(workspaceId)) {
      const pool = this.pools.get(workspaceId)!

      // Verify pool is healthy
      if (await this.isPoolHealthy(pool)) {
        return pool
      } else {
        // Pool is unhealthy, remove it
        this.pools.delete(workspaceId)
      }
    }

    // Create new pool
    const pool = new Pool({
      ...config,
      max: this.maxPoolSize,
      min: this.minPoolSize,
      connectionTimeoutMillis: this.connectionTimeoutMs,
      idleTimeoutMillis: 30000, // 30s idle timeout
    })

    // Set up error handler
    pool.on('error', (error) => {
      logger.error(`Tenant DB pool error`, {
        workspace_id: workspaceId,
        error: error.message,
      })
    })

    // Test connection
    try {
      const client = await pool.connect()
      client.release()

      logger.info(`Tenant DB connection pool created`, {
        workspace_id: workspaceId,
        max_size: this.maxPoolSize,
        min_size: this.minPoolSize,
      })

      this.pools.set(workspaceId, pool)
      return pool
    } catch (error) {
      logger.error(`Failed to create tenant DB connection pool`, {
        workspace_id: workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Close pool on failure
      await pool.end()
      throw error
    }
  }

  /**
   * Get a client connection from pool
   */
  async getClient(workspaceId: string): Promise<PoolClient> {
    const pool = this.pools.get(workspaceId)

    if (!pool) {
      throw new Error(`No connection pool for workspace ${workspaceId}`)
    }

    try {
      const client = await pool.connect()

      logger.debug(`Client connection acquired`, {
        workspace_id: workspaceId,
      })

      return client
    } catch (error) {
      logger.error(`Failed to acquire client connection`, {
        workspace_id: workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }

  /**
   * Check if pool is healthy
   */
  private async isPoolHealthy(pool: Pool): Promise<boolean> {
    try {
      const client = await pool.connect()

      // Run simple query
      await client.query('SELECT 1')

      client.release()

      return true
    } catch (error) {
      logger.warn(`Tenant DB pool health check failed`, {
        error: error instanceof Error ? error.message : String(error),
      })

      return false
    }
  }

  /**
   * Close a pool
   */
  async closePool(workspaceId: string): Promise<void> {
    const pool = this.pools.get(workspaceId)

    if (!pool) {
      return
    }

    try {
      await pool.end()
      this.pools.delete(workspaceId)

      logger.info(`Tenant DB connection pool closed`, {
        workspace_id: workspaceId,
      })
    } catch (error) {
      logger.error(`Error closing tenant DB pool`, {
        workspace_id: workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Close all pools
   */
  async closeAllPools(): Promise<void> {
    const workspaceIds = Array.from(this.pools.keys())

    for (const workspaceId of workspaceIds) {
      await this.closePool(workspaceId)
    }

    logger.info(`All tenant DB connection pools closed`)
  }

  /**
   * Get pool statistics
   */
  getStats(): Map<string, { size: number; available: number }> {
    const stats = new Map<string, { size: number; available: number }>()

    for (const [workspaceId, pool] of this.pools.entries()) {
      stats.set(workspaceId, {
        size: pool.totalCount,
        available: pool.idleCount,
      })
    }

    return stats
  }
}

export const tenantDBManager = new TenantDBManager()
