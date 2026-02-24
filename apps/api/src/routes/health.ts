/**
 * Health Check Endpoint
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Verifies system health and dependency connectivity.
 * Checks: Master DB, Redis, Worker queue consumption.
 * Returns health status and dependency states.
 */

import { Hono } from 'hono'
import { Redis } from 'ioredis'
import { Pool } from 'pg'

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime_seconds: number
  dependencies: {
    master_db: {
      status: 'up' | 'down'
      latency_ms?: number
      error?: string
    }
    redis: {
      status: 'up' | 'down'
      latency_ms?: number
      connected: boolean
      error?: string
    }
    worker_queue: {
      status: 'up' | 'down' | 'degraded'
      queue_depth?: number
      dlq_depth?: number
      last_job_processed_at?: string
      error?: string
    }
  }
}

/**
 * Health check service
 */
export class HealthCheckService {
  private masterDb: Pool
  private redis: Redis
  private queueName: string
  private dlqName: string
  private startTime: number
  private lastJobProcessedAt: string | null = null

  constructor(
    masterDb: Pool,
    redis: Redis,
    queueName: string,
    dlqName: string
  ) {
    this.masterDb = masterDb
    this.redis = redis
    this.queueName = queueName
    this.dlqName = dlqName
    this.startTime = Date.now()
  }

  /**
   * Check overall health
   */
  async check(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString()
    const uptime = (Date.now() - this.startTime) / 1000

    const [masterDbHealth, redisHealth, queueHealth] = await Promise.all([
      this.checkMasterDb(),
      this.checkRedis(),
      this.checkWorkerQueue(),
    ])

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (masterDbHealth.status === 'down' || redisHealth.status === 'down') {
      status = 'unhealthy'
    } else if (
      masterDbHealth.status === 'down' ||
      redisHealth.status === 'down' ||
      queueHealth.status === 'down'
    ) {
      status = 'degraded'
    } else if (
      (masterDbHealth.latency_ms || 0) > 1000 ||
      (redisHealth.latency_ms || 0) > 500
    ) {
      status = 'degraded'
    }

    return {
      status,
      timestamp,
      uptime_seconds: Math.floor(uptime),
      dependencies: {
        master_db: masterDbHealth,
        redis: redisHealth,
        worker_queue: queueHealth,
      },
    }
  }

  /**
   * Check master database connectivity
   */
  private async checkMasterDb(): Promise<
    HealthCheckResult['dependencies']['master_db']
  > {
    try {
      const startTime = Date.now()
      await this.masterDb.query('SELECT 1')
      const latency = Date.now() - startTime

      return {
        status: 'up',
        latency_ms: latency,
      }
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<
    HealthCheckResult['dependencies']['redis']
  > {
    try {
      const startTime = Date.now()
      await this.redis.ping()
      const latency = Date.now() - startTime
      const isConnected = this.redis.status === 'ready'

      return {
        status: 'up',
        latency_ms: latency,
        connected: isConnected,
      }
    } catch (error) {
      return {
        status: 'down',
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Check worker queue health
   */
  private async checkWorkerQueue(): Promise<
    HealthCheckResult['dependencies']['worker_queue']
  > {
    try {
      // Get queue depth
      const queueDepth = await this.redis.llen(this.queueName)
      const dlqDepth = await this.redis.llen(this.dlqName)

      // Check if worker is consuming (check for recent job processed timestamp)
      // This would be set by the worker consumer
      const lastProcessed = await this.redis.get(
        `${this.queueName}:last_processed_at`
      )

      const now = Date.now()
      const lastProcessedTime = lastProcessed ? parseInt(lastProcessed) : null
      const timeSinceLastJob = lastProcessedTime
        ? now - lastProcessedTime
        : null

      // If no job processed in last 5 minutes, consider degraded (if queue has items)
      let status: 'up' | 'down' | 'degraded' = 'up'
      if (queueDepth > 10) {
        if (timeSinceLastJob && timeSinceLastJob > 5 * 60 * 1000) {
          status = 'degraded'
        }
      }

      return {
        status,
        queue_depth: queueDepth,
        dlq_depth: dlqDepth,
        last_job_processed_at: lastProcessed
          ? new Date(parseInt(lastProcessed)).toISOString()
          : undefined,
      }
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Record job processed (called by worker)
   */
  setJobProcessed(): void {
    const timestamp = Date.now()
    this.lastJobProcessedAt = new Date(timestamp).toISOString()
    // Store in Redis for distributed health checks
    this.redis
      .set(`${this.queueName}:last_processed_at`, String(timestamp))
      .catch((error) => {
        console.error('Failed to update job processed timestamp:', error)
      })
  }

  /**
   * Get readiness status (all dependencies up)
   */
  async isReady(): Promise<boolean> {
    const health = await this.check()
    return (
      health.dependencies.master_db.status === 'up' &&
      health.dependencies.redis.status === 'up'
    )
  }

  /**
   * Get liveness status (process is alive)
   */
  isAlive(): boolean {
    return true // Container orchestration checks this
  }
}

/**
 * Create health check route handler
 */
export function createHealthCheckRoute(
  healthCheckService: HealthCheckService
): Hono {
  const router = new Hono()

  // GET /health - Simple liveness probe
  router.get('/health', (ctx) => {
    if (healthCheckService.isAlive()) {
      return ctx.json({ status: 'alive' }, 200)
    }
    return ctx.json({ status: 'dead' }, 503)
  })

  // GET /health/ready - Readiness probe
  router.get('/health/ready', async (ctx) => {
    const isReady = await healthCheckService.isReady()
    if (isReady) {
      return ctx.json({ status: 'ready' }, 200)
    }
    return ctx.json({ status: 'not_ready' }, 503)
  })

  // GET /health/detailed - Full health check
  router.get('/health/detailed', async (ctx) => {
    const health = await healthCheckService.check()

    const statusCode =
      health.status === 'healthy'
        ? 200
        : health.status === 'degraded'
          ? 200
          : 503

    return ctx.json(health, statusCode)
  })

  return router
}

/**
 * Factory to create health check service
 */
export function createHealthCheckService(
  masterDb: Pool,
  redis: Redis,
  queueName: string,
  dlqName: string
): HealthCheckService {
  return new HealthCheckService(masterDb, redis, queueName, dlqName)
}
