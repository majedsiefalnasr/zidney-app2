/**
 * Database Migration Type Definitions
 *
 * Type-safe interfaces for database migrations in Zidney.
 * Supports master_db (platform control) and tenant_db (tenant isolation) migrations.
 *
 * Stage: STAGE_09_PRODUCTS
 * ADR-0001: Database per Tenant
 * ADR-0004: Migration Workflow
 */

import type { PoolClient } from 'pg'

/**
 * Base migration interface
 * All migrations must implement this contract
 */
export interface Migration {
  version: string // Semantic version: v1.0.0, v1.1.0, etc.
  description: string // Human-readable description
  up: (client: PoolClient) => Promise<void> // Forward migration
  down?: (client: PoolClient) => Promise<void> // Rollback (snapshot restore only)
  tags?: string[] // Optional tags for categorization (e.g., ['products', 'schema'])
}

/**
 * Migration record in migrations table
 * Tracks which migrations have been applied to database
 */
export interface MigrationRecord {
  id: string // UUID
  version: string
  description: string
  applied_at: Date
  checksum: string // SHA256 of migration file for integrity
  duration_ms: number // Execution time
  applied_by: string // User/service that applied migration
}

/**
 * Migration result
 * Returned after executing a migration
 */
export interface MigrationResult {
  success: boolean
  version: string
  description: string
  duration_ms: number
  error?: string // If failed
  checksum?: string // SHA256 after successful application
}

/**
 * Master DB migration
 * Applied to master_db for platform-wide configuration
 */
export interface MasterMigration extends Migration {
  scope: 'master'
  runOnce?: boolean // If true, only run once across all instances
}

/**
 * Tenant DB migration
 * Applied to each individual tenant database
 */
export interface TenantMigration extends Migration {
  scope: 'tenant'
  applyToExisting?: boolean // If true, apply to existing tenants
}

/**
 * Migration execution context
 * Passed to migration up/down functions
 */
export interface MigrationContext {
  client: PoolClient
  version: string
  isDryRun: boolean
  logger: {
    info(message: string): void
    warn(message: string): void
    error(message: string): void
  }
}

/**
 * Product schema migration type
 * Specific to STAGE_09_PRODUCTS
 */
export interface ProductSchemaMigration extends MasterMigration {
  tags: ['products']
  components: {
    products_table?: boolean
    product_versions_table?: boolean
    product_audit_logs_table?: boolean
    indexes?: boolean
    triggers?: boolean
  }
}

/**
 * Migration metadata
 * Immutable record of migration properties
 */
export interface MigrationMetadata {
  version: string
  description: string
  scope: 'master' | 'tenant'
  tags: string[]
  createdAt: Date
  author?: string // Who created the migration
  breakingChanges?: string[] // List of breaking changes if any
  notes?: string // Additional migration notes
}

/**
 * Migration status enum
 */
export enum MigrationStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  ROLLED_BACK = 'ROLLED_BACK',
}

/**
 * Migration statistics
 * Aggregate data for monitoring
 */
export interface MigrationStats {
  totalMigrations: number
  appliedMigrations: number
  failedMigrations: number
  pendingMigrations: number
  totalDurationMs: number
  averageDurationMs: number
}
