/**
 * Database Connection Manager for Testing
 * Manages master and tenant database connections
 */

import { Pool } from 'pg'

export class DbManager {
  private masterDb: Pool | null = null
  private tenantDbs: Map<string, Pool> = new Map()
  private schemaInitialized = false

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
    if (!this.schemaInitialized) {
      await this.ensureTestSchema(this.masterDb)
      this.schemaInitialized = true
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
    const connectionString = this.masterConnectionString.replace('/master_db', `/${dbName}`)

    const pool = new Pool({
      connectionString,
    })

    try {
      await pool.connect()
      this.tenantDbs.set(workspaceId, pool)
      return pool
    } catch (error) {
      throw new Error(`Failed to connect to tenant database ${dbName}: ${error}`)
    }
  }

  /**
   * Provision a new tenant database
   */
  async createTenantDatabase(workspaceSlug: string): Promise<{ success: boolean; dbName: string }> {
    const masterDb = await this.getMasterDb()
    const dbName = `tenant_${workspaceSlug.replace(/-/g, '_')}`

    try {
      // Create database
      await masterDb.query(`CREATE DATABASE "${dbName}" OWNER zidney_test`)
      return { success: true, dbName }
    } catch (error: any) {
      // Handle concurrent create attempts idempotently.
      if (error.code === '42P04' || error.code === '23505' || error.code === '55006') {
        return { success: true, dbName }
      }
      const exists = await masterDb.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName])
      if (exists.rowCount && exists.rowCount > 0) {
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
      await masterDb.query(
        `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
         WHERE datname = $1
           AND pid <> pg_backend_pid()`,
        [dbName]
      )
      await masterDb.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
    } catch (_error) {
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
      } catch (_error) {
        // Ignore errors
      }
    }
    this.tenantDbs.clear()

    // Close master pool
    if (this.masterDb) {
      try {
        await this.masterDb.end()
      } catch (_error) {
        // Ignore errors
      }
      this.masterDb = null
    }
  }

  private async ensureTestSchema(db: Pool): Promise<void> {
    await db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    await db.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id UUID PRIMARY KEY,
        workspace_id UUID NOT NULL REFERENCES workspaces(id),
        product_id UUID NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        max_students INT NOT NULL DEFAULT 1000,
        max_staff INT NOT NULL DEFAULT 100,
        schema_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
        product_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        workspace_id UUID NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS students (
        id UUID PRIMARY KEY,
        workspace_id UUID NOT NULL,
        email VARCHAR(255) NOT NULL,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id UUID PRIMARY KEY,
        workspace_id UUID NOT NULL,
        title VARCHAR(255) NOT NULL,
        duration_minutes INT NOT NULL,
        pass_threshold INT NOT NULL,
        passing_grade VARCHAR(8) NOT NULL,
        question_count INT NOT NULL,
        total_points INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS attempts (
        id UUID PRIMARY KEY,
        workspace_id UUID NOT NULL,
        student_id UUID NOT NULL,
        exam_id UUID NOT NULL,
        status VARCHAR(50) NOT NULL,
        snapshot JSONB NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        deadline_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ NULL,
        result JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY,
        exam_id UUID NOT NULL,
        question_id INT NOT NULL,
        title TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        points INT NOT NULL,
        options JSONB NULL,
        correct_answer JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS attempt_submissions (
        job_id UUID PRIMARY KEY,
        attempt_id UUID NOT NULL,
        submitted_at TIMESTAMPTZ NOT NULL
      )
    `)
    await db.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NULL,
        user_id UUID NULL,
        action VARCHAR(255) NOT NULL,
        resource_type VARCHAR(255) NOT NULL,
        resource_id UUID NULL,
        status VARCHAR(50) NOT NULL,
        details JSONB NULL,
        ip_address VARCHAR(45) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  }
}

/**
 * Factory to create database manager
 */
export function createDbManager(): DbManager {
  return new DbManager()
}
