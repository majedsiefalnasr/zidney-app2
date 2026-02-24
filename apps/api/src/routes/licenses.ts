/**
 * License Routes
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Router registration for provisioning license endpoints:
 * - POST /v1/mmc/licenses (create new license)
 * - GET /v1/mmc/licenses/{license_id} (poll provisioning status)
 *
 * All routes protected by:
 * - MMC service token validation
 * - Correlation ID generation
 * - Rate limiting
 * - Request validation
 * - Structured logging
 */

import { Hono } from 'hono'
import { Redis } from 'ioredis'
import { createLicenseHandler } from '../handlers/licenses/create-license'
import { getLicenseStatusHandler } from '../handlers/licenses/get-license-status'
import { mmcTokenValidator } from '../middleware/mmc-token-validator'
import {
  DEFAULT_RATE_LIMIT_CONFIG,
  rateLimitProvisioningMiddleware,
} from '../middleware/rate-limit-provisioning'
import {
  requireContentType,
  validateRequest,
} from '../middleware/validate-request'
import { ProvisionEnqueueService } from '../services/provision-enqueue-service'
import { CreateLicenseRequestSchema } from './licenses/validate-license-request'

/**
 * Create license routes
 *
 * @param redis - Redis client for job queue and rate limiting
 * @param enqueueService - Service to enqueue provisioning jobs
 * @param logger - Logger instance
 * @returns Hono router instance
 */
export function createLicenseRoutes(
  redis: Redis,
  enqueueService: ProvisionEnqueueService,
  logger?: any
): Hono {
  const router = new Hono()

  /**
   * Global middleware for all license routes
   */
  router.use(async (c, next) => {
    c.set('logger', logger)
    c.set('enqueueService', enqueueService)
    c.set('schemaVersion', process.env.SCHEMA_VERSION || '1.0.0')
    c.set('productVersion', process.env.PRODUCT_VERSION || '1.0.0')
    await next()
  })

  /**
   * POST /v1/mmc/licenses
   * Create new license and enqueue provisioning job
   *
   * @security Bearer token required
   * @param {CreateLicenseRequest} body - License creation request
   * @returns {LicenseCreationResponse} License ID, job ID, and provisioning status
   * @throws {400} Invalid request or duplicate workspace slug
   * @throws {401} Invalid or missing bearer token
   * @throws {429} Rate limit exceeded
   * @throws {503} Queue unavailable or database error
   */
  router.post(
    '/licenses',
    // Middleware chain (in order)
    mmcTokenValidator, // Validate MMC service token
    rateLimitProvisioningMiddleware(redis, DEFAULT_RATE_LIMIT_CONFIG), // Rate limiting
    requireContentType('application/json'), // Validate content type
    validateRequest(CreateLicenseRequestSchema), // Validate request schema
    // Handler
    createLicenseHandler
  )

  /**
   * GET /v1/mmc/licenses/{license_id}
   * Poll provisioning status for a license
   *
   * @security Bearer token required
   * @param {string} license_id - License UUID (path parameter)
   * @returns {LicenseStatusResponse} Current provisioning status
   * @throws {401} Invalid or missing bearer token
   * @throws {404} License not found
   * @throws {429} Rate limit exceeded
   * @throws {503} Database error
   */
  router.get(
    '/licenses/:license_id',
    // Middleware chain
    mmcTokenValidator, // Validate MMC service token
    rateLimitProvisioningMiddleware(redis, {
      ...DEFAULT_RATE_LIMIT_CONFIG,
      maxRequests: 100, // Higher limit for polling queries
      windowSeconds: 60,
    }), // Rate limiting (higher for polling)
    // Handler
    getLicenseStatusHandler
  )

  /**
   * Health check endpoint for provisioning service
   * No authentication required for health checks
   */
  router.get('/health', async (c) => {
    try {
      // Check Redis connectivity
      const redisConnected = redis.ping().catch(() => false)

      // Get queue stats
      const queueStats = await enqueueService.getQueueStats()

      const isHealthy = (await redisConnected) === 'PONG'

      c.status(isHealthy ? 200 : 503)
      return c.json({
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          redis: isHealthy ? 'up' : 'down',
          queue: queueStats,
        },
      })
    } catch (error) {
      logger?.logError(
        'Health check failed',
        error instanceof Error ? error : new Error(String(error))
      )

      c.status(503)
      return c.json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })

  return router
}

/**
 * Mount license routes on a Hono app
 *
 * @param app - Hono application
 * @param redis - Redis client
 * @param enqueueService - Enqueue service
 * @param logger - Logger instance
 * @param prefix - URL prefix (default: /v1/mmc)
 */
export function mountLicenseRoutes(
  app: Hono,
  redis: Redis,
  enqueueService: ProvisionEnqueueService,
  logger?: any,
  prefix: string = '/v1/mmc'
): void {
  const licensesRouter = createLicenseRoutes(redis, enqueueService, logger)
  app.route(prefix, licensesRouter)
}
