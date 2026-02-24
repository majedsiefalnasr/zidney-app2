/**
 * Queue Configuration
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Redis-based job queue configuration for provisioning worker.
 *
 * Design:
 * - FIFO queue using Redis Streams
 * - Consumer groups for distributed worker coordination
 * - Automatic retry with exponential backoff
 * - Dead letter queue for exhausted retries
 * - Visibility timeout to detect stalled workers
 */

import { JobQueueConfig } from '@zidney/types/jobs/provisioning-job'

/**
 * Queue Configuration Factory
 * Creates queue config from environment variables.
 */
export function createQueueConfig(): JobQueueConfig {
  const config: JobQueueConfig = {
    queueName: process.env.PROVISIONING_QUEUE_NAME || 'provisioning:jobs',
    consumerGroup:
      process.env.PROVISIONING_CONSUMER_GROUP || 'provisioning-worker',
    consumerName: `${process.env.PROVISIONING_CONSUMER_NAME || 'provisioning-consumer'}-${process.env.WORKER_ID || 'unknown'}`,
    maxConcurrentJobs: parseInt(
      process.env.PROVISIONING_MAX_CONCURRENT || '10',
      10
    ),
    visibilityTimeout: parseInt(
      process.env.PROVISIONING_VISIBILITY_TIMEOUT || '300',
      10
    ),
    lockTTL: parseInt(process.env.PROVISIONING_LOCK_TTL || '30', 10),
    metricsInterval: parseInt(
      process.env.PROVISIONING_METRICS_INTERVAL || '60',
      10
    ),
    maxDeadLetterRetention: parseInt(
      process.env.PROVISIONING_DLQ_RETENTION_HOURS || '504',
      10
    ),
  }

  validateQueueConfig(config)
  return config
}

/**
 * Validate queue configuration
 */
export function validateQueueConfig(config: JobQueueConfig): void {
  const errors: string[] = []

  if (!config.queueName || config.queueName.length === 0) {
    errors.push('Queue name is required')
  }

  if (config.maxConcurrentJobs < 1 || config.maxConcurrentJobs > 1000) {
    errors.push('Max concurrent jobs must be between 1 and 1000')
  }

  if (config.visibilityTimeout < 10 || config.visibilityTimeout > 86400) {
    errors.push('Visibility timeout must be between 10 and 86400 seconds')
  }

  if (config.lockTTL < 5 || config.lockTTL > 300) {
    errors.push('Lock TTL must be between 5 and 300 seconds')
  }

  if (config.metricsInterval < 1 || config.metricsInterval > 3600) {
    errors.push('Metrics interval must be between 1 and 3600 seconds')
  }

  if (errors.length > 0) {
    throw new Error(`Invalid queue configuration: ${errors.join('; ')}`)
  }
}

/**
 * Queue Names
 * Constants for queue key patterns.
 */
export const QUEUE_NAMES = {
  // Main job queue
  JOBS: 'provisioning:jobs',

  // Dead letter queue (for failed jobs)
  DLQ: 'provisioning:dlq',

  // Lock keys for distributed locks
  LOCK_PREFIX: 'provisioning:lock:',

  // Processing status tracking
  STATUS_PREFIX: 'provisioning:status:',

  // Idempotency cache (24h)
  IDEMPOTENCY_PREFIX: 'provisioning:idempotency:',

  // Metrics counters
  METRICS_PREFIX: 'provisioning:metrics:',
} as const

/**
 * Redis Key Helpers
 */
export const QUEUE_KEYS = {
  /**
   * Lock key for ensuring only one worker provisions a given license
   * @param licenseId - License UUID
   * @returns Redis key for distributed lock
   */
  lockKey: (licenseId: string) => `${QUEUE_NAMES.LOCK_PREFIX}${licenseId}`,

  /**
   * Status tracking key for a job
   * @param jobId - Job UUID
   * @returns Redis key for job status
   */
  statusKey: (jobId: string) => `${QUEUE_NAMES.STATUS_PREFIX}${jobId}`,

  /**
   * Idempotency cache key (RFC 7231)
   * @param idempotencyKey - Client-provided idempotency key
   * @returns Redis key for caching response
   */
  idempotencyKey: (idempotencyKey: string) =>
    `${QUEUE_NAMES.IDEMPOTENCY_PREFIX}${idempotencyKey}`,

  /**
   * Metrics counter key
   * @param metric - Metric name (e.g., "provision.success_count")
   * @param window - Time window (e.g., "1h", "24h")
   * @returns Redis key for metrics
   */
  metricsKey: (metric: string, window: string = '1h') =>
    `${QUEUE_NAMES.METRICS_PREFIX}${metric}:${window}`,
} as const

/**
 * Lock Configuration
 */
export const LOCK_CONFIG = {
  // Distributed lock TTL (seconds)
  TTL: 30,

  // Max retries to acquire lock
  MAX_RETRIES: 10,

  // Initial retry backoff (milliseconds)
  INITIAL_BACKOFF_MS: 50,

  // Max retry backoff (milliseconds)
  MAX_BACKOFF_MS: 5000,

  // Backoff multiplier (exponential)
  BACKOFF_MULTIPLIER: 2,
} as const

/**
 * Job Processing Configuration
 */
export const JOB_PROCESSING_CONFIG = {
  // Max time to process a single job (milliseconds)
  TIMEOUT_MS: 300000, // 5 minutes

  // How often to check for new jobs
  POLL_INTERVAL_MS: 1000,

  // How long to block on queue read (milliseconds)
  BLOCK_TIMEOUT_MS: 5000,

  // Number of jobs to read per poll
  BATCH_SIZE: 10,
} as const

/**
 * Retry Configuration
 */
export const RETRY_CONFIG = {
  // Max number of retry attempts
  MAX_ATTEMPTS: 3,

  // Initial retry delay (milliseconds)
  INITIAL_DELAY_MS: 1000,

  // Max retry delay (milliseconds)
  MAX_DELAY_MS: 60000,

  // Exponential backoff multiplier
  BACKOFF_MULTIPLIER: 2,

  // Random jitter (0-10%)
  JITTER_FACTOR: 0.1,
} as const

/**
 * Calculate exponential backoff with jitter
 */
export function calculateBackoffDelay(
  attemptNumber: number,
  config: typeof RETRY_CONFIG = RETRY_CONFIG
): number {
  const exponentialDelay = Math.min(
    config.INITIAL_DELAY_MS *
      Math.pow(config.BACKOFF_MULTIPLIER, attemptNumber - 1),
    config.MAX_DELAY_MS
  )

  const jitter = exponentialDelay * config.JITTER_FACTOR * Math.random()
  return Math.round(exponentialDelay + jitter)
}

/**
 * Idempotency Configuration
 */
export const IDEMPOTENCY_CONFIG = {
  // Cache TTL for idempotency responses (seconds)
  CACHE_TTL_SECONDS: 86400, // 24 hours per RFC 7231

  // Response payload size limit (bytes)
  MAX_PAYLOAD_SIZE: 1_000_000, // 1MB
} as const

/**
 * Metrics Configuration
 */
export const METRICS_CONFIG = {
  // Retention window for metrics (hours)
  RETENTION_HOURS: 24,

  // Metrics to track
  TRACKED_METRICS: [
    'provisioning.total_jobs',
    'provisioning.success_count',
    'provisioning.failure_count',
    'provisioning.retry_count',
    'provisioning.duration_ms_p50',
    'provisioning.duration_ms_p95',
    'provisioning.duration_ms_p99',
    'provisioning.lock_wait_ms',
    'provisioning.database_create_ms',
    'provisioning.migration_apply_ms',
    'provisioning.seed_ms',
    'provisioning.admin_create_ms',
    'provisioning.registry_insert_ms',
    'tenants_registry.total_workspaces',
    'tenants_registry.active_workspaces',
  ] as const,
} as const

/**
 * Environment Variables (with defaults)
 */
export const QUEUE_ENV_VARS = {
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  MASTER_DB_URL: process.env.MASTER_DB_URL || 'postgresql://localhost/master',
  PROVISIONING_QUEUE_NAME:
    process.env.PROVISIONING_QUEUE_NAME || 'provisioning:jobs',
  PROVISIONING_CONSUMER_GROUP:
    process.env.PROVISIONING_CONSUMER_GROUP || 'provisioning-worker',
  PROVISIONING_MAX_CONCURRENT: process.env.PROVISIONING_MAX_CONCURRENT || '10',
  PROVISIONING_LOCK_TTL: process.env.PROVISIONING_LOCK_TTL || '30',
  WORKER_ID: process.env.WORKER_ID || `worker-${Date.now()}`,
} as const

export default createQueueConfig()
