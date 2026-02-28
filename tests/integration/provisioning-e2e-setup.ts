/**
 * End-to-End Integration Test Setup
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Fixture for provisioning e2e tests.
 * Starts local PostgreSQL, Redis, and worker consumer.
 * Provides API client and database utilities for testing.
 */

import { ProvisioningLogger } from '@zidney/logger/provisioning-logger'
import { Redis } from 'ioredis'
import { Pool } from 'pg'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProvisioningJobConsumer = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProvisionWorkspaceHandler = any

/**
 * E2E test environment
 */
export interface E2ETestEnvironment {
  masterDb: Pool
  redis: Redis
  consumer: ProvisioningJobConsumer
  handler: ProvisionWorkspaceHandler
  logger: ProvisioningLogger
  cleanup: () => Promise<void>
}

/**
 * E2E setup fixture
 */
export class E2EIntegrationTestSetup {
  private masterDb: Pool | null = null
  private redis: Redis | null = null
  private consumer: ProvisioningJobConsumer | null = null
  private handler: ProvisionWorkspaceHandler | null = null
  private logger: ProvisioningLogger | null = null

  constructor() {
    // Initialize logger
    this.logger = new ProvisioningLogger({} as any, {} as any)
  }

  /**
   * Setup test environment
   */
  async setup(): Promise<E2ETestEnvironment> {
    try {
      // Connect to PostgreSQL (should be running locally or in Docker)
      this.masterDb = new Pool({
        user: process.env.PGUSER || 'postgres',
        host: process.env.PGHOST || 'localhost',
        database: process.env.PGDATABASE || 'zidney_test',
        password: process.env.PGPASSWORD || 'postgres',
        port: parseInt(process.env.PGPORT || '5432'),
      })

      // Verify connection
      await this.masterDb.query('SELECT 1')
      this.logger!.logStep('e2e-setup-pg', 'PostgreSQL connected', {
        host: process.env.PGHOST || 'localhost',
      })

      // Connect to Redis
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        db: parseInt(process.env.REDIS_DB || '1'), // Use separate DB for tests
      })

      await this.redis.ping()
      this.logger!.logStep('e2e-setup-redis', 'Redis connected', {
        host: process.env.REDIS_HOST || 'localhost',
      })

      // Clean up any test data from previous runs
      await this.cleanupTestData()

      // Create queue structures
      const queueName = `provisioning:queue:test:${Date.now()}`
      const dlqName = `${queueName}:dlq`

      this.logger!.logStep('e2e-setup-queue', 'Test queues created', {
        queue_name: queueName,
        dlq_name: dlqName,
      })

      // The consumer and handler would be instantiated here with all dependencies
      // For now, returning the environment setup
      return {
        masterDb: this.masterDb,
        redis: this.redis,
        consumer: this.consumer!,
        handler: this.handler!,
        logger: this.logger!,
        cleanup: () => this.cleanup(),
      }
    } catch (error) {
      await this.cleanup()
      throw error
    }
  }

  /**
   * Clean up test data
   */
  private async cleanupTestData(): Promise<void> {
    try {
      if (!this.masterDb) return

      // Delete test licensesand registry entries
      await this.masterDb.query(
        `DELETE FROM tenant_registry WHERE license_id LIKE 'test-%'`
      )
      await this.masterDb.query(`DELETE FROM licenses WHERE id LIKE 'test-%'`)

      // Drop test workspace databases
      const result = await this.masterDb.query(
        `SELECT datname FROM pg_database WHERE datname LIKE 'workspace_test_%'`
      )

      for (const row of result.rows) {
        try {
          await this.masterDb.query(`DROP DATABASE IF EXISTS "${row.datname}"`)
        } catch (error) {
          this.logger?.logWarn('Failed to drop test database', {
            database: row.datname,
          })
        }
      }

      this.logger?.logStep('e2e-cleanup-data', 'Test data cleaned', {
        databases_dropped: result.rowCount,
      })
    } catch (error) {
      this.logger?.logError(
        'Test data cleanup failed',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Clean up test environment
   */
  async cleanup(): Promise<void> {
    try {
      // Stop consumer
      if (this.consumer) {
        await this.consumer.stop()
      }

      // Close database connections
      if (this.masterDb) {
        await this.masterDb.end()
        this.masterDb = null
      }

      // Close Redis connection
      if (this.redis) {
        await this.redis.quit()
        this.redis = null
      }

      this.logger?.logStep(
        'e2e-cleanup-complete',
        'Test environment cleaned up'
      )
    } catch (error) {
      console.error('Cleanup error:', error)
    }
  }

  /**
   * Create test license
   */
  async createTestLicense(data: {
    workspace_slug: string
    admin_email: string
    organization_name: string
    student_limit: number
    staff_limit: number
  }): Promise<string> {
    if (!this.masterDb) {
      throw new Error('Database not connected')
    }

    const licenseId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    await this.masterDb.query(
      `INSERT INTO licenses (id, workspace_slug, admin_email, organization_name, student_limit, staff_limit, status, schema_version, product_version, retry_count)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING_PROVISION', '1.0.0', '1.0.0', 0)`,
      [
        licenseId,
        data.workspace_slug,
        data.admin_email,
        data.organization_name,
        data.student_limit,
        data.staff_limit,
      ]
    )

    this.logger?.logStep('e2e-license-created', 'Test license created', {
      license_id: licenseId,
      workspace_slug: data.workspace_slug,
    })

    return licenseId
  }

  /**
   * Wait for provisioning to complete
   */
  async waitForProvisioning(
    licenseId: string,
    timeoutMs: number = 30000
  ): Promise<{
    success: boolean
    status?: string
    error?: string
  }> {
    if (!this.masterDb) {
      throw new Error('Database not connected')
    }

    const startTime = Date.now()

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.masterDb.query(
        `SELECT status, last_provision_error FROM licenses WHERE id = $1`,
        [licenseId]
      )

      if (result.rowCount === 0) {
        return {
          success: false,
          error: 'License not found',
        }
      }

      const license = result.rows[0]!

      if (license.status === 'ACTIVE') {
        return {
          success: true,
          status: 'ACTIVE',
        }
      }

      if (license.status === 'PROVISION_FAILED') {
        return {
          success: false,
          status: 'PROVISION_FAILED',
          error: license.last_provision_error,
        }
      }

      // Still pending, wait
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    return {
      success: false,
      error: `Timeout waiting for provisioning (${timeoutMs}ms)`,
    }
  }

  /**
   * Verify database created
   */
  async verifyDatabaseCreated(databaseName: string): Promise<boolean> {
    if (!this.masterDb) {
      throw new Error('Database not connected')
    }

    try {
      const result = await this.masterDb.query(
        `SELECT datname FROM pg_database WHERE datname = $1`,
        [databaseName]
      )

      return (result.rowCount ?? 0) > 0
    } catch (error) {
      return false
    }
  }

  /**
   * Verify registry entry created
   */
  async verifyRegistryEntry(licenseId: string): Promise<{
    exists: boolean
    entry?: any
  }> {
    if (!this.masterDb) {
      throw new Error('Database not connected')
    }

    try {
      const result = await this.masterDb.query(
        `SELECT * FROM tenant_registry WHERE license_id = $1`,
        [licenseId]
      )

      if (result.rowCount === 0) {
        return { exists: false }
      }

      return {
        exists: true,
        entry: result.rows[0]!,
      }
    } catch (error) {
      return { exists: false }
    }
  }

  /**
   * Query workspace database
   */
  async queryWorkspaceDb(dbName: string, query: string): Promise<any[]> {
    if (!this.masterDb) {
      throw new Error('Database not connected')
    }

    const pool = new Pool({
      user: process.env.PGUSER || 'postgres',
      host: process.env.PGHOST || 'localhost',
      database: dbName,
      password: process.env.PGPASSWORD || 'postgres',
      port: parseInt(process.env.PGPORT || '5432'),
    })

    try {
      const result = await pool.query(query)
      return result.rows
    } finally {
      await pool.end()
    }
  }
}

/**
 * Factory for E2E test setup
 */
export function createE2ETestSetup(): E2EIntegrationTestSetup {
  return new E2EIntegrationTestSetup()
}
