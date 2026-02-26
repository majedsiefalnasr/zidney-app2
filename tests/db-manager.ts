/**
 * Database Connection Manager for Testing
 * Manages master and tenant database connections
 */

import { Pool } from 'pg'

export class DbManager {
  private masterDb: Pool | null = null
  private tenantDbs: Map<string, Pool> = new Map()

  constructor(
    private masterConnectionString: string = 'postgresql://zidney_test:test_password_secure_123@localhost:5433/master_db'
  ) {}

  /**
   * Get or create connection to master database
   */
  async getMasterDb(): Promise<Pool> {
    if (!this.masterDb) {
      this.masterDb = new Pool({
        connectionString: this.masterConnectionString,
      })
      await this.masterDb.connect()
    }
    return this.masterDb
  }

  /**
   * Get or create connection to tenant-specific database
   */
  async getTenantDb(workspaceId: string): Promise<Pool> {
    if (this.tenantDbs.has(workspaceId)) {
      return this.tenantDbs.get(workspaceId)!
    }

    const dbName = `tenant_${workspaceId.replace(/-/g, '_')}`
    const connectionString = this.masterConnectionString.replace(
      '/master_db',
      `/${dbName}`
    )

    const pool = new Pool({
      connectionString,
    })

    try {
      await pool.connect()
      this.tenantDbs.set(workspaceId, pool)
      return pool
    } catch (error) {
      throw new Error(
        `Failed to connect to tenant database ${dbName}: ${error}`
      )
    }
  }

  /**
   * Provision a new tenant database
   */
  async createTenantDatabase(
    workspaceSlug: string
  ): Promise<{ success: boolean; dbName: string }> {
    const masterDb = await this.getMasterDb()
    const dbName = `tenant_${workspaceSlug.replace(/-/g, '_')}`

    try {
      // Create database
      await masterDb.query(`CREATE DATABASE "${dbName}" OWNER zidney_test`)
      return { success: true, dbName }
    } catch (error: any) {
      if (error.code === '42P04') {
        // Database already exists
        return { success: true, dbName }
      }
      throw error
    }
  }

  /**
   * Drop a tenant database
   */
  async dropTenantDatabase(workspaceSlug: string): Promise<void> {
    const masterDb = await this.getMasterDb()
    const dbName = `tenant_${workspaceSlug.replace(/-/g, '_')}`

    // Close the connection first
    if (this.tenantDbs.has(workspaceSlug)) {
      const pool = this.tenantDbs.get(workspaceSlug)!
      await pool.end()
      this.tenantDbs.delete(workspaceSlug)
    }

    try {
      await masterDb.query(`DROP DATABASE IF EXISTS "${dbName}"`)
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Cleanup all connections
   */
  async teardown(): Promise<void> {
    // Close all tenant pools
    for (const [, pool] of this.tenantDbs) {
      try {
        await pool.end()
      } catch (error) {
        // Ignore errors
      }
    }
    this.tenantDbs.clear()

    // Close master pool
    if (this.masterDb) {
      try {
        await this.masterDb.end()
      } catch (error) {
        // Ignore errors
      }
      this.masterDb = null
    }
  }
}

/**
 * Factory to create database manager
 */
export function createDbManager(): DbManager {
  return new DbManager()
}
