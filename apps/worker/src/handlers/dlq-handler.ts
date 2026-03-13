/**
 * Dead Letter Queue (DLQ) Handler
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Captures provisioning jobs that exhaust retry attempts.
 * Stores in Redis DLQ for operator review and manual intervention.
 * Logs all failed jobs with complete context for debugging.
 */

import type { ProvisioningJob } from '@zidney/types/jobs/provisioning-job'
import type { Redis } from 'ioredis'

/**
 * DLQ entry
 */
export interface DLQEntry {
  job_id: string
  license_id: string
  workspace_slug: string
  retry_count: number
  max_retries: number
  error_code?: string
  error_message?: string
  last_error_step?: string
  moved_to_dlq_at: string
  job_payload: ProvisioningJob
  requires_manual_intervention: boolean
  suggested_action: string
}

/**
 * DLQ Handler
 */
export class DLQHandler {
  private redis: Redis
  private dlqName: string
  private logger?: {
    logDLQMove?: (msg: string, meta?: Record<string, unknown>) => void
    logError?: (msg: string, err?: Error | string, meta?: Record<string, unknown>) => void
    logStep?: (step: string, msg: string, meta?: Record<string, unknown>) => void
    logWarn?: (msg: string, meta?: Record<string, unknown>) => void
  }
  private maxDLQRetention: number = 30 * 24 * 60 * 60 // 30 days

  constructor(
    redis: Redis,
    dlqName: string,
    logger?: {
      logDLQMove?: (msg: string, meta?: Record<string, unknown>) => void
      logError?: (msg: string, err?: Error | string, meta?: Record<string, unknown>) => void
      logStep?: (step: string, msg: string, meta?: Record<string, unknown>) => void
      logWarn?: (msg: string, meta?: Record<string, unknown>) => void
    }
  ) {
    this.redis = redis
    this.dlqName = dlqName
    this.logger = logger
  }

  /**
   * Move job to DLQ after max retries exceeded
   */
  async moveJobToDLQ(
    job: ProvisioningJob,
    reason: string,
    errorCode?: string,
    errorMessage?: string
  ): Promise<boolean> {
    try {
      const dlqEntry: DLQEntry = {
        job_id: job.id ?? '',
        license_id: job.licenseId,
        workspace_slug: job.workspaceSlug,
        retry_count: job.retryCount || 0,
        max_retries: job.retryPolicy?.maxRetries || 3,
        error_code: errorCode,
        error_message: errorMessage,
        last_error_step: job.currentStep as string,
        moved_to_dlq_at: new Date().toISOString(),
        job_payload: job,
        requires_manual_intervention: this.requiresManualIntervention(errorCode),
        suggested_action: this.getSuggestedAction(errorCode, reason),
      }

      // Push to DLQ (list)
      await this.redis.lpush(this.dlqName, JSON.stringify(dlqEntry))

      // Store metadata in separate key for quick lookup
      const metaKey = `${this.dlqName}:meta:${job.id ?? ''}`
      await this.redis.setex(
        metaKey,
        this.maxDLQRetention,
        JSON.stringify({
          license_id: job.licenseId,
          workspace_slug: job.workspaceSlug,
          error_code: errorCode,
          moved_at: new Date().toISOString(),
        })
      )

      // Set expiration on the DLQ entry itself
      await this.redis.expire(this.dlqName, this.maxDLQRetention)

      this.logger?.logDLQMove?.('Job moved to DLQ', {
        job_id: job.id ?? '',
        license_id: job.licenseId,
        workspace_slug: job.workspaceSlug,
        reason,
        error_code: errorCode,
        requires_manual: dlqEntry.requires_manual_intervention,
      })

      return true
    } catch (error) {
      this.logger?.logError?.(
        'DLQ operation failed',
        error instanceof Error ? error : String(error),
        { job_id: job.id ?? '' }
      )
      return false
    }
  }

  /**
   * Get all DLQ entries
   */
  async getDLQEntries(limit: number = 100): Promise<DLQEntry[]> {
    try {
      const entries = await this.redis.lrange(this.dlqName, 0, limit - 1)
      return entries.map((entry) => JSON.parse(entry) as DLQEntry)
    } catch (error) {
      this.logger?.logError?.(
        'Failed to retrieve DLQ entries',
        error instanceof Error ? error : String(error)
      )
      return []
    }
  }

  /**
   * Get DLQ size
   */
  async getDLQSize(): Promise<number> {
    try {
      return await this.redis.llen(this.dlqName)
    } catch (error) {
      this.logger?.logError?.(
        'Failed to get DLQ size',
        error instanceof Error ? error : String(error)
      )
      return 0
    }
  }

  /**
   * Get DLQ entries for a specific license
   */
  async getDLQEntriesForLicense(licenseId: string): Promise<DLQEntry[]> {
    try {
      const allEntries = await this.getDLQEntries(1000)
      return allEntries.filter((entry) => entry.license_id === licenseId)
    } catch (error) {
      this.logger?.logError?.(
        'Failed to retrieve DLQ entries for license',
        error instanceof Error ? error : String(error),
        { license_id: licenseId }
      )
      return []
    }
  }

  /**
   * Retrieve a specific job from DLQ
   */
  async getJobFromDLQ(jobId: string): Promise<DLQEntry | null> {
    try {
      const entries = await this.getDLQEntries(1000)
      return entries.find((entry) => entry.job_id === jobId) || null
    } catch (error) {
      this.logger?.logError?.(
        'Failed to retrieve job from DLQ',
        error instanceof Error ? error : String(error),
        { job_id: jobId }
      )
      return null
    }
  }

  /**
   * Remove job from DLQ
   */
  async removeFromDLQ(jobId: string): Promise<boolean> {
    try {
      const entries = await this.getDLQEntries(1000)
      const targetEntry = entries.find((entry) => entry.job_id === jobId)

      if (!targetEntry) {
        return false
      }

      // Remove the entry (crude - better to use a set-based DLQ in production)
      await this.redis.lrem(this.dlqName, 0, JSON.stringify(targetEntry))

      // Clean up metadata
      const metaKey = `${this.dlqName}:meta:${jobId}`
      await this.redis.del(metaKey)

      this.logger?.logStep?.('dlq-remove', 'Job removed from DLQ', {
        job_id: jobId,
      })

      return true
    } catch (error) {
      this.logger?.logError?.(
        'Failed to remove job from DLQ',
        error instanceof Error ? error : String(error),
        { job_id: jobId }
      )
      return false
    }
  }

  /**
   * Get stats on DLQ
   */
  async getStats(): Promise<{
    total_entries: number
    manual_intervention_count: number
    by_error_code: Record<string, number>
  }> {
    try {
      const entries = await this.getDLQEntries(10000)

      const manualInterventionCount = entries.filter((e) => e.requires_manual_intervention).length

      const byErrorCode: Record<string, number> = {}
      for (const entry of entries) {
        const code = entry.error_code || 'unknown'
        byErrorCode[code] = (byErrorCode[code] || 0) + 1
      }

      return {
        total_entries: entries.length,
        manual_intervention_count: manualInterventionCount,
        by_error_code: byErrorCode,
      }
    } catch (error) {
      this.logger?.logError?.(
        'Failed to get DLQ stats',
        error instanceof Error ? error : String(error)
      )
      return {
        total_entries: 0,
        manual_intervention_count: 0,
        by_error_code: {},
      }
    }
  }

  /**
   * Determine if an error requires manual intervention
   */
  private requiresManualIntervention(errorCode?: string): boolean {
    const manualInterventionCodes = [
      'WORKSPACE_SLUG_EXISTS',
      'INVALID_WORKSPACE_SLUG',
      'UNAUTHORIZED_SERVICE',
      'INVALID_LICENSE_CONFIG',
    ]

    return errorCode ? manualInterventionCodes.includes(errorCode) : false
  }

  /**
   * Get suggested action for operator
   */
  private getSuggestedAction(errorCode?: string, reason?: string): string {
    if (errorCode === 'WORKSPACE_SLUG_EXISTS') {
      return 'Check if workspace already exists. If duplicate, update license. If legitimate, cleanup orphan database.'
    }

    if (errorCode === 'INVALID_WORKSPACE_SLUG') {
      return 'Validate workspace slug format (3-255 chars, lowercase, no special chars). Correct and retry.'
    }

    if (errorCode === 'UNAUTHORIZED_SERVICE') {
      return 'Check MMC service credentials. Verify bearer token is current. Update if needed.'
    }

    if (errorCode === 'MIGRATION_FAILED') {
      return 'Review migration logs. Check database state. May need manual database cleanup and retry.'
    }

    if (errorCode === 'DB_CREATE_FAILED') {
      return 'Check PostgreSQL permissions. Verify database naming constraints (max 63 chars). Review PostgreSQL logs.'
    }

    if (errorCode === 'LOCK_TIMEOUT') {
      return 'Another provisioning in progress for this license. Wait and retry, or check for stuck locks.'
    }

    return `Check logs for detailed error message: ${reason || 'See DLQ entry for details'}`
  }

  /**
   * Clear entire DLQ (CAUTION - for recovery only)
   */
  async clear(): Promise<void> {
    try {
      await this.redis.del(this.dlqName)
      this.logger?.logWarn?.('DLQ cleared')
    } catch (error) {
      this.logger?.logError?.('Failed to clear DLQ', error instanceof Error ? error : String(error))
    }
  }
}

/**
 * Factory to create DLQ handler
 */
export function createDLQHandler(
  redis: Redis,
  dlqName: string,
  logger?: {
    logDLQMove?: (msg: string, meta?: Record<string, unknown>) => void
    logError?: (msg: string, err?: Error | string, meta?: Record<string, unknown>) => void
    logStep?: (step: string, msg: string, meta?: Record<string, unknown>) => void
    logWarn?: (msg: string, meta?: Record<string, unknown>) => void
  }
): DLQHandler {
  return new DLQHandler(redis, dlqName, logger)
}
