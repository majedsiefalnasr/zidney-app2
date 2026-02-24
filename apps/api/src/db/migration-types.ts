/**
 * Migration Type Definitions
 *
 * Shared types for master and tenant database migrations.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

/**
 * Migration context passed to up/down functions
 */
export interface MigrationContext {
  correlationId?: string
  workspaceSlug?: string
  workspaceId?: string
  schemaVersion?: string
  productVersion?: string
  dryRun?: boolean
}

/**
 * Database schema types for migrations
 */
export interface MasterSchema {
  schemaVersions: any
  products: any
  licenses: any
  tenantsRegistry: any
  mmcUsers: any
  auditLog: any
  deadLetterQueue?: any
  dlqResolutions?: any
}

export interface TenantSchema {
  schemaVersions: any
  users: any
  divisions: any
  exams: any
  questions: any
  attempts: any
  attemptProgress: any
  auditLog: any
  idempotencyKeys?: any
}

/**
 * Migration configuration
 */
export interface MigrationConfig {
  name: string
  version: string
  description: string
  up: (
    db: NodePgDatabase<any>,
    schema: MasterSchema | TenantSchema,
    context?: MigrationContext
  ) => Promise<void>
  down: (
    db: NodePgDatabase<any>,
    schema: MasterSchema | TenantSchema,
    context?: MigrationContext
  ) => Promise<void>
}

/**
 * Migration result
 */
export interface MigrationResult {
  name: string
  version: string
  success: boolean
  durationMs: number
  error?: string
  correlationId?: string
}

/**
 * Migration runner options
 */
export interface MigrationRunnerOptions {
  dryRun?: boolean
  targetVersion?: string
  correlationId?: string
  workspaceSlug?: string
}
