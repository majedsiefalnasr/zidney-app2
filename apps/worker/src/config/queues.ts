/**
 * Worker Queue Configuration
 *
 * Defines all job queues for the Zidney Worker service.
 * Queue names, concurrency, retry policies, and DLQ settings.
 */

export interface QueueConfig {
  name: string
  concurrency: number
  retryPolicy: {
    maxRetries: number
    backoff: number[] // milliseconds
  }
  dlq: string
  timeout: number // milliseconds
  description?: string
}

/**
 * Archive Snapshots Queue
 *
 * Responsible for: pg_dump → S3 upload → license update
 * Concurrency: 5 (allow up to 5 parallel dumps)
 * Retry: 3x exponential backoff (1s, 5s, 30s)
 * DLQ: Failed snapshots after 3 retries
 * Timeout: 5 minutes (enough for pg_dump on large DBs)
 */
export const ARCHIVE_JOBS_QUEUE: QueueConfig = {
  name: 'zidney-archive-jobs',
  concurrency: 5,
  retryPolicy: {
    maxRetries: 3,
    backoff: [1000, 5000, 30000], // 1s, 5s, 30s
  },
  dlq: 'zidney-archive-jobs-dlq',
  timeout: 300000, // 5 minutes
  description: 'Archive snapshots queue for license lifecycle',
}

/**
 * All Queues
 *
 * Add new queue configs here as new job types are introduced
 */
export const QUEUES: QueueConfig[] = [ARCHIVE_JOBS_QUEUE]

/**
 * Get queue config by name
 */
export function getQueueConfig(name: string): QueueConfig | undefined {
  return QUEUES.find((q) => q.name === name)
}

/**
 * Get all DLQs
 *
 * Used for monitoring and admin interventions
 */
export function getAllDLQs(): string[] {
  return QUEUES.map((q) => q.dlq).filter(Boolean)
}

/**
 * Validate queue configuration
 *
 * Ensures all required fields are populated
 */
export function validateQueueConfig(config: QueueConfig): boolean {
  if (!config.name || !config.name.length) {
    console.error('Queue name is required')
    return false
  }

  if (config.concurrency < 1 || config.concurrency > 100) {
    console.error('Concurrency must be between 1 and 100')
    return false
  }

  if (config.retryPolicy.maxRetries < 0 || config.retryPolicy.maxRetries > 10) {
    console.error('Max retries must be between 0 and 10')
    return false
  }

  if (
    config.retryPolicy.backoff.length !== config.retryPolicy.maxRetries &&
    config.retryPolicy.maxRetries > 0
  ) {
    console.error('Backoff array length must match maxRetries count')
    return false
  }

  if (config.timeout < 1000 || config.timeout > 3600000) {
    console.error('Timeout must be between 1s and 1h (1000-3600000ms)')
    return false
  }

  return true
}

/**
 * Initialize all queues
 *
 * Called during worker startup
 */
export async function initializeQueues(): Promise<void> {
  console.log(`Initializing ${QUEUES.length} job queues...`)

  for (const config of QUEUES) {
    if (!validateQueueConfig(config)) {
      throw new Error(`Invalid queue configuration for ${config.name}`)
    }

    console.log(
      `✓ Queue initialized: ${config.name} (concurrency=${config.concurrency}, timeout=${config.timeout}ms)`
    )
  }

  console.log('All queues initialized successfully')
}
