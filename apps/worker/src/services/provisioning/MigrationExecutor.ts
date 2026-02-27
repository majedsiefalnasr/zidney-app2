/**
 * MigrationExecutor - Execute tenant database migrations with idempotency
 *
 * Purpose: Apply baseline migrations to newly provisioned tenant databases
 * Design: Checksum validation, transactional execution, checkpoint tracking
 *
 * Task: T010 – Implement Migration Executor & Checksum Validator
 * Phase: 01 – Platform Foundation
 * Stage: STAGE_05_TENANT_PROVISIONING_SERVICE
 */

import { createHash } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { Pool, PoolClient } from 'pg'

export interface MigrationFile {
  version: string
  ordinal: number
  filename: string
  filepath: string
  content: string
  checksum: string
}

export interface AppliedMigration {
  version: string
  checksum: string
  installed_on: string
}

/**
 * MigrationExecutor: Manages migration execution and validation
 */
export class MigrationExecutor {
  private migrations_dir: string

  constructor(migrations_dir: string = './migrations') {
    this.migrations_dir = migrations_dir
  }

  /**
   * Load all migration files from directory
   * Returns sorted by version number (ordinal)
   */
  async loadMigrations(): Promise<MigrationFile[]> {
    const files = fs.readdirSync(this.migrations_dir)
    const migrations: MigrationFile[] = []

    for (const filename of files) {
      if (!filename.endsWith('.sql')) continue

      const filepath = path.join(this.migrations_dir, filename)
      const content = fs.readFileSync(filepath, 'utf-8')
      const checksum = this.calculateChecksum(content)

      // Parse filename format: NNN-description.sql
      const match = filename.match(/^(\d+)-(.+)\.sql$/)
      if (!match) continue

      const ordinal = parseInt(match[1]!, 10)
      const version = `${ordinal}`

      migrations.push({
        version,
        ordinal,
        filename,
        filepath,
        content,
        checksum,
      })
    }

    // Sort by ordinal (execution order)
    migrations.sort((a, b) => a.ordinal - b.ordinal)

    return migrations
  }

  /**
   * Get list of migration files (already loaded)
   */
  getMigrationFiles(): Promise<MigrationFile[]> {
    return this.loadMigrations()
  }

  /**
   * Calculate SHA256 checksum of migration content
   */
  private calculateChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  /**
   * Validate checksum of migration against stored value
   */
  validateChecksum(migration: MigrationFile, stored_checksum: string): boolean {
    return migration.checksum === stored_checksum
  }

  /**
   * Get list of already-applied migrations from tenant DB
   */
  async getAppliedMigrations(client: PoolClient): Promise<AppliedMigration[]> {
    try {
      const result = await client.query(`
        SELECT version, checksum, installed_on
        FROM schema_migrations
        ORDER BY version ASC
      `)
      return result.rows
    } catch (error) {
      // Table might not exist yet on fresh DB
      return []
    }
  }

  /**
   * Execute single migration in transaction
   */
  async executeMigration(
    client: PoolClient,
    migration: MigrationFile
  ): Promise<number> {
    const start_time = Date.now()

    try {
      await client.query(migration.content)
      return Date.now() - start_time
    } catch (error) {
      console.error(`Migration ${migration.version} failed:`, error)
      throw new Error(
        `Migration ${migration.version} execution failed: ${error}`
      )
    }
  }

  /**
   * Record migration in schema_migrations table
   */
  async recordMigration(
    client: PoolClient,
    migration: MigrationFile,
    duration_ms: number
  ): Promise<void> {
    try {
      await client.query(
        `
        INSERT INTO schema_migrations (version, description, checksum, execution_time_ms, installed_on)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (version) DO NOTHING
        `,
        [
          migration.version,
          `Migration ${migration.version}`,
          migration.checksum,
          duration_ms,
        ]
      )
    } catch (error) {
      console.error(`Failed to record migration ${migration.version}:`, error)
      throw error
    }
  }

  /**
   * Execute all pending migrations in a transaction
   * @param pool - Database connection pool
   * @param migrations - All migration files (filtered to pending by caller)
   */
  async executeMigrationsInTransaction(
    pool: Pool,
    migrations: MigrationFile[]
  ): Promise<{
    executed: number
    skipped: number
    failed: boolean
  }> {
    const client = await pool.connect()

    try {
      // Get already-applied migrations
      const applied = await this.getAppliedMigrations(client)
      const applied_versions = new Set(applied.map((m) => m.version))

      // Filter to pending migrations
      const pending = migrations.filter((m) => !applied_versions.has(m.version))

      if (pending.length === 0) {
        return { executed: 0, skipped: migrations.length, failed: false }
      }

      // Execute in transaction
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ')

      let executed = 0
      try {
        for (const migration of pending) {
          const duration_ms = await this.executeMigration(client, migration)
          await this.recordMigration(client, migration, duration_ms)
          executed++
        }

        // Update schema_version with latest version
        if (pending.length > 0) {
          const latest = pending[pending.length - 1]!
          await client.query(
            `
            UPDATE schema_version
            SET current_schema_version = $1, applied_at = NOW()
            WHERE id = 1
            `,
            [`${latest.ordinal}.0.0`] // Simplified versioning for baseline
          )
        }

        await client.query('COMMIT')
        return { executed, skipped: applied.length, failed: false }
      } catch (error) {
        await client.query('ROLLBACK')
        console.error('Migration transaction failed, rolled back:', error)
        return { executed, skipped: applied.length, failed: true }
      }
    } finally {
      client.release()
    }
  }

  /**
   * Validate all migrations for schema integrity
   */
  async validateMigrations(migrations: MigrationFile[]): Promise<{
    valid: boolean
    errors: string[]
  }> {
    const errors: string[] = []

    // Check ordering
    let prev_ordinal = -1
    for (const m of migrations) {
      if (m.ordinal !== prev_ordinal + 1) {
        errors.push(
          `Migration ordinal gap: expected ${prev_ordinal + 1}, got ${m.ordinal}`
        )
      }
      prev_ordinal = m.ordinal
    }

    // Check checksums
    const checksums = new Set<string>()
    for (const m of migrations) {
      if (checksums.has(m.checksum)) {
        errors.push(`Duplicate checksum for migration ${m.version}`)
      }
      checksums.add(m.checksum)
    }

    // Check SQL syntax (basic)
    for (const m of migrations) {
      if (m.content.trim().length === 0) {
        errors.push(`Migration ${m.version} is empty`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

export default MigrationExecutor
