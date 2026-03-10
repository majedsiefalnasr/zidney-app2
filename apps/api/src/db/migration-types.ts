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
  schemaVersions: Record<string, unknown>
  products: Record<string, unknown>
  licenses: Record<string, unknown>
  tenantsRegistry: Record<string, unknown>
  mmcUsers: Record<string, unknown>
  auditLog: Record<string, unknown>
  deadLetterQueue?: Record<string, unknown>
  dlqResolutions?: Record<string, unknown>
}

export interface TenantSchema {
  schemaVersions: Record<string, unknown>
  users: Record<string, unknown>
  divisions: Record<string, unknown>
  exams: Record<string, unknown>
  questions: Record<string, unknown>
  attempts: Record<string, unknown>
  attemptProgress: Record<string, unknown>
  auditLog: Record<string, unknown>
  idempotencyKeys?: Record<string, unknown>
}

/**
 * Migration configuration
 */
export interface MigrationConfig {
  name: string
  version: string
  description: string
  up: (
    db: NodePgDatabase<Record<string, unknown>>,
    schema: MasterSchema | TenantSchema,
    context?: MigrationContext
  ) => Promise<void>
  down: (
    db: NodePgDatabase<Record<string, unknown>>,
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
