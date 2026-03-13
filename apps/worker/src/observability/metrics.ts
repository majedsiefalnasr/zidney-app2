/**
 * Metrics Emitter
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Collects and emits provisioning metrics.
 * Tracks duration, success/failure counts, retry counts, lock wait times.
 * Exports metrics for monitoring and alerting.
 */

/**
 * Provisioning metrics snapshot
 */
export interface ProvisioningMetrics {
  provisioning_duration_ms: number
  provisioning_success_count: number
  provisioning_failure_count: number
  provisioning_retry_count: number
  provisioning_lock_wait_ms: number
  tenants_registry_total_workspaces: number
  active_jobs: number
  queued_jobs: number
  dlq_jobs: number
  timestamp: string
}

/**
 * Emitter configuration
 */
export interface MetricsEmitterConfig {
  namespace?: string
  enabled?: boolean
  exportIntervalMs?: number
}

/**
 * aggregated metrics state
 */
interface MetricsState {
  successCount: number
  failureCount: number
  retryCount: number
  totalDurationMs: number
  lockWaitMs: number
  lockAcquisitions: number
  workspaceCount: number
  sampledDurations: number[]
  sampledLockWaits: number[]
}

/**
 * Metrics Emitter Service
 */
export class MetricsEmitter {
  private config: Required<MetricsEmitterConfig>
  private state: MetricsState
  private logger?: {
    logStep?: (id: string, message: string, ctx?: Record<string, unknown>) => void
    logError?: (message: string, error: Error) => void
  }
  private metricsCallbacks: Array<(metrics: ProvisioningMetrics) => void> = []

  constructor(
    config: MetricsEmitterConfig = {},
    logger?: {
      logStep?: (id: string, message: string, ctx?: Record<string, unknown>) => void
      logError?: (message: string, error: Error) => void
    }
  ) {
    this.config = {
      namespace: 'provisioning',
      enabled: true,
      exportIntervalMs: 60000, // 1 minute
      ...config,
    }

    this.state = {
      successCount: 0,
      failureCount: 0,
      retryCount: 0,
      totalDurationMs: 0,
      lockWaitMs: 0,
      lockAcquisitions: 0,
      workspaceCount: 0,
      sampledDurations: [],
      sampledLockWaits: [],
    }

    this.logger = logger
  }

  /**
   * Record a successful provisioning
   */
  recordSuccess(durationMs: number, lockWaitMs?: number): void {
    if (!this.config.enabled) return

    this.state.successCount++
    this.state.totalDurationMs += durationMs
    this.state.sampledDurations.push(durationMs)

    if (lockWaitMs !== undefined) {
      this.state.lockWaitMs += lockWaitMs
      this.state.lockAcquisitions++
      this.state.sampledLockWaits.push(lockWaitMs)
    }

    // Keep only last 100 samples for statistics
    if (this.state.sampledDurations.length > 100) {
      this.state.sampledDurations.shift()
    }
    if (this.state.sampledLockWaits.length > 100) {
      this.state.sampledLockWaits.shift()
    }

    this.logger?.logStep('metrics-success', 'Provisioning success recorded', {
      duration_ms: durationMs,
      lock_wait_ms: lockWaitMs,
    })
  }

  /**
   * Record a failed provisioning
   */
  recordFailure(durationMs: number, errorCode?: string): void {
    if (!this.config.enabled) return

    this.state.failureCount++
    this.logger?.logStep('metrics-failure', 'Provisioning failure recorded', {
      duration_ms: durationMs,
      error_code: errorCode,
    })
  }

  /**
   * Record a retry
   */
  recordRetry(retryAttempt: number): void {
    if (!this.config.enabled) return

    this.state.retryCount++
    this.logger?.logStep('metrics-retry', 'Provisioning retry recorded', {
      retry_attempt: retryAttempt,
    })
  }

  /**
   * Update workspace count
   */
  setWorkspaceCount(count: number): void {
    if (!this.config.enabled) return

    this.state.workspaceCount = count
  }

  /**
   * Record lock acquisition metrics
   */
  recordLockAcquisition(waitMs: number): void {
    if (!this.config.enabled) return

    this.state.lockWaitMs += waitMs
    this.state.lockAcquisitions++
    this.state.sampledLockWaits.push(waitMs)

    if (this.state.sampledLockWaits.length > 100) {
      this.state.sampledLockWaits.shift()
    }
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): ProvisioningMetrics {
    return {
      provisioning_duration_ms:
        this.state.successCount > 0
          ? Math.round(this.state.totalDurationMs / this.state.successCount)
          : 0,
      provisioning_success_count: this.state.successCount,
      provisioning_failure_count: this.state.failureCount,
      provisioning_retry_count: this.state.retryCount,
      provisioning_lock_wait_ms:
        this.state.lockAcquisitions > 0
          ? Math.round(this.state.lockWaitMs / this.state.lockAcquisitions)
          : 0,
      tenants_registry_total_workspaces: this.state.workspaceCount,
      active_jobs: 0, // Would be populated from queue consumer
      queued_jobs: 0, // Would be populated from Redis
      dlq_jobs: 0, // Would be populated from DLQ
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Subscribe to metrics exports
   */
  onMetricsExport(callback: (metrics: ProvisioningMetrics) => void): void {
    this.metricsCallbacks.push(callback)
  }

  /**
   * Emit current metrics to all subscribers
   */
  private emitMetrics(): void {
    const metrics = this.getMetrics()
    for (const callback of this.metricsCallbacks) {
      try {
        callback(metrics)
      } catch (error) {
        this.logger?.logError(
          'Metrics export callback failed',
          error instanceof Error ? error : new Error(String(error))
        )
      }
    }
  }

  /**
   * Start periodic metrics export
   */
  startExport(): void {
    if (!this.config.enabled) return

    setInterval(() => {
      this.emitMetrics()
    }, this.config.exportIntervalMs)

    this.logger?.logStep('metrics-export-started', 'Metrics export started', {
      interval_ms: this.config.exportIntervalMs,
    })
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.state = {
      successCount: 0,
      failureCount: 0,
      retryCount: 0,
      totalDurationMs: 0,
      lockWaitMs: 0,
      lockAcquisitions: 0,
      workspaceCount: 0,
      sampledDurations: [],
      sampledLockWaits: [],
    }
  }

  /**
   * Get percentile statistics for debugging
   */
  getStats() {
    const sortedDurations = [...this.state.sampledDurations].sort((a, b) => a - b)
    const sortedLockWaits = [...this.state.sampledLockWaits].sort((a, b) => a - b)

    return {
      duration_p50: sortedDurations[Math.floor(sortedDurations.length * 0.5)] || 0,
      duration_p95: sortedDurations[Math.floor(sortedDurations.length * 0.95)] || 0,
      duration_p99: sortedDurations[Math.floor(sortedDurations.length * 0.99)] || 0,
      lock_wait_p50: sortedLockWaits[Math.floor(sortedLockWaits.length * 0.5)] || 0,
      lock_wait_p95: sortedLockWaits[Math.floor(sortedLockWaits.length * 0.95)] || 0,
      lock_wait_p99: sortedLockWaits[Math.floor(sortedLockWaits.length * 0.99)] || 0,
    }
  }
}

/**
 * Factory to create metrics emitter
 */
export function createMetricsEmitter(
  config: MetricsEmitterConfig = {},
  logger?: {
    logStep?: (id: string, message: string, ctx?: Record<string, unknown>) => void
    logError?: (message: string, error: Error) => void
  }
): MetricsEmitter {
  return new MetricsEmitter(config, logger)
}
