/**
 * Migration execution phase (Task 26)
 * Single atomic transaction for all migrations + version updates
 */

import { runTenantMigrations } from '@zidney/domain-core/migration/tenant-migration-runner'
import { Pool } from 'pg'
import { acquireWorkspaceLock } from './lock-manager'
import { SchemaMigrationJob } from './schema-migration-job'

/**
 * Execute migration phase within single transaction
 * Preconditions: Snapshot already created, license validated
 */
export async function executeMigrationPhase(
  job: SchemaMigrationJob,
  masterDb: Pool,
  tenantDb: Pool,
  workspace_slug: string
): Promise<{ success: boolean; error?: any }> {
  const { workspace_id, target_schema_version, correlation_id, operator_id } =
    job

  try {
    // Acquire write lock (times out after 60s)
    await acquireWorkspaceLock(workspace_id, masterDb, 60000)

    // Run migrations within transaction
    const result = await runTenantMigrations(
      {
        workspace_id,
        workspace_slug,
        connection_pool: tenantDb,
        masterDb,
        correlationId: correlation_id,
      },
      {
        upgradeId: job.job_type,
        workspace_id,
        targetSchemaVersion: target_schema_version,
        migrationsToApply: [
          {
            filename: 'placeholder.sql',
            checksum: '',
            targetSchemaVersion: target_schema_version,
            isBreaking: false,
          },
        ],
        snapshotId: job.snapshot_metadata?.snapshot_id,
        operatorId: operator_id,
        correlationId: correlation_id,
        createdAt: new Date(),
      }
    )

    console.log(
      JSON.stringify({
        level: 'INFO',
        service: 'worker-upgrade',
        event: 'migration_phase_completed',
        correlation_id,
        workspace_id,
        target_version: target_schema_version,
        migrations_applied: result.migrationsApplied,
        execution_time_ms: result.executionTimeMs,
        timestamp: new Date().toISOString(),
      })
    )

    return { success: true }
  } catch (err: any) {
    console.log(
      JSON.stringify({
        level: 'ERROR',
        service: 'worker-upgrade',
        event: 'migration_phase_failed',
        correlation_id,
        workspace_id,
        error_code: err.errorCode || 'MIGRATION_EXECUTION_FAILED',
        error_message: err.message,
        timestamp: new Date().toISOString(),
      })
    )

    return { success: false, error: err }
  }
}
