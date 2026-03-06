/**
 * Worker Configuration & Monitoring
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T043
 *
 * Centralized configuration for worker service.
 *
 * Key Responsibilities:
 * - Define operational parameters
 * - Configure retry policies
 * - Set database constraints
 * - Enable monitoring metrics
 *
 * Environment Variables:
 * - MASTER_DB_URL: Master database connection string
 * - WORKER_LOG_LEVEL: Logging level (debug, info, warn, error)
 * - JOB_POLL_INTERVAL_MS: Job polling frequency
 * - JOB_TIMEOUT_MS: Maximum job execution time
 *
 * ADRs: ADR-0001 (tenant isolation)
 */

import { logger } from '@zidney/logger'

/**
 * Environment Handling
 */
const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key]
  if (!value && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} not set`)
  }
  return value || defaultValue!
}

/**
 * Worker Configuration
 */
export const WORKER_CONFIG = {
  // Service Identity
  SERVICE_NAME: 'zidney-worker',
  SERVICE_VERSION: '1.0.0',

  // Job Processing
  MAX_CONCURRENT_JOBS: 12, // Parallel job processing (throughput: 100+ jobs/min)
  JOB_POLL_INTERVAL_MS: 100, // Poll frequency
  JOB_TIMEOUT_MS: 300000, // 5 minutes per job (includes grading + persistence)
  POLL_BACKPRESSURE_MS: 100, // Sleep time when queue empty

  // Retry Strategy
  MAX_RETRIES: 5,
  RETRY_BACKOFF_MS: [1000, 2000, 4000, 8000, 16000], // Exponential backoff
  RETRY_MAX_TOTAL_MS: 31000, // ~31 seconds total retry window

  // DLQ Consumer
  DLQ_POLL_INTERVAL_MS: 1000,
  DLQ_BATCH_SIZE: 10,
  DLQ_BACKPRESSURE_MS: 500,

  // Database
  MASTER_DB_URL: getEnv('MASTER_DB_URL'),
  TENANT_DB_POOL_SIZE: 5,
  QUERY_TIMEOUT_MS: 30000, // 30 seconds per query
  TX_TIMEOUT_MS: 60000, // 60 seconds per transaction

  // Logging
  LOG_LEVEL: (getEnv('WORKER_LOG_LEVEL', 'info') || 'info').toLowerCase(),
  LOG_FORMAT: 'json', // Structured JSON logs
  CORRELATION_ID_PREFIX: 'grading-',

  // Monitoring
  METRICS_ENABLED: getEnv('METRICS_ENABLED', 'true') === 'true',
  HEALTH_CHECK_INTERVAL_MS: 30000,

  // Graceful Shutdown
  SHUTDOWN_TIMEOUT_MS: 30000, // Max time to wait for current job
  DRAIN_TIMEOUT_MS: 60000, // Max time to drain consumed messages
}

/**
 * Metric Collectors
 *
 * Track worker performance and health
 */
export class WorkerMetrics {
  private startTime: Date
  private jobsProcessed: number = 0
  private jobsFailed: number = 0
  private totalGradingTimeMs: number = 0
  private averageGradingSizeMs: number = 0

  constructor() {
    this.startTime = new Date()
  }

  /**
   * Record successful job
   */
  recordJobSuccess(gradingTimeMs: number): void {
    this.jobsProcessed++
    this.totalGradingTimeMs += gradingTimeMs
    this.averageGradingSizeMs = this.totalGradingTimeMs / this.jobsProcessed
  }

  /**
   * Record failed job
   */
  recordJobFailure(): void {
    this.jobsFailed++
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime.getTime()
    const jobsPerMinute = this.jobsProcessed > 0 ? (this.jobsProcessed / uptime) * 60000 : 0
    const failureRate =
      this.jobsProcessed > 0 ? (this.jobsFailed / (this.jobsProcessed + this.jobsFailed)) * 100 : 0

    return {
      jobs_processed: this.jobsProcessed,
      jobs_failed: this.jobsFailed,
      success_rate: 100 - failureRate,
      failure_rate: failureRate,
      jobs_per_minute: Math.round(jobsPerMinute * 100) / 100,
      average_grading_time_ms: Math.round(this.averageGradingSizeMs),
      uptime_ms: uptime,
      timestamp: new Date().toISOString(),
    }
  }
}

/**
 * Configuration Validation
 *
 * Validates worker configuration on startup
 */
export function validateWorkerConfig(): void {
  const errors: string[] = []

  // Check database URL format
  if (!WORKER_CONFIG.MASTER_DB_URL.startsWith('postgresql://')) {
    errors.push('MASTER_DB_URL must start with postgresql://')
  }

  // Check timeout values
  if (WORKER_CONFIG.JOB_TIMEOUT_MS < 10000) {
    errors.push('JOB_TIMEOUT_MS must be at least 10000ms')
  }

  if (WORKER_CONFIG.QUERY_TIMEOUT_MS > WORKER_CONFIG.JOB_TIMEOUT_MS) {
    errors.push('QUERY_TIMEOUT_MS cannot exceed JOB_TIMEOUT_MS')
  }

  // Check retry config
  if (WORKER_CONFIG.MAX_RETRIES < 1 || WORKER_CONFIG.MAX_RETRIES > 10) {
    errors.push('MAX_RETRIES must be between 1 and 10')
  }

  if (WORKER_CONFIG.RETRY_BACKOFF_MS.length !== WORKER_CONFIG.MAX_RETRIES) {
    errors.push('RETRY_BACKOFF_MS length must match MAX_RETRIES')
  }

  // Check pool size
  if (WORKER_CONFIG.TENANT_DB_POOL_SIZE < 1 || WORKER_CONFIG.TENANT_DB_POOL_SIZE > 100) {
    errors.push('TENANT_DB_POOL_SIZE must be between 1 and 100')
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.map((e) => `- ${e}`).join('\n')}`)
  }
}

/**
 * Get configuration summary for logging
 */
export function getConfigSummary(): Record<string, any> {
  return {
    service: WORKER_CONFIG.SERVICE_NAME,
    version: WORKER_CONFIG.SERVICE_VERSION,
    max_concurrent_jobs: WORKER_CONFIG.MAX_CONCURRENT_JOBS,
    job_timeout_ms: WORKER_CONFIG.JOB_TIMEOUT_MS,
    max_retries: WORKER_CONFIG.MAX_RETRIES,
    pool_size: WORKER_CONFIG.TENANT_DB_POOL_SIZE,
    log_level: WORKER_CONFIG.LOG_LEVEL,
    metrics_enabled: WORKER_CONFIG.METRICS_ENABLED,
  }
}

/**
 * Database Configuration
 */
export const DB_CONFIG = {
  // Master database pool
  MASTER_POOL: {
    max: 10,
    idleTimeoutMillis: 900000, // 15 minutes
    connectionTimeoutMillis: 30000,
    allowExitOnIdle: false,
  },

  // Tenant database pool (per workspace)
  TENANT_POOL: {
    max: WORKER_CONFIG.TENANT_DB_POOL_SIZE,
    idleTimeoutMillis: 900000, // 15 minutes
    connectionTimeoutMillis: 30000,
    allowExitOnIdle: false,
  },

  // Query settings
  QUERY_TIMEOUT_MS: WORKER_CONFIG.QUERY_TIMEOUT_MS,
  STATEMENT_TIMEOUT_MS: WORKER_CONFIG.QUERY_TIMEOUT_MS,
  IDLE_IN_TX_SESSION_TIMEOUT_MS: WORKER_CONFIG.TX_TIMEOUT_MS,
}

/**
 * Queue Configuration
 */
export const QUEUE_CONFIG = {
  // Grading jobs table
  GRADING_JOBS_TABLE: 'grading_jobs',
  GRADING_JOBS_PENDING_STATUS: 'PENDING',
  GRADING_JOBS_PROCESSING_STATUS: 'PROCESSING',
  GRADING_JOBS_COMPLETED_STATUS: 'COMPLETED',
  GRADING_JOBS_FAILED_STATUS: 'FAILED',

  // Dead-letter queue table
  FAILED_GRADING_JOBS_TABLE: 'failed_grading_jobs',

  // Queue constraints
  MAX_JOB_PAYLOAD_BYTES: 1024 * 1024, // 1MB
  MAX_RETRY_COUNT: WORKER_CONFIG.MAX_RETRIES,
  JOB_RETENTION_DAYS: 30, // Keep completed jobs for 30 days
}

/**
 * Logging Configuration
 */
export const LOG_CONFIG = {
  LEVEL: WORKER_CONFIG.LOG_LEVEL as any,
  FORMAT: WORKER_CONFIG.LOG_FORMAT,
  SERIALIZERS: {
    error: (err: Error) => ({
      type: err.constructor.name,
      message: err.message,
      stack: err.stack,
    }),
  },
  TRANSPORTS: [
    {
      target: 'json-file',
      level: 'info',
      options: { destination: '/var/log/zidney/worker.log' },
    },
  ],
}

/**
 * Validation & Startup
 */
export function initializeConfig(): void {
  validateWorkerConfig()

  logger.info('config_validated', { config_summary: getConfigSummary() })
}
