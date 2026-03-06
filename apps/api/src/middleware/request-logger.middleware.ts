/**
 * Request Logging Middleware
 *
 * File: apps/api/src/middleware/request-logger.middleware.ts
 * Task: T012
 * Phase: 2 - Infrastructure & Middleware
 *
 * Structured JSON logging for all HTTP requests and responses.
 * Logs correlation_id, duration_ms, http_method, http_status, and request details.
 * Integrates with packages/logger for standardized output.
 *
 * Properties:
 * - Structured JSON logging (not console.log)
 * - Request/response timing
 * - status/method/path tracking
 * - Correlation ID propagation
 * - No sensitive data in logs (passwords, tokens, emails)
 */

import type { Logger } from '@zidney/logger'
import type { Context, Next } from 'hono'

export interface RequestLogEntry {
  timestamp: string
  level: string
  service: string
  correlation_id: string
  http_method: string
  http_path: string
  http_status: number
  duration_ms: number
  user_id?: string
  workspace_slug?: string
  message: string
  details?: Record<string, unknown>
}

/**
 * Request Logger Middleware
 *
 * Logs all requests/responses with timing and correlation ID.
 * Uses structured logging (JSON) instead of console.log.
 */
export function createRequestLoggerMiddleware(logger: Logger) {
  return async (ctx: Context, next: Next): Promise<void> => {
    const startTime = Date.now()
    const correlationId = ctx.get('context')?.correlationId || 'unknown'
    const method = ctx.req.method
    const path = ctx.req.path
    const userAgent = ctx.req.header('User-Agent')
    const ipAddress =
      ctx.req.header('X-Forwarded-For') || ctx.req.header('CF-Connecting-IP') || 'unknown'

    // Extract user ID if available from context
    const userId = ctx.get('context')?.mmcUser?.userId

    // Execute next middleware/handler
    await next()

    // Calculate duration
    const duration = Date.now() - startTime
    const status = ctx.res.status

    // Determine log level based on status
    let level = 'info'
    if (status >= 500) {
      level = 'error'
    } else if (status >= 400) {
      level = 'warn'
    } else if (duration > 1000) {
      level = 'warn' // Slow requests
    }

    // Build log entry
    const logEntry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'api',
      correlation_id: correlationId,
      http_method: method,
      http_path: path,
      http_status: status,
      duration_ms: duration,
      user_id: userId,
      message: `${method} ${path} ${status} (+${duration}ms)`,
      details: {
        user_agent: userAgent,
        ip_address: ipAddress,
        ...(duration > 1000 && { slow_request: true }),
      },
    }

    // Log using structured logger
    if (level === 'error') {
      logger.error(logEntry, JSON.stringify(logEntry))
    } else if (level === 'warn') {
      logger.warn(logEntry, JSON.stringify(logEntry))
    } else {
      logger.info(logEntry, JSON.stringify(logEntry))
    }
  }
}

/**
 * Create simple in-memory logger if @zidney/logger not available
 * (fallback for development)
 */
export class SimpleLogger {
  info(_entry: RequestLogEntry, json: string) {
    // biome-ignore lint/suspicious/noConsole: SimpleLogger bridge — intentional console wrapper
    console.log(json)
  }

  warn(_entry: RequestLogEntry, json: string) {
    // biome-ignore lint/suspicious/noConsole: SimpleLogger bridge — intentional console wrapper
    console.warn(json)
  }

  error(_entry: RequestLogEntry, json: string) {
    // biome-ignore lint/suspicious/noConsole: SimpleLogger bridge — intentional console wrapper
    console.error(json)
  }
}
