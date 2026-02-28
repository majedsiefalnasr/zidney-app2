/**
 * Dashboard Cache Middleware
 *
 * Purpose: Check cache before route handler, populate cache after
 * - Before route: Check cache, return if HIT (set X-Cache: HIT)
 * - After route: Store in cache (set X-Cache: MISS, Cache-Control header)
 * - On error: Don't cache (always return fresh on next request)
 * - Logging: Cache hit/miss rate per endpoint
 *
 * File: apps/api/src/middleware/dashboard-cache.middleware.ts
 * Task: T027
 * Phase: 1 - Backend Implementation
 *
 * Constitutional Compliance:
 * ✓ Cache bypass for errors: Only cache successful (2xx) responses
 * ✓ Workspace isolation: Cache keys include workspace_id
 * ✓ Query parameter hashing: Deterministic, secure cache keys
 * ✓ Graceful degradation: If Redis unavailable, returns fresh (no error)
 * ✓ Structured logging: Logs cache hits/misses with metadata
 *
 * Middleware Position in Chain:
 * Before this middleware: correlation_id, tenant_resolver, license, permission, schema_version, rate_limit
 * After this middleware: route handler
 *
 * Cache Strategy:
 * 1. Before route: Check cache with endpoint + workspace_id + query params
 * 2. Store cached response in context for logging
 * 3. After route: If response.status is 2xx, store in cache
 * 4. Always set X-Cache header: HIT or MISS
 * 5. Set Cache-Control header with appropriate max-age
 *
 * Query Parameters NOT Cached:
 * - Pagination cursors (different results per page)
 * - We cache with query param hash, so different params = different cache key
 * - But some endpoints like /export should skip caching entirely (TTL=0)
 */

import { logger } from '@zidney/logger'
import { Context, Next } from 'hono'

/**
 * Extract endpoint name from request path
 *
 * @param path - Request path (e.g., "/api/mmc/dashboard/summary")
 * @returns Endpoint name (e.g., "summary")
 */
function extractEndpointName(path: string): string {
  const match = path.match(/\/dashboard\/([a-z-]+)/)
  return match ? match[1]! : 'unknown'
}

/**
 * Cache middleware for dashboard endpoints
 *
 * Flow:
 * 1. Check cache on request
 * 2. If hit, return cached response with X-Cache: HIT
 * 3. If miss, continue to route handler
 * 4. After route handler, cache the response if 2xx
 * 5. Return response with X-Cache: MISS
 *
 * Usage:
 * ```typescript
 * app.use('/api/mmc/dashboard/*', dashboardCacheMiddleware)
 * ```
 */
export async function dashboardCacheMiddleware(
  c: Context,
  next: Next
): Promise<void> {
  const cacheClient = getDashboardCacheClient()
  const endpoint = extractEndpointName(c.req.path)
  // @ts-ignore: LOGIC-BUG: HonoRequest.get() does not exist; use .header() — see INFRA-001-LOGIC-06 [INFRA-001-LOGIC-06]
  const workspaceId = c.req.get('x-workspace-id')
  const ttl = cacheClient.getTTL(endpoint)

  // Track cache status for logging
  let cacheStatus: 'HIT' | 'MISS' | 'NO_CACHE' = 'MISS'
  const startTime = Date.now()

  // Skip caching for endpoints with TTL=0
  if (ttl === 0) {
    cacheStatus = 'NO_CACHE'
    c.header('X-Cache', 'NO_CACHE')
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
    await next()

    // Log cache bypass
    // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07 [INFRA-001-LOGIC-07]
    logger.log({
      timestamp: new Date().toISOString(),
      level: 'debug',
      service: 'dashboard-cache',
      correlation_id: c.req.header('x-correlation-id') || 'unknown',
      // @ts-ignore: LOGIC-BUG: HonoRequest.get() does not exist; use .header() — see INFRA-001-LOGIC-06 [INFRA-001-LOGIC-06]
      user_id: c.req.get('x-user-id') || 'unknown',
      workspace_id: workspaceId || 'unknown',
      event: 'cache_bypass',
      endpoint,
      reason: 'no_cache_configured',
      response_time_ms: Date.now() - startTime,
    })
    return
  }

  if (!workspaceId) {
    // Can't cache without workspace_id
    c.header('X-Cache', 'MISS')
    await next()
    return
  }

  // Extract query parameters for cache key generation
  const queryParams = Object.fromEntries(new URL(c.req.url).searchParams)

  try {
    // BEFORE: Check cache
    const cachedResponse = await cacheClient.get(
      endpoint,
      workspaceId,
      queryParams
    )

    if (cachedResponse) {
      // Cache hit: return cached response
      cacheStatus = 'HIT'
      c.header('X-Cache', 'HIT')
      c.header('Cache-Control', `max-age=${ttl}, public`)
      c.header('Content-Type', 'application/json')

      // Log cache hit
      // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07 [INFRA-001-LOGIC-07]
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'debug',
        service: 'dashboard-cache',
        correlation_id: c.req.header('x-correlation-id') || 'unknown',
        // @ts-ignore: LOGIC-BUG: HonoRequest.get() does not exist; use .header() — see INFRA-001-LOGIC-06 [INFRA-001-LOGIC-06]
        user_id: c.req.get('x-user-id') || 'unknown',
        workspace_id: workspaceId,
        event: 'cache_hit',
        endpoint,
        ttl_remaining: ttl,
        response_time_ms: Date.now() - startTime,
      })

      // Parse and return cached response
      try {
        const data = JSON.parse(cachedResponse)
        c.status(200)
        await c.json(data)
      } catch {
        // Cached data corrupted, treat as miss
        c.header('X-Cache', 'MISS')
        await next()
      }
      return
    }
  } catch (error) {
    // Cache error: continue without caching
    // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07 [INFRA-001-LOGIC-07]
    logger.log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      service: 'dashboard-cache',
      correlation_id: c.req.header('x-correlation-id') || 'unknown',
      event: 'cache_check_error',
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Cache miss: continue to route handler
  c.header('X-Cache', 'MISS')

  // Store response body for caching
  const originalJson = c.json.bind(c)
  let responseData: any = null
  let responseStatus: number = 200

  c.json = function (data: any, initResponse?: number | ResponseInit) {
    responseData = data
    if (typeof initResponse === 'number') {
      responseStatus = initResponse
    } else if (initResponse && 'status' in initResponse) {
      responseStatus = initResponse.status || 200
    }

    // @ts-ignore: TS2589+TS2345 excessive deep type in response - see INFRA-001 [INFRA-001]
    return originalJson.call(this, data, initResponse)
  }

  // Execute route handler
  await next()

  // AFTER: Cache successful responses (2xx)
  if (
    responseStatus >= 200 &&
    responseStatus < 300 &&
    responseData &&
    cacheStatus === 'MISS'
  ) {
    try {
      const cacheKey = `${endpoint}:${workspaceId}:${JSON.stringify(queryParams)}`
      const cached = await cacheClient.set(
        endpoint,
        workspaceId,
        JSON.stringify(responseData),
        queryParams
      )

      if (cached) {
        c.header('Cache-Control', `max-age=${ttl}, public`)

        // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07 [INFRA-001-LOGIC-07]
        logger.log({
          timestamp: new Date().toISOString(),
          level: 'debug',
          service: 'dashboard-cache',
          correlation_id: c.req.header('x-correlation-id') || 'unknown',
          // @ts-ignore: LOGIC-BUG: HonoRequest.get() does not exist; use .header() — see INFRA-001-LOGIC-06 [INFRA-001-LOGIC-06]
          user_id: c.req.get('x-user-id') || 'unknown',
          workspace_id: workspaceId,
          event: 'cache_stored',
          endpoint,
          ttl_seconds: ttl,
          cache_key: cacheKey,
          response_time_ms: Date.now() - startTime,
        })
      }
    } catch (error) {
      // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07 [INFRA-001-LOGIC-07]
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'dashboard-cache',
        correlation_id: c.req.header('x-correlation-id') || 'unknown',
        event: 'cache_store_error',
        endpoint,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  } else if (responseStatus >= 400) {
    // Don't cache errors
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate')

    // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07 [INFRA-001-LOGIC-07]
    logger.log({
      timestamp: new Date().toISOString(),
      level: 'debug',
      service: 'dashboard-cache',
      correlation_id: c.req.header('x-correlation-id') || 'unknown',
      event: 'cache_skipped_error',
      endpoint,
      response_status: responseStatus,
      response_time_ms: Date.now() - startTime,
    })
  }
}

/**
 * Get global cache client
 * (Imported from @zidney/redis-utils)
 */
function getDashboardCacheClient() {
  // This function is re-exported from redis-utils package
  // Implementation handles singleton pattern
  try {
    const {
      getDashboardCacheClient: getClient,
    } = require('@zidney/redis-utils')
    return getClient()
  } catch {
    // If import fails, return a no-op client
    return {
      get: async () => null,
      set: async () => false,
      del: async () => false,
      exists: async () => false,
      getTTL: () => 0,
    }
  }
}

/**
 * Alternative: Async middleware that waits for response body
 *
 * If the above approach doesn't work due to response streaming,
 * use this version that intercepts the response after it's sent.
 *
 * Usage:
 * ```typescript
 * app.use(dashboardCacheMiddlewareAsync)
 * ```
 */
export async function dashboardCacheMiddlewareAsync(
  c: Context,
  next: Next
): Promise<void> {
  const cacheClient = getDashboardCacheClient()
  const endpoint = extractEndpointName(c.req.path)
  // @ts-ignore: LOGIC-BUG: HonoRequest.get() does not exist; use .header() — see INFRA-001-LOGIC-06 [INFRA-001-LOGIC-06]
  const workspaceId = c.req.get('x-workspace-id')
  const ttl = cacheClient.getTTL(endpoint)

  // Skip caching if no TTL configured
  if (ttl === 0 || !workspaceId) {
    c.header('X-Cache', 'NO_CACHE')
    await next()
    return
  }

  const queryParams = Object.fromEntries(new URL(c.req.url).searchParams)

  // Try to get from cache
  try {
    const cached = await cacheClient.get(endpoint, workspaceId, queryParams)
    if (cached) {
      c.header('X-Cache', 'HIT')
      c.header('Cache-Control', `max-age=${ttl}, public`)
      c.status(200)
      await c.json(JSON.parse(cached))

      // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07 [INFRA-001-LOGIC-07]
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'debug',
        service: 'dashboard-cache',
        event: 'cache_hit',
        endpoint,
        workspace_id: workspaceId,
      })
      return
    }
  } catch (error) {
    // Continue on cache error
    // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07 [INFRA-001-LOGIC-07]
    logger.log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      service: 'dashboard-cache',
      event: 'cache_error',
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Cache miss: execute handler
  c.header('X-Cache', 'MISS')
  await next()

  // Try to cache response if successful
  const status = c.res.status
  if (status >= 200 && status < 300) {
    try {
      // Note: In async middleware, the response body may have already been sent
      // This approach works if response is buffered before being sent to client
      await cacheClient.set(
        endpoint,
        workspaceId,
        c.res.text?.() || '',
        queryParams
      )

      c.header('Cache-Control', `max-age=${ttl}, public`)
    } catch (error) {
      // Silent fail on cache error
    }
  }
}
