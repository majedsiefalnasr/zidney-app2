/**
 * Worker Startup & Lifecycle
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION - Task T042
 *
 * Main entry point for Zidney worker service.
 *
 * Key Responsibilities:
 * - Initialize database connections
 * - Start grading job consumers (parallel)
 * - Start DLQ consumer for failed jobs
 * - Handle graceful shutdown (SIGTERM, SIGINT)
 * - Maintain lifecycle state
 *
 * Process Model:
 * - One main event loop
 * - Parallel consumers (job consumer + DLQ consumer)
 * - Graceful shutdown: finish current job, close connections, exit
 *
 * ADRs: ADR-0001 (tenant isolation), ADR-0002 (snapshot immutability)
 */

import { Pool } from 'pg'
import { logger } from '../services/logger'
import { startDLQConsumer, stopDLQConsumer } from './dlq-consumer'
import { startGradeJobsConsumer, stopGradeJobsConsumer } from './job-consumer'

/**
 * Interface: Worker State
 */
interface WorkerState {
  isRunning: boolean
  masterDbPool: Pool | null
  tenantPoolMap: Map<string, Pool>
  startTime: Date | null
}

const workerState: WorkerState = {
  isRunning: false,
  masterDbPool: null,
  tenantPoolMap: new Map(),
  startTime: null,
}

/**
 * Main Worker Initialization
 *
 * Startup Sequence:
 * 1. Initialize database connections
 * 2. Create master pool for job state
 * 3. Set up signal handlers (SIGTERM, SIGINT)
 * 4. Start consumers (parallel)
 * 5. Log ready state
 *
 * @returns Promise that resolves when worker is ready
 */
export async function initializeWorker(): Promise<void> {
  workerState.isRunning = true
  workerState.startTime = new Date()

  logger.info(
    {
      service: 'worker',
      action: 'worker_startup',
      timestamp: workerState.startTime.toISOString(),
    },
    'Zidney Worker Service starting'
  )

  try {
    // 1. Initialize database connections
    const masterDbUrl = process.env.MASTER_DB_URL
    if (!masterDbUrl) {
      throw new Error('MASTER_DB_URL environment variable not set')
    }

    // 2. Create master pool for job state
    workerState.masterDbPool = new Pool({
      connectionString: masterDbUrl,
      max: 10,
      idleTimeoutMillis: 900000,
      connectionTimeoutMillis: 30000,
      statement_timeout: 30000,
    })

    logger.info(
      {
        service: 'worker',
        action: 'master_db_connected',
      },
      'Master database pool created'
    )

    // 3. Set up signal handlers BEFORE starting consumers
    setupSignalHandlers()

    // 4. Start consumers (parallel)
    const jobConsumerPromise = startGradeJobsConsumer(
      workerState.tenantPoolMap,
      workerState.masterDbPool
    )

    const dlqConsumerPromise = startDLQConsumer(workerState.masterDbPool)

    logger.info(
      {
        service: 'worker',
        action: 'consumers_started',
        uptime_ms: Date.now() - workerState.startTime.getTime(),
      },
      'Job and DLQ consumers started'
    )

    // 5. Wait for consumers (they run indefinitely until shutdown)
    await Promise.all([jobConsumerPromise, dlqConsumerPromise])
  } catch (err) {
    logger.error(
      {
        service: 'worker',
        action: 'worker_initialization_failed',
        error: err instanceof Error ? err.message : String(err),
        error_stack: err instanceof Error ? err.stack : undefined,
      },
      'Worker initialization failed'
    )

    await shutdownWorker(1)
  }
}

/**
 * Setup signal handlers for graceful shutdown
 *
 * Listens for:
 * - SIGTERM: From orchestrator (Kubernetes, Docker)
 * - SIGINT: From terminal (Ctrl+C)
 */
function setupSignalHandlers(): void {
  const signals = ['SIGTERM', 'SIGINT']

  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(
        {
          service: 'worker',
          action: 'shutdown_signal_received',
          signal,
        },
        `Received ${signal} signal; initiating graceful shutdown`
      )

      await shutdownWorker(0)
    })
  }

  // Handle uncaught exceptions
  process.on('uncaughtException', async (err) => {
    logger.error(
      {
        service: 'worker',
        action: 'uncaught_exception',
        error: err.message,
        error_stack: err.stack,
      },
      'Uncaught exception in worker; initiating emergency shutdown'
    )

    await shutdownWorker(1)
  })

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    logger.error(
      {
        service: 'worker',
        action: 'unhandled_rejection',
        reason: String(reason),
      },
      'Unhandled promise rejection; initiating emergency shutdown'
    )

    await shutdownWorker(1)
  })
}

/**
 * Graceful Worker Shutdown
 *
 * Shutdown Sequence:
 * 1. Stop accepting new jobs
 * 2. Wait for current jobs to finish (timeout: 30s)
 * 3. Close database connections
 * 4. Exit with code
 *
 * @param exitCode - Process exit code (0=success, 1=error)
 */
export async function shutdownWorker(exitCode: number = 0): Promise<void> {
  logger.info(
    {
      service: 'worker',
      action: 'worker_shutdown_started',
      exit_code: exitCode,
      uptime_ms: workerState.startTime
        ? Date.now() - workerState.startTime.getTime()
        : 0,
    },
    'Worker shutdown sequence started'
  )

  const shutdownStartTime = Date.now()
  const shutdownTimeoutMs = 30000 // 30 seconds

  try {
    // 1. Stop accepting new jobs
    workerState.isRunning = false

    logger.debug(
      {
        service: 'worker',
        action: 'consumers_stop_requested',
      },
      'Requesting consumers to stop'
    )

    // 2. Stop consumers (they finish current jobs)
    await Promise.all([stopGradeJobsConsumer(), stopDLQConsumer()])

    // 3. Close database connections
    if (workerState.masterDbPool) {
      await workerState.masterDbPool.end()
      logger.debug(
        {
          service: 'worker',
          action: 'master_db_pool_closed',
        },
        'Master database pool closed'
      )
    }

    // Close all tenant pools
    for (const [workspaceId, pool] of workerState.tenantPoolMap.entries()) {
      try {
        await pool.end()
      } catch (err) {
        logger.warn(
          {
            service: 'worker',
            action: 'tenant_pool_close_error',
            workspace_id: workspaceId,
            error: err instanceof Error ? err.message : String(err),
          },
          'Error closing tenant database pool'
        )
      }
    }

    logger.info(
      {
        service: 'worker',
        action: 'worker_shutdown_complete',
        exit_code: exitCode,
        shutdown_time_ms: Date.now() - shutdownStartTime,
        total_uptime_ms: workerState.startTime
          ? Date.now() - workerState.startTime.getTime()
          : 0,
      },
      'Worker shutdown complete; exiting gracefully'
    )
  } catch (err) {
    logger.error(
      {
        service: 'worker',
        action: 'worker_shutdown_error',
        error: err instanceof Error ? err.message : String(err),
        error_stack: err instanceof Error ? err.stack : undefined,
      },
      'Error during worker shutdown'
    )
  }

  // 4. Exit with code
  process.exit(exitCode)
}

/**
 * Health Check Endpoint Data
 *
 * Returns worker health status (for monitoring/liveness probes)
 */
export function getHealthStatus() {
  const uptime = workerState.startTime
    ? Date.now() - workerState.startTime.getTime()
    : 0

  return {
    status: workerState.isRunning ? 'healthy' : 'shutdown',
    uptime_ms: uptime,
    db_connected: workerState.masterDbPool !== null,
    tenant_pools: workerState.tenantPoolMap.size,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Main Entry Point
 *
 * Called from CLI: `bun run src/index.ts`
 */
async function main(): Promise<void> {
  await initializeWorker()
}

// Start worker if this is the main module
if (import.meta.main) {
  main().catch((err) => {
    logger.error(
      {
        service: 'worker',
        action: 'main_error',
        error: err.message,
        error_stack: err.stack,
      },
      'Fatal error in main; exiting'
    )
    process.exit(1)
  })
}

export default { initializeWorker, shutdownWorker, getHealthStatus }
