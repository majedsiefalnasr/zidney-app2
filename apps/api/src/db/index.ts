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
  getTenantPoolSync,
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

function resolveTenantDatabaseUrl(workspaceId: string): string | null {
  const template = process.env.TENANT_DATABASE_URL_TEMPLATE
  if (template) {
    return template.replace('{workspace_id}', workspaceId)
  }

  // Test fallback only: use a single DB when dedicated tenant URLs are not configured.
  if (process.env.NODE_ENV === 'test' && process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  return null
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
  const tenantDatabaseUrl = resolveTenantDatabaseUrl(workspaceId)
  if (!tenantDatabaseUrl) {
    return null
  }

  return getTenantPoolSync(workspaceId, tenantDatabaseUrl)
}

// Re-export tenant pool utilities
export {
  checkTenantPoolsHealth,
  closeAllTenantPools,
  getPoolStats,
  getTenantClient,
  getTenantDatabase,
  getTenantPoolSync,
  queryTenantDatabase,
}
