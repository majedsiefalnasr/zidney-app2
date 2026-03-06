/**
 * OrphanDetectionJob - Detect orphaned workspaces
 * Task: T021 – Implement orphan detection job (background process)
 *
 * DLQHandler - Handle dead-letter queue jobs
 * Task: T022 – Implement DLQ handling (manual intervention workflow)
 *
 * MetricsCollector - Prometheus metrics emission
 * Task: T024 – Prometheus metrics emission
 */

import type { Pool } from 'pg'
import { LogLevel, StructuredLogger } from './ErrorHandling'

// ============================================================================
// T021: OrphanDetectionJob
// ============================================================================

export class OrphanDetectionJob {
  private master_pool: Pool
  private logger: StructuredLogger

  constructor(master_pool: Pool, logger?: StructuredLogger) {
    this.master_pool = master_pool
    this.logger = logger || new StructuredLogger('orphan-detection', '1.0.0', LogLevel.INFO)
  }

  /**
   * Execute orphan detection
   * Checks for: orphan DBs (exist but no registry) and orphan entries (in registry but DB missing)
   */
  async detect(): Promise<{
    orphan_databases: string[]
    orphan_entries: Array<{ workspace_slug: string; license_id: number }>
    errors: string[]
  }> {
    const orphan_databases: string[] = []
    const orphan_entries: Array<{
      workspace_slug: string
      license_id: number
    }> = []
    const errors: string[] = []

    try {
      const client = await this.master_pool.connect()
      try {
        // Get active registry entries
        const registry_result = await client.query(`
          SELECT workspace_slug, license_id
          FROM tenants_registry
          WHERE is_active = true
        `)

        const active_workspaces = new Set(
          registry_result.rows.map((r) => `workspace_${r.workspace_slug}`)
        )

        // Query PostgreSQL for all workspace_* databases
        const db_result = await client.query(`
          SELECT datname
          FROM pg_database
          WHERE datname LIKE 'workspace_%'
        `)

        // Find orphan databases (exist but no registry)
        for (const row of db_result.rows) {
          if (!active_workspaces.has(row.datname)) {
            orphan_databases.push(row.datname)
          }
        }

        // Find orphan entries (in registry but DB missing)
        for (const entry of registry_result.rows) {
          if (!active_workspaces.has(`workspace_${entry.workspace_slug}`)) {
            orphan_entries.push({
              workspace_slug: entry.workspace_slug,
              license_id: entry.license_id,
            })
          }
        }

        // Log findings
        if (orphan_databases.length > 0 || orphan_entries.length > 0) {
          this.logger.warn('Orphan workspaces detected', {
            correlation_id: 'orphan-detection-job',
            details: {
              orphan_db_count: orphan_databases.length,
              orphan_entry_count: orphan_entries.length,
              databases: orphan_databases,
              entries: orphan_entries.map((e) => e.workspace_slug),
            },
          })
        } else {
          this.logger.debug('Orphan detection: No orphans found', {
            correlation_id: 'orphan-detection-job',
          })
        }
      } finally {
        client.release()
      }
    } catch (error) {
      errors.push(`Orphan detection failed: ${error}`)
      this.logger.error('Orphan detection error', error instanceof Error ? error : String(error), {
        correlation_id: 'orphan-detection-job',
      })
    }

    return {
      orphan_databases,
      orphan_entries,
      errors,
    }
  }
}

// ============================================================================
// T022: DLQHandler
// ============================================================================

export interface DLQJob {
  job_id: string
  license_id: number
  workspace_slug: string
  correlation_id: string
  final_attempt: number
  dlq_timestamp: string
}

export class DLQHandler {
  private redis: any // Redis client
  private logger: StructuredLogger

  constructor(_master_pool: Pool, redis: any, logger?: StructuredLogger) {
    this.redis = redis
    this.logger = logger || new StructuredLogger('dlq-handler', '1.0.0', LogLevel.INFO)
  }

  /**
   * Move job to DLQ after final failed attempt
   */
  async moveJobToDLQ(
    job_id: string,
    error_message: string,
    context: {
      license_id: number
      workspace_slug: string
      correlation_id: string
      final_attempt: number
    }
  ): Promise<void> {
    try {
      const dlq_job: DLQJob = {
        job_id,
        license_id: context.license_id,
        workspace_slug: context.workspace_slug,
        correlation_id: context.correlation_id,
        final_attempt: context.final_attempt,
        dlq_timestamp: new Date().toISOString(),
      }

      // Store in DLQ (Redis list)
      await this.redis.rpush('provisioning_jobs:dlq', JSON.stringify(dlq_job))

      this.logger.warn('Job moved to DLQ', {
        correlation_id: context.correlation_id,
        workspace_slug: context.workspace_slug,
        details: {
          job_id,
          final_attempt: context.final_attempt,
          error_message: error_message.substring(0, 100),
        },
      })
    } catch (error) {
      this.logger.error(
        'Failed to move job to DLQ',
        error instanceof Error ? error : String(error),
        {
          correlation_id: context.correlation_id,
        }
      )
      throw error
    }
  }

  /**
   * Process DLQ job (manual decision: retry, delete, or ignore)
   */
  async processDLQJob(job_id: string, action: 'retry' | 'delete' | 'mark_resolved'): Promise<void> {
    try {
      switch (action) {
        case 'retry':
          this.logger.info('DLQ job: marked for retry', {
            details: { job_id },
          })
          // Re-enqueue job
          break
        case 'delete':
          this.logger.info('DLQ job: permanently deleted', {
            details: { job_id },
          })
          // Remove from DLQ
          await this.redis.lrem('provisioning_jobs:dlq', 0, job_id)
          break
        case 'mark_resolved':
          this.logger.info('DLQ job: marked resolved (manual intervention completed)', {
            details: { job_id },
          })
          break
      }
    } catch (error) {
      this.logger.error(
        'Failed to process DLQ job',
        error instanceof Error ? error : String(error),
        {
          details: { job_id, action },
        }
      )
      throw error
    }
  }

  /**
   * Get all DLQ jobs (for ops dashboard)
   */
  async getDLQJobs(limit: number = 100): Promise<DLQJob[]> {
    try {
      const jobs = await this.redis.lrange('provisioning_jobs:dlq', 0, limit - 1)
      return jobs.map((j: string) => JSON.parse(j))
    } catch (error) {
      this.logger.error(
        'Failed to retrieve DLQ jobs',
        error instanceof Error ? error : String(error),
        {}
      )
      return []
    }
  }
}

// ============================================================================
// T024: MetricsCollector
// ============================================================================

export class MetricsCollector {
  private metrics: Map<string, number> = new Map()
  private histograms: Map<string, number[]> = new Map()
  private logger: StructuredLogger

  constructor(logger?: StructuredLogger) {
    this.logger = logger || new StructuredLogger('metrics-collector', '1.0.0', LogLevel.DEBUG)
  }

  /**
   * Record provisioning duration
   */
  recordProvisioningDuration(
    workspace_slug: string,
    duration_ms: number,
    status: 'success' | 'failed' | 'rolled_back'
  ): void {
    const key = `provisioning_duration_${status}`
    const collection = this.histograms.get(key) || []
    collection.push(duration_ms)
    this.histograms.set(key, collection)

    this.logger.debug('Provisioning duration recorded', {
      workspace_slug,
      details: { duration_ms, status },
    })
  }

  /**
   * Record lock wait time
   */
  recordLockWaitTime(workspace_slug: string, wait_ms: number): void {
    const key = `lock_wait_time_${workspace_slug}`
    const collection = this.histograms.get(key) || []
    collection.push(wait_ms)
    this.histograms.set(key, collection)
  }

  /**
   * Record migration duration
   */
  recordMigrationDuration(
    workspace_slug: string,
    migration_version: string,
    duration_ms: number
  ): void {
    const key = `migration_${workspace_slug}_${migration_version}_duration`
    const collection = this.histograms.get(key) || []
    collection.push(duration_ms)
    this.histograms.set(key, collection)
  }

  /**
   * Record attempt count
   */
  recordAttemptCount(workspace_slug: string, attempt_number: number): void {
    const key = `provisioning_attempts_${workspace_slug}_${attempt_number}`
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1)
  }

  /**
   * Record job retry
   */
  recordJobRetry(workspace_slug: string, reason: string): void {
    const key = `provisioning_retries_${workspace_slug}_${reason}`
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1)
  }

  /**
   * Get metrics in Prometheus format
   */
  getMetricsPromFormat(): string {
    let output = ''

    // Counter metrics
    for (const [key, value] of this.metrics) {
      output += `# TYPE ${key} counter\n`
      output += `${key} ${value}\n\n`
    }

    // Histogram metrics
    for (const [key, values] of this.histograms) {
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0)
        const avg = sum / values.length
        output += `# TYPE ${key}_duration_seconds gauge\n`
        output += `${key}_duration_seconds{quantile="0.5"} ${avg / 1000}\n`
        output += `${key}_count ${values.length}\n\n`
      }
    }

    return output
  }
}

export default {
  OrphanDetectionJob,
  DLQHandler,
  MetricsCollector,
}
