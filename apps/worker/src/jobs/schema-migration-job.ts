/**
 * Worker job schemas and types (Task 23)
 * Message formats for schema-migrations and rollback queues
 */

/**
 * Schema migration job (STAGE_02C)
 * Queued by API, processed by Worker
 */
export interface SchemaMigrationJob {
  job_type: 'SCHEMA_MIGRATION'
  workspace_id: string
  workspace_slug: string
  target_schema_version: string // X.Y.Z
  correlation_id: string
  snapshot_metadata?: {
    location: string
    snapshot_id: string
    size_bytes: number
    created_at: string // ISO8601
  }
  migrations_to_apply: Array<{
    filename: string
    checksum: string
    target_version: string
    required_product_version?: string
  }>
  operator_id?: string
  attempt?: number // Internal: incremented on retry
  createdAt?: string // ISO8601
}

/**
 * Schema rollback job
 * Queued by API, processed by Worker
 */
export interface SchemaRollbackJob {
  job_type: 'SCHEMA_ROLLBACK'
  workspace_id: string
  workspace_slug: string
  snapshot_id: string
  rollback_id: string
  correlation_id: string
  operator_id?: string
  attempt?: number
  createdAt?: string
}

/**
 * Union type for all schema jobs
 */
export type SchemaJob = SchemaMigrationJob | SchemaRollbackJob

/**
 * Validate job schema
 */
export function validateSchemaMigrationJob(job: any): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (job.job_type !== 'SCHEMA_MIGRATION') {
    errors.push('job_type must be SCHEMA_MIGRATION')
  }

  if (!job.workspace_id) {
    errors.push('workspace_id is required')
  }

  if (!job.workspace_slug) {
    errors.push('workspace_slug is required')
  }

  if (!job.target_schema_version) {
    errors.push('target_schema_version is required')
  } else if (!/^\d+\.\d+\.\d+$/.test(job.target_schema_version)) {
    errors.push(`Invalid version format: ${job.target_schema_version}`)
  }

  if (!job.correlation_id) {
    errors.push('correlation_id is required')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function validateSchemaRollbackJob(job: any): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (job.job_type !== 'SCHEMA_ROLLBACK') {
    errors.push('job_type must be SCHEMA_ROLLBACK')
  }

  if (!job.workspace_id) {
    errors.push('workspace_id is required')
  }

  if (!job.snapshot_id) {
    errors.push('snapshot_id is required')
  }

  if (!job.correlation_id) {
    errors.push('correlation_id is required')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
