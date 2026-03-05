/**
 * Tenant Database Connection Pool Manager
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T009
 *
 * Manages per-workspace PostgreSQL connection pools.
 * Implements ADR-0001: Database-per-tenant model with connection pooling.
 *
 * Key Responsibilities:
 * - Maintain in-memory Map of workspace pools
 * - Create pools on-demand with configured connection limits
 * - Prevent race conditions during pool creation
 * - Provide safe async accessor for tenant databases
 */

import { createLogger } from '@zidney/logger'
import { Pool, PoolClient } from 'pg'

const logger = createLogger('tenant-pool')

/**
 * Configuration for tenant connection pools
 */
interface PoolConfig {
  max: number // Maximum connections per pool
  idleTimeoutMillis: number // Idle connection timeout
  connectionTimeoutMillis: number // Connection timeout
}

/**
 * Default pool configuration
 * Tuned for multi-tenant SaaS environment
 */
const DEFAULT_POOL_CONFIG: PoolConfig = {
  max: 20, // 20 connections per tenant database
  idleTimeoutMillis: 900000, // 15 minutes idle timeout
  connectionTimeoutMillis: 30000, // 30 second connection timeout
}

/**
 * In-memory cache of tenant pools
 * Key: workspace_id (UUID)
 * Value: PostgreSQL Pool instance
 */
const tenantPools = new Map<string, Pool>()

/**
 * Lock for preventing race condition during pool creation
 * Key: workspace_id
 * Value: Promise<Pool> (ongoing creation)
 */
const poolCreationLocks = new Map<string, Promise<Pool>>()

function createPoolInstance(
  workspaceId: string,
  tenantDatabaseUrl: string
): Pool {
  const pool = new Pool({
    connectionString: tenantDatabaseUrl,
    ...DEFAULT_POOL_CONFIG,
    application_name: `zidney-api-tenant-${workspaceId}`,
  })

  pool.on('error', (error) => {
    logger.error('Unexpected error on idle client in tenant pool', {
      workspace_id: workspaceId,
      error: error.message,
    })
  })

  return pool
}

/**
 * Get or lazily create a tenant pool without async connection validation.
 *
 * This is primarily used by existing routes/tests that use a synchronous pool
 * accessor. For the fully validated path, prefer getTenantDatabase().
 */
export function getTenantPoolSync(
  workspaceId: string,
  tenantDatabaseUrl: string
): Pool {
  const existingPool = tenantPools.get(workspaceId)
  if (existingPool) {
    return existingPool
  }

  const pool = createPoolInstance(workspaceId, tenantDatabaseUrl)
  tenantPools.set(workspaceId, pool)
  return pool
}

/**
 * Get or create a connection pool for a tenant's database
 *
 * Thread-safe: Multiple concurrent calls with same workspace_id
 * will share the pool creation promise (no duplicate pools).
 *
 * @param workspaceId - UUID of workspace
 * @param tenantDatabaseUrl - PostgreSQL connection string for tenant DB
 * @returns Promise resolving to tenant database Pool
 * @throws Error if pool creation fails
 */
export async function getTenantDatabase(
  workspaceId: string,
  tenantDatabaseUrl: string
): Promise<Pool> {
  // Fast path: pool already exists
  if (tenantPools.has(workspaceId)) {
    return tenantPools.get(workspaceId)!
  }

  // Slow path: create pool with locking to prevent duplicates
  if (!poolCreationLocks.has(workspaceId)) {
    // This is the first caller for this workspace; create the pool
    const creationPromise = createTenantPool(workspaceId, tenantDatabaseUrl)
    poolCreationLocks.set(workspaceId, creationPromise)

    try {
      const pool = await creationPromise
      const existingPool = tenantPools.get(workspaceId)
      if (existingPool) {
        await pool.end().catch((error) => {
          logger.error('Error closing duplicate tenant pool', {
            workspace_id: workspaceId,
            error: error instanceof Error ? error.message : String(error),
          })
        })
        poolCreationLocks.delete(workspaceId)
        return existingPool
      }
      tenantPools.set(workspaceId, pool)
      poolCreationLocks.delete(workspaceId)
      return pool
    } catch (error) {
      // Clean up on failure
      poolCreationLocks.delete(workspaceId)
      logger.error('Pool creation failed', {
        workspace_id: workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Other callers are waiting for the same pool; join the creation promise
  return await poolCreationLocks.get(workspaceId)!
}

/**
 * Internal: Create a new connection pool for a tenant database
 *
 * @private
 * @param workspaceId - UUID of workspace
 * @param tenantDatabaseUrl - PostgreSQL connection string
 * @returns Promise resolving to new Pool instance
 */
async function createTenantPool(
  workspaceId: string,
  tenantDatabaseUrl: string
): Promise<Pool> {
  const pool = createPoolInstance(workspaceId, tenantDatabaseUrl)

  // Test the connection to ensure validity
  const client = await pool.connect()
  try {
    const result = await client.query('SELECT NOW() as server_time')
    logger.info('Tenant pool created successfully', {
      workspace_id: workspaceId,
      server_time: result.rows[0].server_time,
      pool_config: DEFAULT_POOL_CONFIG,
    })
  } finally {
    client.release()
  }

  return pool
}

/**
 * Retrieve a single client from the tenant pool
 *
 * Important: Caller MUST release the client when done:
 * ```typescript
 * const client = await getTenantClient(workspaceId, dbUrl);
 * try {
 *   const result = await client.query(...);
 * } finally {
 *   client.release();
 * }
 * ```
 *
 * @param workspaceId - UUID of workspace
 * @param tenantDatabaseUrl - PostgreSQL connection string
 * @returns Promise resolving to PoolClient
 */
export async function getTenantClient(
  workspaceId: string,
  tenantDatabaseUrl: string
): Promise<PoolClient> {
  const pool = await getTenantDatabase(workspaceId, tenantDatabaseUrl)
  return pool.connect()
}

/**
 * Execute a query against a tenant database
 *
 * Handles connection acquisition and release automatically.
 *
 * @param workspaceId - UUID of workspace
 * @param tenantDatabaseUrl - PostgreSQL connection string
 * @param query - SQL query string
 * @param values - Query parameters
 * @returns Promise resolving to query result
 */
export async function queryTenantDatabase(
  workspaceId: string,
  tenantDatabaseUrl: string,
  query: string,
  values: any[] = []
): Promise<any> {
  const pool = await getTenantDatabase(workspaceId, tenantDatabaseUrl)
  return pool.query(query, values)
}

/**
 * Gracefully close all tenant pools
 *
 * Used for: Application shutdown, test cleanup
 *
 * @returns Promise that resolves when all pools are closed
 */
export async function closeAllTenantPools(): Promise<void> {
  const closePromises = Array.from(tenantPools.values()).map((pool) =>
    pool.end().catch((error) => {
      logger.error('Error closing tenant pool', {
        error: error instanceof Error ? error.message : String(error),
      })
    })
  )

  await Promise.all(closePromises)
  tenantPools.clear()
  poolCreationLocks.clear()

  logger.info('All tenant pools closed')
}

/**
 * Get pool statistics for monitoring
 *
 * @returns Object with pool metrics
 */
export function getPoolStats(): {
  active_pools: number
  pending_creations: number
} {
  return {
    active_pools: tenantPools.size,
    pending_creations: poolCreationLocks.size,
  }
}

/**
 * Check health of all active pools
 *
 * @returns Promise resolving to health status
 */
export async function checkTenantPoolsHealth(): Promise<{
  healthy: boolean
  pool_count: number
  errors?: string[]
}> {
  const errors: string[] = []

  for (const [workspaceId, pool] of tenantPools.entries()) {
    try {
      const client = await pool.connect()
      try {
        await client.query('SELECT 1')
      } finally {
        client.release()
      }
    } catch (error) {
      errors.push(
        `Workspace ${workspaceId}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  return {
    healthy: errors.length === 0,
    pool_count: tenantPools.size,
    errors: errors.length > 0 ? errors : undefined,
  }
}
