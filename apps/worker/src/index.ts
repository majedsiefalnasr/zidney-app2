/**
 * Zidney Worker Service
 *
 * Background job processor for:
 * - Attempt grading (T037-T042)
 * - Archive snapshots (pg_dump → S3)
 * - License lifecycle events
 * - Async notifications
 *
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Phase E (Worker Grading Pipeline)
 */

import { logger } from '@zidney/logger'
import { initializeConfig, WORKER_CONFIG } from './config/worker-config'
import { getHealthStatus, initializeWorker, shutdownWorker } from './grading/worker-startup'

/**
 * Main Worker Entry Point
 *
 * Orchestrates startup and lifecycle of worker service.
 */
async function main(): Promise<void> {
  try {
    // Initialize configuration
    initializeConfig()

    logger.info(
      { action: 'worker_startup', version: WORKER_CONFIG.SERVICE_VERSION },
      'Zidney Worker Service starting'
    )

    // Start worker (runs indefinitely)
    await initializeWorker()
  } catch (error: any) {
    logger.error(
      { action: 'worker_startup_error', error_message: error.message },
      'Failed to start worker service'
    )
    process.exit(1)
  }
}

/**
 * Health Check Endpoint
 */
export async function healthCheck(): Promise<{
  status: string
  uptime_ms: number
  db_connected: boolean
  timestamp: string
}> {
  const health = getHealthStatus()
  return {
    status: health.status,
    uptime_ms: health.uptime_ms,
    db_connected: health.db_connected,
    timestamp: health.timestamp,
  }
}

/**
 * Graceful Shutdown Handler
 */
async function gracefulShutdown(): Promise<void> {
  logger.info({ action: 'worker_shutdown' }, 'Worker service shutting down gracefully')

  const shutdownTimeout = setTimeout(() => {
    logger.warn({}, 'Shutdown timeout reached; force exiting')
    process.exit(1)
  }, WORKER_CONFIG.SHUTDOWN_TIMEOUT_MS)

  try {
    await shutdownWorker(0)
    clearTimeout(shutdownTimeout)
  } catch (error: any) {
    logger.error({ error_message: error.message }, 'Error during graceful shutdown')
    process.exit(1)
  }
}

/**
 * Main Entry Point
 */
main().catch((err) => {
  logger.error(
    { action: 'worker_startup_error', error_message: err.message },
    'Fatal error starting worker'
  )
  process.exit(1)
})

/**
 * Signal Handlers
 */
process.on('SIGTERM', () => {
  logger.info({ signal: 'SIGTERM' }, 'Received SIGTERM; shutting down')
  gracefulShutdown()
})

process.on('SIGINT', () => {
  logger.info({ signal: 'SIGINT' }, 'Received SIGINT; shutting down')
  gracefulShutdown()
})

export { getHealthStatus, initializeWorker, shutdownWorker }
