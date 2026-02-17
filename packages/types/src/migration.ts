/**
 * Type definitions for migration and versioning system
 * Used across domain-core, API, and worker layers
 */

/**
 * Semantic Version representation (X.Y.Z only, no pre-releases)
 */
export interface SemVer {
  major: number
  minor: number
  patch: number
}

/**
 * Status of a migration execution
 */
export enum MigrationStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

/**
 * Retention policy for upgrade snapshots
 */
export enum RetentionPolicy {
  MANUAL = 'MANUAL',
  AUTO_DELETE_30D = 'AUTO_DELETE_30D',
}

/**
 * Migration file metadata
 */
export interface MigrationFile {
  filename: string // e.g., "001_platform_foundation.sql"
  checksum: string // SHA-256 hex string
  targetSchemaVersion: string // e.g., "1.0.0"
  targetProductVersion?: string // e.g., "1.0.0" (optional, if required by migration)
  isBreaking: boolean // true if contains destructive operations
}

/**
 * Upgrade job submitted to worker
 */
export interface UpgradeJob {
  upgradeId: string
  workspace_id: string
  targetSchemaVersion: string
  migrationsToApply: MigrationFile[]
  snapshotId?: string
  operatorId?: string
  dryRun?: boolean
  correlationId: string
  createdAt: Date
}

/**
 * Schema version record in tenant database (singleton)
 */
export interface SchemaVersionRecord {
  id: string
  version: string // e.g., "1.0.0"
  applied_at: Date
}

/**
 * Migration registry entry (immutable audit log)
 */
export interface MigrationRegistryEntry {
  id: string
  workspace_id: string
  migration_file: string
  target_schema_version: string
  checksum: string
  applied_at: Date
  execution_time_ms?: number
  status: MigrationStatus
  error_message?: string
  operator_id?: string
  snapshot_id?: string
}

/**
 * Snapshot metadata record
 */
export interface SnapshotRecord {
  id: string
  workspace_id: string
  previous_schema_version: string
  target_schema_version: string
  snapshot_location: string // S3 path or similar
  snapshot_size_bytes: number
  created_at: Date
  expires_at: Date
  retention_policy: RetentionPolicy
  restored_at?: Date
}

/**
 * Result of a migration execution
 */
export interface MigrationResult {
  success: boolean
  workspace_id: string
  previousVersion: string
  newVersion: string
  executionTimeMs: number
  migrationsApplied: number
  error?: {
    code: string
    message: string
  }
}

/**
 * Upgrade status for polling
 */
export interface UpgradeStatus {
  upgradeId: string
  workspace_id: string
  status: 'QUEUED' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED'
  progressPercent: number
  targetVersion: string
  currentVersion: string
  createdAt: Date
  completedAt?: Date
  error?: {
    code: string
    message: string
  }
}
