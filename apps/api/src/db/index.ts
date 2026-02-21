/**
 * Database Module Entry Point
 *
 * File: apps/api/src/db/index.ts
 * Purpose: Export database connections and utilities
 *
 * Exports:
 * - db: Database connection object with master pool
 * - getTenantPool: Function to get tenant database pool
 */

import { Pool } from 'pg'
import {
  checkTenantPoolsHealth,
  closeAllTenantPools,
  getPoolStats,
  getTenantClient,
  getTenantDatabase,
  queryTenantDatabase,
} from './tenant-pool'

/**
 * Master database connection pool
 *
 * Uses DATABASE_URL environment variable for connection
 */
const masterPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 900000,
  connectionTimeoutMillis: 30000,
})

/**
 * Database object with master pool
 */
export const db = {
  master: masterPool,
}

/**
 * Get tenant database pool by workspace ID
 *
 * This is a convenience wrapper that uses the tenant-pool module
 * For full functionality, use getTenantDatabase directly
 *
 * @param workspaceId - UUID of workspace
 * @returns Pool instance for tenant database
 */
export function getTenantPool(workspaceId: string): Pool | null {
  // This returns null if the pool hasn't been created yet
  // For full async pool creation, use getTenantDatabase from tenant-pool.ts
  const tenantDatabaseUrl = process.env.TENANT_DATABASE_URL_TEMPLATE?.replace(
    '{workspace_id}',
    workspaceId
  )

  if (!tenantDatabaseUrl) {
    return null
  }

  // For synchronous access, we need to use a different approach
  // This is a placeholder that returns null - the actual implementation
  // should use getTenantDatabase for async pool creation
  return null
}

// Re-export tenant pool utilities
export {
  checkTenantPoolsHealth,
  closeAllTenantPools,
  getPoolStats,
  getTenantClient,
  getTenantDatabase,
  queryTenantDatabase,
}
