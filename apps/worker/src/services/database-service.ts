/**
 * Database Service
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Handles tenant database creation and management.
 *
 * Features:
 * - Database name generation (workspace_<slug>)
 * - UTF-8 locale enforcement
 * - Connection attempt retry
 * - Isolation from master database
 */

import type { Logger } from '@zidney/logger'
import { ProvisioningErrorCode } from '@zidney/types/errors/provisioning-errors'
import { Pool, type QueryResult } from 'pg'

/**
 * Database Service Result
 */
export interface DatabaseOperation {
  success: boolean
  dbName?: string
  pool?: Pool
  error?: ProvisioningErrorCode
  message?: string
  durationMs?: number
}

/**
 * Database Service
 */
export class DatabaseService {
  private adminPool: Pool
  private tenantPools: Map<string, Pool> = new Map()
  private logger?: Logger

  constructor(adminPool: Pool, logger?: Logger) {
    this.adminPool = adminPool
    this.logger = logger
  }

  /**
   * Create tenant database
   */
  async createDatabase(workspaceSlug: string): Promise<DatabaseOperation> {
    const dbName = this.generateDatabaseName(workspaceSlug)
    const startTime = Date.now()

    try {
      this.logger?.logDatabaseOperation('CREATE', 'DATABASE', 0)

      // Check if database already exists (idempotency)
      const exists = await this.databaseExists(dbName)
      if (exists) {
        this.logger?.logWarn('Database already exists', {
          db_name: dbName,
          workspace_slug: workspaceSlug,
        })

        // Drop and recreate for clean slate (on idempotent retry)
        try {
          await this.dropDatabase(dbName)
        } catch (_error) {
          this.logger?.logWarn('Failed to drop existing database', {
            db_name: dbName,
          })
        }
      }

      // Create database with UTF-8 encoding
      const createSQL = `
        CREATE DATABASE "${dbName}"
        WITH ENCODING 'UTF8'
             LOCALE 'en_US.UTF-8'
             TEMPLATE template0;
      `

      await this.adminPool.query(createSQL)

      this.logger?.logStep('database-created', 'Tenant database created successfully', {
        db_name: dbName,
        workspace_slug: workspaceSlug,
        encoding: 'UTF-8',
      })

      const durationMs = Date.now() - startTime

      return {
        success: true,
        dbName,
        durationMs,
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      this.logger?.logError(
        'Database creation failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          workspace_slug: workspaceSlug,
          db_name: dbName,
          duration_ms: durationMs,
        }
      )

      return {
        success: false,
        error: ProvisioningErrorCode.DB_CREATE_FAILED,
        message: error instanceof Error ? error.message : String(error),
        durationMs,
      }
    }
  }

  /**
   * Get connection pool for tenant database
   */
  async getTenantPool(dbName: string): Promise<Pool> {
    // Return cached pool if exists
    if (this.tenantPools.has(dbName)) {
      const cached = this.tenantPools.get(dbName)
      if (cached) return cached
    }

    // Create new connection pool for tenant
    const connectionString = this.buildConnectionString(dbName)
    const pool = new Pool({
      connectionString,
      max: 10, // Max connections per tenant
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })

    // Test connection
    try {
      await pool.query('SELECT 1')
      this.tenantPools.set(dbName, pool)
      return pool
    } catch (error) {
      await pool.end()
      throw error
    }
  }

  /**
   * Run query on tenant database
   */
  async queryTenantDb(dbName: string, sql: string, params?: unknown[]): Promise<QueryResult> {
    const pool = await this.getTenantPool(dbName)
    return pool.query(sql, params)
  }

  /**
   * Run migrations on tenant database
   */
  async runMigration(dbName: string, migrationSQL: string): Promise<DatabaseOperation> {
    const startTime = Date.now()

    try {
      const pool = await this.getTenantPool(dbName)

      // Run migration in transaction
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(migrationSQL)
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }

      this.logger?.logDatabaseOperation('MIGRATE', dbName, Date.now() - startTime)

      return {
        success: true,
        dbName,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      this.logger?.logError(
        'Migration failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          db_name: dbName,
          duration_ms: durationMs,
        }
      )

      return {
        success: false,
        error: ProvisioningErrorCode.MIGRATION_FAILED,
        message: error instanceof Error ? error.message : String(error),
        durationMs,
      }
    }
  }

  /**
   * Seed tenant database with baseline data
   */
  async seedDatabase(dbName: string, seedSQL: string): Promise<DatabaseOperation> {
    const startTime = Date.now()

    try {
      const result = await this.queryTenantDb(dbName, seedSQL)

      this.logger?.logDatabaseOperation(
        'SEED',
        dbName,
        Date.now() - startTime,
        result.rowCount || 0
      )

      return {
        success: true,
        dbName,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      this.logger?.logError(
        'Seed failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          db_name: dbName,
          duration_ms: durationMs,
        }
      )

      return {
        success: false,
        error: ProvisioningErrorCode.SEED_FAILED,
        message: error instanceof Error ? error.message : String(error),
        durationMs,
      }
    }
  }

  /**
   * Drop tenant database (cleanup on failure)
   */
  async dropDatabase(dbName: string): Promise<boolean> {
    try {
      // Terminate all connections to database
      const killSQL = `
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${dbName}'
        AND pid <> pg_backend_pid();
      `

      await this.adminPool.query(killSQL)

      // Drop database
      const dropSQL = `DROP DATABASE IF EXISTS "${dbName}";`
      await this.adminPool.query(dropSQL)

      // Remove from connection pool cache
      if (this.tenantPools.has(dbName)) {
        const pool = this.tenantPools.get(dbName)
        if (pool) {
          await pool.end()
          this.tenantPools.delete(dbName)
        }
      }

      this.logger?.logStep('database-dropped', 'Tenant database dropped', {
        db_name: dbName,
      })

      return true
    } catch (error) {
      this.logger?.logError(
        'Database drop failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          db_name: dbName,
        }
      )
      return false
    }
  }

  /**
   * Check if database exists
   */
  private async databaseExists(dbName: string): Promise<boolean> {
    try {
      const result = await this.adminPool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [
        dbName,
      ])
      return result.rows.length > 0
    } catch (_error) {
      return false
    }
  }

  /**
   * Generate database name from workspace slug
   */
  private generateDatabaseName(workspaceSlug: string): string {
    // Enforce PostgreSQL identifier rules:
    // - Max 63 characters
    // - No spaces or special chars except underscore
    const sanitized = workspaceSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '_')
      .substring(0, 55) // Leave room for "workspace_" prefix

    return `workspace_${sanitized}`
  }

  /**
   * Build PostgreSQL connection string
   */
  private buildConnectionString(dbName: string): string {
    const host = process.env.PG_HOST || 'localhost'
    const port = process.env.PG_PORT || '5432'
    const user = process.env.PG_USERNAME || 'postgres'
    const password = process.env.PG_PASSWORD || ''

    const pwd = password ? `:${password}` : ''
    return `postgresql://${user}${pwd}@${host}:${port}/${dbName}`
  }

  /**
   * Cleanup: Close all tenant pools
   */
  async cleanup(): Promise<void> {
    for (const [dbName, pool] of this.tenantPools.entries()) {
      try {
        await pool.end()
      } catch (_error) {
        this.logger?.logWarn('Pool cleanup error', { db_name: dbName })
      }
    }
    this.tenantPools.clear()
  }
}

/**
 * Factory to create database service
 */
export function createDatabaseService(adminPool: Pool, logger?: Logger): DatabaseService {
  return new DatabaseService(adminPool, logger)
}
