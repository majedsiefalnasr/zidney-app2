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

import { logger } from '@zidney/logger'
import { Pool } from 'pg'
import type { RedisClientType } from 'redis'
import { createClient } from 'redis'
import { runScheduledExamDispatcherCycle } from '../jobs/scheduled-exam-dispatcher'
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
  scheduledExamDispatcherInterval: ReturnType<typeof setInterval> | null
  redisClient: RedisClientType | null
}

const workerState: WorkerState = {
  isRunning: false,
  masterDbPool: null,
  tenantPoolMap: new Map(),
  startTime: null,
  scheduledExamDispatcherInterval: null,
  redisClient: null,
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

    // 2b. Initialize Redis client for dispatcher cycle
    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable not set')
    }

    workerState.redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    })

    await workerState.redisClient.connect()

    logger.info(
      {
        service: 'worker',
        action: 'redis_connected',
      },
      'Redis client connected'
    )

    // 3. Set up signal handlers BEFORE starting consumers
    setupSignalHandlers()

    // 4. Start consumers (parallel)
    const jobConsumerPromise = startGradeJobsConsumer(
      workerState.tenantPoolMap,
      workerState.masterDbPool
    )

    const dlqConsumerPromise = startDLQConsumer(workerState.masterDbPool)

    // 5. Register auto-submit processor and scheduled exam dispatcher (Stage 38)
    // The auto-submit handler is invoked by the queue consumer when it dequeues
    // auto_submit_scheduled_attempt jobs. We register the dispatcher as a repeatable
    // job running every 30 seconds.
    startScheduledExamDispatcher(workerState.masterDbPool)

    logger.info(
      {
        service: 'worker',
        action: 'consumers_started',
        uptime_ms: Date.now() - workerState.startTime.getTime(),
      },
      'Job and DLQ consumers started'
    )

    // 6. Wait for consumers (they run indefinitely until shutdown)
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
 * Start the scheduled exam dispatcher repeatable job (every 30 seconds).
 * Errors in one cycle must not stop the dispatcher.
 */
function startScheduledExamDispatcher(masterDb: Pool): void {
  const INTERVAL_MS = 30_000

  // Run immediately, then every 30s
  const runCycle = () => {
    if (!workerState.isRunning) return
    runScheduledExamDispatcherCycle(
      masterDb,
      async (dbName: string) => {
        if (!workerState.tenantPoolMap.has(dbName)) {
          const tenantUrl = buildTenantDbUrl(dbName)
          const pool = new Pool({
            connectionString: tenantUrl,
            max: 5,
            idleTimeoutMillis: 60_000,
          })
          workerState.tenantPoolMap.set(dbName, pool)
        }
        const tenantPool = workerState.tenantPoolMap.get(dbName)
        if (!tenantPool) throw new Error(`Tenant pool not found for db: ${dbName}`)
        return tenantPool
      },
      // Use a no-op redis stub if not available; real integration requires redis to be injected
      workerState.redisClient as unknown as import('redis').RedisClientType
    ).catch((err) => {
      logger.error('Scheduled exam dispatcher cycle error', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  runCycle()
  workerState.scheduledExamDispatcherInterval = setInterval(runCycle, INTERVAL_MS)

  logger.info('Scheduled exam dispatcher started', { interval_ms: INTERVAL_MS })
}

/**
 * Build tenant DB connection URL from DB name.
 * Follows convention: workspace_{slug} -> uses MASTER_DB_URL base with different DB name.
 */
function buildTenantDbUrl(dbName: string): string {
  const masterUrl = process.env.MASTER_DB_URL ?? ''
  // Replace database name in URL: postgresql://user:pass@host:port/master_db -> .../dbName
  return masterUrl.replace(/\/[^/]*$/, `/${dbName}`)
}

/**
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
  process.on('unhandledRejection', async (reason) => {
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
      uptime_ms: workerState.startTime ? Date.now() - workerState.startTime.getTime() : 0,
    },
    'Worker shutdown sequence started'
  )

  const shutdownStartTime = Date.now()

  try {
    // 1. Stop accepting new jobs
    workerState.isRunning = false

    // Stop scheduled exam dispatcher interval (Stage 38)
    if (workerState.scheduledExamDispatcherInterval) {
      clearInterval(workerState.scheduledExamDispatcherInterval)
      workerState.scheduledExamDispatcherInterval = null
    }

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

    // 4. Close Redis client connection
    if (workerState.redisClient) {
      try {
        await workerState.redisClient.quit()
        logger.debug(
          {
            service: 'worker',
            action: 'redis_client_closed',
          },
          'Redis client closed'
        )
      } catch (err) {
        logger.warn(
          {
            service: 'worker',
            action: 'redis_client_close_error',
            error: err instanceof Error ? err.message : String(err),
          },
          'Error closing Redis client'
        )
      }
    }

    logger.info(
      {
        service: 'worker',
        action: 'worker_shutdown_complete',
        exit_code: exitCode,
        shutdown_time_ms: Date.now() - shutdownStartTime,
        total_uptime_ms: workerState.startTime ? Date.now() - workerState.startTime.getTime() : 0,
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
  const uptime = workerState.startTime ? Date.now() - workerState.startTime.getTime() : 0

  return {
    status: workerState.isRunning ? 'healthy' : 'shutdown',
    uptime_ms: uptime,
    db_connected: workerState.masterDbPool !== null,
    tenant_pools: workerState.tenantPoolMap.size,
    timestamp: new Date().toISOString(),
  }
}

export default { initializeWorker, shutdownWorker, getHealthStatus }
