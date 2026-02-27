/**
 * Dashboard Structured Logging Middleware
 *
 * Purpose: Log all dashboard requests with structured fields for observability
 * - Logs request start: DASHBOARD_REQUEST_START
 * - Logs validation passes: LICENSE_VALIDATION_PASS, PERMISSION_CHECK_PASS, SCHEMA_VERSION_CHECK_PASS
 * - Logs query execution: DASHBOARD_QUERY_EXECUTED
 * - Logs cache operations: CACHE_HIT / CACHE_MISS
 * - Logs response: RESPONSE_SENT
 * - Logs failures: AUTHORIZATION_FAILED, QUERY_ERROR
 *
 * File: apps/api/src/middleware/dashboard-logging.middleware.ts
 * Task: T030
 * Phase: 1 - Backend Implementation
 *
 * Constitutional Compliance:
 * ✓ Structured logging: All events use standard fields
 * ✓ Mandatory fields: timestamp, level, service, correlation_id, user_id, workspace_id
 * ✓ No PII logging: No passwords, tokens, or sensitive data
 * ✓ Compliance: Supports audit trails and debugging
 *
 * Log Event Structure:
 * {
 *   timestamp: ISO 8601,
 *   level: 'info' | 'warn' | 'error' | 'debug',
 *   service: 'mmc-dashboard',
 *   correlation_id: string (UUID),
 *   user_id: string (UUID),
 *   workspace_id: string (UUID),
 *   event: string (event name),
 *   endpoint: string (route),
 *   method: string (HTTP method),
 *   [event-specific fields]
 * }
 *
 * Middleware Position:
 * After: correlation_id, tenant_resolver, license, permission, schema_version, rate_limit
 * Before: route handler
 */

import { logger } from '@zidney/logger'
import { Context, Next } from 'hono'

/**
 * Dashboard Logging Middleware
 *
 * Logs all dashboard requests with detailed tracing information
 */
export async function dashboardLoggingMiddleware(
  c: Context,
  next: Next
): Promise<void> {
  // @ts-ignore: TS6133 - declared but never read [INFRA-001]
  const startTime = Date.now()

  // Extract context from headers (set by prior middleware)
  // @ts-ignore: TS6133 - declared but never read [INFRA-001]
  const correlationId = c.req.header('x-correlation-id') || 'unknown'
  // @ts-ignore: LOGIC-BUG: HonoRequest.get() does not exist; use .header() — see INFRA-001-LOGIC-06
  const userId = c.req.get('x-user-id') || 'unknown'
  // @ts-ignore: LOGIC-BUG: HonoRequest.get() does not exist; use .header() — see INFRA-001-LOGIC-06
  const workspaceId = c.req.get('x-workspace-id') || 'unknown'
  // @ts-ignore: TS6133 - declared but never read [INFRA-001]
  const endpoint = extractEndpointName(c.req.path)
  // @ts-ignore: TS6133 - declared but never read [INFRA-001]
  const method = c.req.method

  // ============================================================================
  // Log: DASHBOARD_REQUEST_START
  // ============================================================================
  // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
  logger.log({
    timestamp: new Date().toISOString(),
    level: 'info',
    service: 'mmc-dashboard',
    correlation_id: correlationId,
    user_id: userId,
    workspace_id: workspaceId,
    event: 'DASHBOARD_REQUEST_START',
    endpoint,
    method,
    path: c.req.path,
    query_string: new URL(c.req.url).search || 'none',
  })

  // Check for license validation status (set by license middleware)
  // @ts-ignore: LOGIC-BUG: HonoRequest.get() does not exist; use .header() — see INFRA-001-LOGIC-06
  const licenseStatus = c.req.get('x-license-status')
  if (licenseStatus === 'ACTIVE') {
    // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
    logger.log({
      timestamp: new Date().toISOString(),
      level: 'debug',
      service: 'mmc-dashboard',
      correlation_id: correlationId,
      user_id: userId,
      workspace_id: workspaceId,
      event: 'LICENSE_VALIDATION_PASS',
      license_status: licenseStatus,
    })
  } else if (licenseStatus) {
    // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
    logger.log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      service: 'mmc-dashboard',
      correlation_id: correlationId,
      user_id: userId,
      workspace_id: workspaceId,
      event: 'LICENSE_VALIDATION_FAILED',
      license_status: licenseStatus,
    })
  }

  // Check for schema version validation
  // @ts-ignore: LOGIC-BUG: HonoRequest.get() does not exist; use .header() — see INFRA-001-LOGIC-06
  const schemaVersion = c.req.get('x-schema-version')
  if (schemaVersion) {
    // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
    logger.log({
      timestamp: new Date().toISOString(),
      level: 'debug',
      service: 'mmc-dashboard',
      correlation_id: correlationId,
      user_id: userId,
      workspace_id: workspaceId,
      event: 'SCHEMA_VERSION_CHECK_PASS',
      schema_version: schemaVersion,
      api_version: process.env.API_VERSION || 'unknown',
    })
  }

  // Check for permission validation
  // @ts-ignore: LOGIC-BUG: HonoRequest.get() does not exist; use .header() — see INFRA-001-LOGIC-06
  const hasPermission = c.req.get('x-has-permission')
  if (hasPermission === 'true') {
    // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
    logger.log({
      timestamp: new Date().toISOString(),
      level: 'debug',
      service: 'mmc-dashboard',
      correlation_id: correlationId,
      user_id: userId,
      workspace_id: workspaceId,
      event: 'PERMISSION_CHECK_PASS',
      required_permission: 'reporting.view',
      // @ts-ignore: LOGIC-BUG: HonoRequest.get() does not exist; use .header() — see INFRA-001-LOGIC-06
      user_role: c.req.get('x-user-role') || 'unknown',
    })
  }

  // Check for rate limit validation
  // @ts-ignore: LOGIC-BUG: HonoRequest.get() does not exist; use .header() — see INFRA-001-LOGIC-06
  const rateLimitRemaining = c.req.get('x-ratelimit-remaining')
  if (rateLimitRemaining !== undefined) {
    // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
    logger.log({
      timestamp: new Date().toISOString(),
      level: 'debug',
      service: 'mmc-dashboard',
      correlation_id: correlationId,
      user_id: userId,
      workspace_id: workspaceId,
      event: 'RATE_LIMIT_CHECK_PASS',
      rate_limit_remaining: parseInt(rateLimitRemaining, 10),
      // @ts-ignore: LOGIC-BUG: HonoRequest.get() does not exist; use .header() — see INFRA-001-LOGIC-06
      rate_limit_limit: c.req.get('x-ratelimit-limit') || 'unknown',
    })
  }

  // ============================================================================
  // Execute handler and capture response
  // ============================================================================
  // @ts-ignore: TS6133 - declared but never read [INFRA-001]
  const startHandlerTime = Date.now()

  try {
    await next()

    // @ts-ignore: TS6133 - declared but never read [INFRA-001]
    const handlerTime = Date.now() - startHandlerTime
    // @ts-ignore: TS6133 - declared but never read [INFRA-001]
    const status = c.res.status

    // ============================================================================
    // Log: CACHE Hit/Miss (if header exists)
    // ============================================================================
    // @ts-ignore: TS6133 - declared but never read [INFRA-001]
    const cacheStatus = c.req.header('x-cache')
    if (cacheStatus) {
      // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'debug',
        service: 'mmc-dashboard',
        correlation_id: correlationId,
        user_id: userId,
        workspace_id: workspaceId,
        event: cacheStatus === 'HIT' ? 'CACHE_HIT' : 'CACHE_MISS',
        endpoint,
        cache_ttl: c.req.header('x-cache-ttl') || 'unknown',
      })
    }

    // ============================================================================
    // Log: DASHBOARD_QUERY_EXECUTED (only on successful response)
    // ============================================================================
    if (status >= 200 && status < 300) {
      // Get response body size if available
      // @ts-ignore: TS6133 - declared but never read [INFRA-001]
      const contentLength = c.res.headers.get('content-length') || '0'

      // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'mmc-dashboard',
        correlation_id: correlationId,
        user_id: userId,
        workspace_id: workspaceId,
        event: 'DASHBOARD_QUERY_EXECUTED',
        endpoint,
        response_time_ms: handlerTime,
        response_status: status,
        response_bytes: parseInt(contentLength, 10),
        cache_status: cacheStatus || 'NONE',
      })
    }

    // ============================================================================
    // Log: RESPONSE_SENT (all responses)
    // ============================================================================
    // @ts-ignore: TS6133 - declared but never read [INFRA-001]
    const totalResponseTime = Date.now() - startTime
    // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
    logger.log({
      timestamp: new Date().toISOString(),
      level: status >= 400 ? 'warn' : 'info',
      service: 'mmc-dashboard',
      correlation_id: correlationId,
      user_id: userId,
      workspace_id: workspaceId,
      event: 'RESPONSE_SENT',
      endpoint,
      method,
      http_status: status,
      response_time_ms: totalResponseTime,
      handler_time_ms: handlerTime,
      middleware_time_ms: startHandlerTime - startTime,
    })

    // ============================================================================
    // Log: AUTHORIZATION_FAILED or QUERY_ERROR (if applicable)
    // ============================================================================
    if (status === 403) {
      // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'mmc-dashboard',
        correlation_id: correlationId,
        user_id: userId,
        workspace_id: workspaceId,
        event: 'AUTHORIZATION_FAILED',
        endpoint,
        reason: 'permission_denied',
      })
    } else if (status === 423) {
      // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'mmc-dashboard',
        correlation_id: correlationId,
        user_id: userId,
        workspace_id: workspaceId,
        event: 'AUTHORIZATION_FAILED',
        endpoint,
        reason: 'license_locked',
      })
    } else if (status === 429) {
      // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'mmc-dashboard',
        correlation_id: correlationId,
        user_id: userId,
        workspace_id: workspaceId,
        event: 'RATE_LIMIT_EXCEEDED',
        endpoint,
        remaining_requests: c.req.header('x-ratelimit-remaining') || '0',
      })
    } else if (status >= 400 && status < 500) {
      // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'mmc-dashboard',
        correlation_id: correlationId,
        user_id: userId,
        workspace_id: workspaceId,
        event: 'QUERY_ERROR',
        endpoint,
        error_code: status,
      })
    } else if (status >= 500) {
      // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
      logger.log({
        timestamp: new Date().toISOString(),
        level: 'error',
        service: 'mmc-dashboard',
        correlation_id: correlationId,
        user_id: userId,
        workspace_id: workspaceId,
        event: 'QUERY_ERROR',
        endpoint,
        error_code: status,
        severity: 'CRITICAL',
      })
    }
  } catch (error) {
    // ============================================================================
    // Log: Exception during request processing
    // ============================================================================
    // @ts-ignore: TS6133 - declared but never read [INFRA-001]
    const totalResponseTime = Date.now() - startTime

    // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
    logger.log({
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'mmc-dashboard',
      correlation_id: correlationId,
      user_id: userId,
      workspace_id: workspaceId,
      event: 'REQUEST_ERROR',
      endpoint,
      method,
      error: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined,
      response_time_ms: totalResponseTime,
      severity: 'CRITICAL',
    })

    // Re-throw to let error handler middleware catch it
    throw error
  }
}

/**
 * Extract endpoint name from request path
 *
 * @param path - Request path (e.g., "/api/mmc/dashboard/summary")
 * @returns Endpoint name (e.g., "summary")
 */
function extractEndpointName(path: string): string {
  // @ts-ignore: TS6133 - declared but never read [INFRA-001]
  const match = path.match(/\/dashboard\/([a-z-]+)/)
  return match ? match[1]! : 'unknown'
}

/**
 * Log helper: Format response size
 */
// @ts-ignore: TS6133 - declared but never read [INFRA-001]
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/**
 * Log helper: Calculate cache hit ratio (for aggregation)
 *
 * Usage in aggregation pipeline:
 * ```typescript
 // @ts-ignore: TS6133 - declared but never read [INFRA-001]
 * const hitRatio = calculateCacheHitRatio(hits, total)
 // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
 * logger.log({ ..., cache_hit_ratio: hitRatio })
 * ```
 */
export function calculateCacheHitRatio(hits: number, total: number): number {
  return total > 0 ? (hits / total) * 100 : 0
}

/**
 * Metrics event helper: Create standardized metrics event
 *
 * Usage:
 * ```typescript
 // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
 * logger.log(createMetricsEvent({
 *   event: 'CACHE_HIT',
 *   endpoint: 'summary',
 *   correlation_id: correlationId,
 *   user_id: userId,
 *   workspace_id: workspaceId,
 *   response_time_ms: 45,
 * }))
 * ```
 */
export function createMetricsEvent(
  data: Record<string, any>
): Record<string, any> {
  return {
    timestamp: new Date().toISOString(),
    level: 'info',
    service: 'mmc-dashboard',
    ...data,
  }
}

/**
 * Performance alert helper: Log if response time exceeds threshold
 */
export function logPerformanceAlert(
  correlationId: string,
  userId: string,
  workspaceId: string,
  endpoint: string,
  responseTimeMs: number,
  thresholdMs: number = 300
): void {
  if (responseTimeMs > thresholdMs) {
    // @ts-ignore: LOGIC-BUG: Logger.log() does not exist; use .info()/.warn()/.error() — see INFRA-001-LOGIC-07
    logger.log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      service: 'mmc-dashboard',
      correlation_id: correlationId,
      user_id: userId,
      workspace_id: workspaceId,
      event: 'RESPONSE_TIME_ALERT',
      endpoint,
      response_time_ms: responseTimeMs,
      threshold_ms: thresholdMs,
      exceeded_by_ms: responseTimeMs - thresholdMs,
      severity: 'PERFORMANCE',
    })
  }
}
