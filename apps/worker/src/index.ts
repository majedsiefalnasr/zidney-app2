/**
 * Zidney Worker Service
 *
 * Background job processor for:
 * - Archive snapshots (pg_dump → S3)
 * - License lifecycle events
 * - Async notifications
 */

import { QUEUES, initializeQueues } from './config/queues'
import { archiveSnapshotJob } from './jobs/archive-snapshot'
import { logger } from './services/logger'

// Queue processor abstraction (using Bull as example; swap with BullMQ, RQ, etc.)
interface JobQueue {
  on(eventType: string, handler: (job: any) => Promise<void>): void
  process(
    queueName: string,
    concurrency: number,
    handler: (job: any) => Promise<void>
  ): void
  setRetryPolicy(name: string, policy: any): void
  setDLQ(name: string, dlqName: string): void
}

let jobQueue: JobQueue | null = null

/**
 * Initialize Worker Service
 */
async function initializeWorker(queue: JobQueue): Promise<void> {
  jobQueue = queue

  logger.info(
    { action: 'worker_startup' },
    'Initializing Zidney Worker Service'
  )

  try {
    // Step 1: Initialize queue configurations
    await initializeQueues()

    // Step 2: Register job handlers
    await registerJobHandlers()

    // Step 3: Configure retry policies and DLQs
    await configureQueuePolicies()

    logger.info({}, '✓ Worker service initialized successfully')
  } catch (error: any) {
    logger.error(
      { action: 'worker_initialization_error', error_message: error.message },
      'Failed to initialize worker service'
    )
    process.exit(1)
  }
}

/**
 * Register all job handlers
 */
async function registerJobHandlers(): Promise<void> {
  if (!jobQueue) throw new Error('Job queue not initialized')

  logger.debug({}, 'Registering job handlers')

  // Archive Snapshots Queue Handler
  jobQueue.process('zidney-archive-jobs', 5, async (job: any) => {
    const payload = job.payload || job.data

    logger.debug(
      {
        action: 'archive_job_processing',
        job_id: job.id,
        job_type: payload.type,
      },
      'Processing archive snapshot job'
    )

    if (payload.type === 'ARCHIVE_SNAPSHOT') {
      const result = await archiveSnapshotJob(payload)

      if (!result.success) {
        throw new Error(result.error || 'Archive snapshot job failed')
      }

      return result
    }

    throw new Error(`Unknown job type: ${payload.type}`)
  })

  logger.info({}, '✓ All job handlers registered')
}

/**
 * Configure retry policies and DLQs
 */
async function configureQueuePolicies(): Promise<void> {
  if (!jobQueue) throw new Error('Job queue not initialized')

  logger.debug({}, 'Configuring queue policies')

  for (const queueConfig of QUEUES) {
    // Set retry policy
    jobQueue.setRetryPolicy(queueConfig.name, {
      maxRetries: queueConfig.retryPolicy.maxRetries,
      backoff: queueConfig.retryPolicy.backoff,
      timeout: queueConfig.timeout,
    })

    // Set DLQ
    jobQueue.setDLQ(queueConfig.name, queueConfig.dlq)

    logger.debug(
      {
        queue: queueConfig.name,
        max_retries: queueConfig.retryPolicy.maxRetries,
        dlq: queueConfig.dlq,
      },
      'Queue policy configured'
    )
  }

  logger.info({}, '✓ All queue policies configured')
}

/**
 * Health Check
 */
export async function healthCheck(): Promise<{
  status: string
  queues_active: number
  timestamp: string
}> {
  return {
    status: 'healthy',
    queues_active: QUEUES.length,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Graceful Shutdown
 */
export async function shutdown(): Promise<void> {
  logger.info(
    { action: 'worker_shutdown' },
    'Worker service shutting down gracefully'
  )

  const shutdownTimeout = setTimeout(() => {
    logger.warn({}, 'Shutdown timeout reached; force exiting')
    process.exit(1)
  }, 30000)

  try {
    logger.info({}, 'Stopping job processing')
    clearTimeout(shutdownTimeout)
    logger.info({}, '✓ Worker service shut down gracefully')
    process.exit(0)
  } catch (error: any) {
    logger.error(
      { error_message: error.message },
      'Error during graceful shutdown'
    )
    process.exit(1)
  }
}

/**
 * Main Entry Point
 */
async function main() {
  // Mock queue implementation for baseline
  // Replace with actual queue system (Bull, BullMQ, etc.)
  const mockQueue: JobQueue = {
    on: () => {},
    process: () => {},
    setRetryPolicy: () => {},
    setDLQ: () => {},
  }

  await initializeWorker(mockQueue)

  logger.info({}, 'Worker service ready and listening for jobs')

  // Graceful shutdown on signals
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  logger.error(
    { action: 'worker_startup_error', error_message: err.message },
    'Fatal error starting worker'
  )
  process.exit(1)
})
