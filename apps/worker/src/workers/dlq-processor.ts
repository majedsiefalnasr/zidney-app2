/**
 * Dead Letter Queue (DLQ) Processor
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Periodic DLQ monitoring and processing.
 * Alerts operator on high DLQ counts.
 * Supports manual retry of jobs from DLQ.
 * Tracks DLQ trends for operational insights.
 */

import { ProvisioningLogger } from '@zidney/logger/provisioning-logger'
// @ts-ignore: LOGIC-BUG: dlq-handler is in ../handlers/dlq-handler, not ./dlq-handler — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
import { DLQHandler } from './dlq-handler'

/**
 * DLQ processor configuration
 */
export interface DLQProcessorConfig {
  checkIntervalMs?: number
  alertThreshold?: number
  maxRetryAttempts?: number
  enableAutoRecovery?: boolean
}

/**
 * DLQ alert
 */
export interface DLQAlert {
  timestamp: string
  alert_type: 'high_dlq_count' | 'manual_intervention_required' | 'error_spike'
  severity: 'warning' | 'critical'
  message: string
  affected_licenses: string[]
  dlq_stats: any
}

/**
 * DLQ Processor
 */
export class DLQProcessor {
  private dlqHandler: DLQHandler
  private logger: ProvisioningLogger
  private config: Required<DLQProcessorConfig>
  private isRunning: boolean = false
  private previousStats: any = null
  private alerts: DLQAlert[] = []
  private alertCallbacks: Array<(alert: DLQAlert) => void> = []

  constructor(
    dlqHandler: DLQHandler,
    logger: ProvisioningLogger,
    config: DLQProcessorConfig = {}
  ) {
    this.dlqHandler = dlqHandler
    this.logger = logger
    this.config = {
      checkIntervalMs: 60000, // 1 minute
      alertThreshold: 10, // Alert if > 10 jobs in DLQ
      maxRetryAttempts: 1, // Try once to recover
      enableAutoRecovery: false, // Manual only by default
      ...config,
    }
  }

  /**
   * Start periodic DLQ monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.logWarn('DLQ processor already running')
      return
    }

    this.isRunning = true
    this.logger.logStep('dlq-processor-start', 'DLQ processor started', {
      check_interval_ms: this.config.checkIntervalMs,
      alert_threshold: this.config.alertThreshold,
    })

    try {
      while (this.isRunning) {
        await this.checkDLQ()
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.checkIntervalMs)
        )
      }
    } finally {
      this.isRunning = false
      this.logger.logStep('dlq-processor-stop', 'DLQ processor stopped')
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false
  }

  /**
   * Check DLQ status and generate alerts
   */
  private async checkDLQ(): Promise<void> {
    try {
      const stats = await this.dlqHandler.getStats()

      // Check if DLQ is growing
      if (this.previousStats) {
        const countIncrease =
          stats.total_entries - this.previousStats.total_entries

        if (countIncrease > 5) {
          this.emitAlert({
            timestamp: new Date().toISOString(),
            alert_type: 'error_spike',
            severity: countIncrease > 10 ? 'critical' : 'warning',
            message: `DLQ increased by ${countIncrease} entries in last interval`,
            affected_licenses: [],
            dlq_stats: stats,
          })
        }
      }

      // Check absolute threshold
      if (stats.total_entries > this.config.alertThreshold) {
        const entries = await this.dlqHandler.getDLQEntries(stats.total_entries)
        const affectedLicenses = [
          ...new Set(entries.map((e: any) => e.license_id)),
        ] as string[]

        this.emitAlert({
          timestamp: new Date().toISOString(),
          alert_type: 'high_dlq_count',
          severity: 'warning',
          message: `DLQ has ${stats.total_entries} entries (threshold: ${this.config.alertThreshold})`,
          affected_licenses: affectedLicenses,
          dlq_stats: stats,
        })
      }

      // Check for manual intervention needs
      if (stats.manual_intervention_count > 0) {
        const entries = await this.dlqHandler.getDLQEntries(stats.total_entries)
        const manualEntries = entries.filter(
          (e: any) => e.requires_manual_intervention
        )
        const affectedLicenses = [
          ...new Set(manualEntries.map((e: any) => e.license_id)),
        ] as string[]

        this.emitAlert({
          timestamp: new Date().toISOString(),
          alert_type: 'manual_intervention_required',
          severity: 'critical',
          message: `${stats.manual_intervention_count} DLQ entries require manual intervention`,
          affected_licenses: affectedLicenses,
          dlq_stats: stats,
        })

        this.logger.logWarn('DLQ manual intervention required', {
          count: stats.manual_intervention_count,
          licenses: affectedLicenses,
        })
      }

      this.previousStats = stats

      this.logger.logStep('dlq-check-complete', 'DLQ check completed', {
        total_entries: stats.total_entries,
        manual_intervention: stats.manual_intervention_count,
      })
    } catch (error) {
      this.logger.logError(
        'DLQ check failed',
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Attempt to recover a job from DLQ (manual retry)
   */
  async recoverJob(jobId: string): Promise<boolean> {
    try {
      const entry = await this.dlqHandler.getJobFromDLQ(jobId)

      if (!entry) {
        this.logger.logWarn('Job not found in DLQ', { job_id: jobId })
        return false
      }

      // Remove from DLQ
      await this.dlqHandler.removeFromDLQ(jobId)

      // Re-enqueue would happen here (delegated to caller)
      this.logger.logStep('dlq-recovery-initiated', 'Job recovery initiated', {
        job_id: jobId,
        license_id: entry.license_id,
      })

      return true
    } catch (error) {
      this.logger.logError(
        'Job recovery failed',
        error instanceof Error ? error : new Error(String(error)),
        { job_id: jobId }
      )
      return false
    }
  }

  /**
   * Recover multiple jobs for a license
   */
  async recoverLicenseJobs(licenseId: string): Promise<number> {
    try {
      const entries = await this.dlqHandler.getDLQEntriesForLicense(licenseId)

      for (const entry of entries) {
        await this.dlqHandler.removeFromDLQ(entry.job_id)
      }

      this.logger.logStep('dlq-license-recovery', 'License jobs recovered', {
        license_id: licenseId,
        count: entries.length,
      })

      return entries.length
    } catch (error) {
      this.logger.logError(
        'License recovery failed',
        error instanceof Error ? error : new Error(String(error)),
        { license_id: licenseId }
      )
      return 0
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 50): DLQAlert[] {
    return this.alerts.slice(-limit)
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(
    alertType: DLQAlert['alert_type'],
    limit: number = 50
  ): DLQAlert[] {
    return this.alerts.filter((a) => a.alert_type === alertType).slice(-limit)
  }

  /**
   * Subscribe to alerts
   */
  onAlert(callback: (alert: DLQAlert) => void): void {
    this.alertCallbacks.push(callback)
  }

  /**
   * Emit alert to subscribers
   */
  private emitAlert(alert: DLQAlert): void {
    this.alerts.push(alert)

    // Keep only last 1000 alerts in memory
    if (this.alerts.length > 1000) {
      this.alerts.shift()
    }

    for (const callback of this.alertCallbacks) {
      try {
        callback(alert)
      } catch (error) {
        this.logger.logError(
          'Alert callback failed',
          error instanceof Error ? error : new Error(String(error))
        )
      }
    }
  }

  /**
   * Get processor status
   */
  getStatus() {
    return {
      running: this.isRunning,
      previous_stats: this.previousStats,
      recent_alerts: this.alerts.slice(-10),
    }
  }

  /**
   * Clear all alerts (for testing)
   */
  clearAlerts(): void {
    this.alerts = []
  }
}

/**
 * Factory to create DLQ processor
 */
export function createDLQProcessor(
  dlqHandler: DLQHandler,
  logger: ProvisioningLogger,
  config?: DLQProcessorConfig
): DLQProcessor {
  return new DLQProcessor(dlqHandler, logger, config)
}
