/**
 * Migration Executor: Core migration runner and orchestrator
 *
 * Responsibilities:
 * - Load and sort migrations
 * - Track applied migrations
 * - Execute migrations in transaction
 * - Handle errors and rollback
 * - Emit structured logs
 *
 * File: apps/api/src/db/master/runner.ts
 * Task: T002
 * Phase: 1 - Migration Infrastructure
 */

import { Logger } from '@zidney/logger'
import { Pool, PoolClient } from 'pg'
import { MigrationLoader } from './loader'
import { MigrationValidator } from './validator'

export interface Migration {
  version: string
  description: string
  up: (client: PoolClient) => Promise<void>
}

export interface MigrationRecord {
  version: string
  description: string
  applied_at: Date
  execution_time_ms: number
}

export class MigrationExecutor {
  private pool: Pool
  private logger: Logger
  private loader: MigrationLoader
  private validator: MigrationValidator

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool
    this.logger = logger
    this.loader = new MigrationLoader()
    this.validator = new MigrationValidator()
  }

  /**
   * Execute all pending migrations in sequence
   *
   * Transaction guarantees:
   * - Each migration in its own transaction
   * - If migration fails, entire transaction rolled back
   * - No partial schema created
   * - Migration record inserted only on success
   */
  async executeAll(): Promise<void> {
    const correlationId = this.generateCorrelationId()
    const startTime = Date.now()

    try {
      this.logger.info('Starting master database migrations', {
        correlation_id: correlationId,
        phase: 'startup',
        status: 'started',
      })

      // Load all migration files
      const migrations = await this.loader.loadMigrations(
        `${process.cwd()}/apps/api/src/db/master/migrations`
      )

      // Sort by version
      const sorted = this.sortMigrations(migrations)

      // Get applied migrations
      const applied = await this.getAppliedMigrations()

      // Find unapplied
      const unapplied = sorted.filter((m) => !applied.includes(m.version))

      if (unapplied.length === 0) {
        this.logger.info('No pending migrations', {
          correlation_id: correlationId,
          phase: 'verification',
          status: 'skipped',
          applied_count: applied.length,
        })
        return
      }

      // Execute each migration
      for (const migration of unapplied) {
        await this.executeMigration(migration, correlationId)
      }

      const duration = Date.now() - startTime
      this.logger.info('All migrations applied successfully', {
        correlation_id: correlationId,
        phase: 'completion',
        status: 'completed',
        migrations_applied: unapplied.length,
        duration_ms: duration,
      })
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error('Migration execution failed', {
        correlation_id: correlationId,
        phase: 'execution',
        status: 'failed',
        error: {
          code: 'MIGRATION_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        duration_ms: duration,
      })

      throw error
    }
  }

  /**
   * Execute single migration in transaction
   */
  private async executeMigration(
    migration: Migration,
    correlationId: string
  ): Promise<void> {
    const client = await this.pool.connect()
    const startTime = Date.now()

    try {
      // Validate migration before execution
      await this.validator.validate(migration)

      this.logger.info(
        `Executing migration ${migration.version}: ${migration.description}`,
        {
          correlation_id: correlationId,
          migration_version: migration.version,
          phase: 'execution',
          status: 'started',
        }
      )

      // Begin transaction
      await client.query('BEGIN')

      // Execute migration
      await migration.up(client)

      // Record migration
      await client.query(
        `INSERT INTO _schema_migrations (version, description, applied_at, execution_time_ms)
         VALUES ($1, $2, NOW(), $3)`,
        [migration.version, migration.description, Date.now() - startTime]
      )

      // Commit transaction
      await client.query('COMMIT')

      this.logger.info(`Migration ${migration.version} applied successfully`, {
        correlation_id: correlationId,
        migration_version: migration.version,
        phase: 'execution',
        status: 'completed',
        duration_ms: Date.now() - startTime,
      })
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        this.logger.error('Failed to rollback transaction', {
          correlation_id: correlationId,
          phase: 'rollback',
          error: {
            code: 'ROLLBACK_ERROR',
            message:
              rollbackError instanceof Error
                ? rollbackError.message
                : 'Unknown error',
          },
        })
      }

      this.logger.error(
        `Migration ${migration.version} failed and rolled back`,
        {
          correlation_id: correlationId,
          migration_version: migration.version,
          phase: 'execution',
          status: 'failed',
          error: {
            code: 'MIGRATION_FAILURE',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          duration_ms: Date.now() - startTime,
        }
      )

      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Get list of applied migrations from database
   */
  private async getAppliedMigrations(): Promise<string[]> {
    try {
      const result = await this.pool.query(
        `SELECT version FROM _schema_migrations ORDER BY version ASC`
      )
      return result.rows.map((row) => row.version)
    } catch (error) {
      // If table doesn't exist yet, return empty list
      if (
        error instanceof Error &&
        error.message.includes('_schema_migrations')
      ) {
        return []
      }
      throw error
    }
  }

  /**
   * Sort migrations by version (numeric)
   */
  private sortMigrations(migrations: Migration[]): Migration[] {
    return migrations.sort((a, b) => {
      const aNum = parseInt(a.version, 10)
      const bNum = parseInt(b.version, 10)
      return aNum - bNum
    })
  }

  /**
   * Generate correlation ID for tracing
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

export default MigrationExecutor
