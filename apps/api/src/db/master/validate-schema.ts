/**
 * Master Database Schema Validation for MMC Dashboard
 *
 * Purpose:
 * - Validate schema version compatibility (>= 1.1.0 for dashboard support)
 * - Verify all required tables exist
 * - Verify all required indexes exist
 * - Return detailed compatibility report
 *
 * File: apps/api/src/db/master/validate-schema.ts
 * Task: T001
 * Phase: 0 - Setup & Preparation
 *
 * Constitutional Compliance:
 * ✓ Schema compatibility check executed before route handling
 * ✓ Returns 426 if incompatible (via middleware, not here)
 * ✓ Structured logging with correlation_id
 * ✓ No tenant database queries (master_db only)
 */

import type { Logger } from '@zidney/logger'
import type { Pool, PoolClient } from 'pg'

export interface SchemaValidationResult {
  isCompatible: boolean
  schemaVersion: string | null
  requiredVersion: string
  tables: {
    name: string
    exists: boolean
    indexCount: number
    requiredIndexes: string[]
    missingIndexes: string[]
  }[]
  missingTables: string[]
  missingIndexes: Map<string, string[]>
  errors: string[]
}

export class SchemaValidator {
  private pool: Pool
  private logger: Logger

  // Required tables for dashboard functionality
  private readonly REQUIRED_TABLES = [
    'licenses',
    'products',
    'mmc_members',
    'affiliates',
    'affiliate_usages',
    'revenue_records',
  ]

  // Required indexes by table for performance guarantee (<300ms)
  private readonly REQUIRED_INDEXES: Record<string, string[]> = {
    licenses: ['idx_licenses_status', 'idx_licenses_deleted_at', 'idx_licenses_workspace_slug'],
    products: ['idx_products_id', 'idx_products_slug'],
    revenue_records: [
      'idx_revenue_records_created_at',
      'idx_revenue_records_product_id',
      'idx_revenue_records_product_created',
      'idx_revenue_records_billing_country',
    ],
    affiliate_usages: [
      'idx_affiliate_usages_affiliate_id',
      'idx_affiliate_usages_created_at',
      'idx_affiliate_usages_affiliate_created',
    ],
    affiliates: ['idx_affiliates_status'],
  }

  // Minimum schema version required for dashboard
  private readonly MIN_SCHEMA_VERSION = '1.1.0'

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool
    this.logger = logger
  }

  /**
   * Validate complete schema for dashboard compatibility
   */
  async validate(correlationId: string): Promise<SchemaValidationResult> {
    const client = await this.pool.connect()

    try {
      const result: SchemaValidationResult = {
        isCompatible: false,
        schemaVersion: null,
        requiredVersion: this.MIN_SCHEMA_VERSION,
        tables: [],
        missingTables: [],
        missingIndexes: new Map(),
        errors: [],
      }

      // Step 1: Check schema version
      const versionResult = await this.checkSchemaVersion(client, correlationId)
      result.schemaVersion = versionResult.version
      if (!versionResult.isCompatible) {
        result.errors.push(
          `Schema version ${versionResult.version} is below required ${this.MIN_SCHEMA_VERSION}`
        )
      }

      // Step 2: Check required tables
      for (const tableName of this.REQUIRED_TABLES) {
        const tableExists = await this.tableExists(client, tableName)

        if (!tableExists) {
          result.missingTables.push(tableName)
          result.tables.push({
            name: tableName,
            exists: false,
            indexCount: 0,
            requiredIndexes: this.REQUIRED_INDEXES[tableName] || [],
            missingIndexes: this.REQUIRED_INDEXES[tableName] || [],
          })
        } else {
          // Table exists; check indexes
          const requiredIndexes = this.REQUIRED_INDEXES[tableName] || []
          const existingIndexes = await this.getTableIndexes(client, tableName)
          const missingIndexes = requiredIndexes.filter((idx) => !existingIndexes.includes(idx))

          result.tables.push({
            name: tableName,
            exists: true,
            indexCount: existingIndexes.length,
            requiredIndexes,
            missingIndexes,
          })

          if (missingIndexes.length > 0) {
            result.missingIndexes.set(tableName, missingIndexes)
          }
        }
      }

      // Step 3: Determine compatibility
      result.isCompatible =
        versionResult.isCompatible &&
        result.missingTables.length === 0 &&
        result.missingIndexes.size === 0 &&
        result.errors.length === 0

      // Step 4: Log validation result
      this.logger.info('Schema validation completed', {
        correlation_id: correlationId,
        service: 'schema-validator',
        isCompatible: result.isCompatible,
        schemaVersion: result.schemaVersion,
        missingTables: result.missingTables.length,
        missingIndexes: Array.from(result.missingIndexes.keys()).length,
        errorCount: result.errors.length,
      })

      return result
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown validation error'

      this.logger.error('Schema validation failed', {
        correlation_id: correlationId,
        service: 'schema-validator',
        error: {
          code: 'VALIDATION_ERROR',
          message: errorMsg,
        },
      })

      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Check if schema version is compatible
   *
   * Checks:
   * - schema_versions table exists
   * - Latest version is >= MIN_SCHEMA_VERSION
   * - Handles case where table doesn't exist yet (pre-bootstrap)
   */
  private async checkSchemaVersion(
    client: PoolClient,
    correlationId: string
  ): Promise<{ version: string; isCompatible: boolean }> {
    try {
      // Check if schema_versions table exists
      const tableCheckResult = await client.query(
        `SELECT EXISTS(
          SELECT FROM information_schema.tables 
          WHERE table_name = 'schema_versions'
        )`
      )

      if (!tableCheckResult.rows[0].exists) {
        this.logger.warn('schema_versions table not found (pre-bootstrap)', {
          correlation_id: correlationId,
          phase: 'schema-check',
        })
        // Return version 1.0.0 as baseline
        return { version: '1.0.0', isCompatible: false }
      }

      // Get latest schema version
      const result = await client.query(
        `SELECT version FROM schema_versions ORDER BY applied_at DESC LIMIT 1`
      )

      if (result.rows.length === 0) {
        return { version: '1.0.0', isCompatible: false }
      }

      const version = result.rows[0].version
      const isCompatible = this.compareVersions(version, this.MIN_SCHEMA_VERSION) >= 0

      return { version, isCompatible }
    } catch (_error) {
      // If schema_versions doesn't exist, return 1.0.0 (pre-bootstrap state)
      return { version: '1.0.0', isCompatible: false }
    }
  }

  /**
   * Check if table exists in master_db
   */
  private async tableExists(client: PoolClient, tableName: string): Promise<boolean> {
    const result = await client.query(
      `SELECT EXISTS(
        SELECT FROM information_schema.tables 
        WHERE table_name = $1
      )`,
      [tableName]
    )

    return result.rows[0].exists
  }

  /**
   * Get all indexes for a table
   */
  private async getTableIndexes(client: PoolClient, tableName: string): Promise<string[]> {
    const result = await client.query(`SELECT indexname FROM pg_indexes WHERE tablename = $1`, [
      tableName,
    ])

    return result.rows.map((row) => row.indexname)
  }

  /**
   * Compare semantic versions
   *
   * Returns:
   * - 1 if version1 > version2
   * - 0 if equal
   * - -1 if version1 < version2
   */
  private compareVersions(version1: string, version2: string): number {
    const v1 = version1.split('.').map(Number)
    const v2 = version2.split('.').map(Number)

    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const v1Part = v1[i] || 0
      const v2Part = v2[i] || 0

      if (v1Part > v2Part) return 1
      if (v1Part < v2Part) return -1
    }

    return 0
  }

  /**
   * Generate SQL for creating missing tables and indexes
   *
   * Useful for manual remediation
   */
  async generateRemediationSQL(validationResult: SchemaValidationResult): Promise<string> {
    let sql = '-- Schema Remediation SQL\n\n'

    // Add instructions for missing tables
    if (validationResult.missingTables.length > 0) {
      sql += `-- MISSING TABLES (${validationResult.missingTables.length}):\n`
      for (const table of validationResult.missingTables) {
        sql += `-- TODO: Create ${table} table\n`
      }
      sql += '\n'
    }

    // Add instructions for missing indexes
    if (validationResult.missingIndexes.size > 0) {
      sql += `-- MISSING INDEXES (${Array.from(validationResult.missingIndexes.values()).flat().length}):\n`
      for (const [tableName, indexes] of validationResult.missingIndexes) {
        sql += `-- For table ${tableName}:\n`
        for (const indexName of indexes) {
          sql += `-- TODO: Create index ${indexName}\n`
        }
      }
    }

    return sql
  }
}

export default SchemaValidator
