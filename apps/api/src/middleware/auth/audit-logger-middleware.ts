/**
 * Audit Logger Middleware
 *
 * File: apps/api/src/middleware/auth/audit-logger-middleware.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Log all authenticated requests to audit trail.
 * Enables compliance, security monitoring, and forensic analysis.
 *
 * Execution Order: Last (after all processing, before response)
 *
 * What Gets Logged:
 * - Request start time + duration
 * - User ID + email
 * - HTTP method + path
 * - Response status code
 * - IP address + user agent
 * - Correlation ID (for request tracing)
 *
 * Structured JSON fields:
 * - correlation_id
 * - timestamp
 * - duration_ms
 * - method
 * - path
 * - status_code
 * - user_id
 * - user_email
 * - ip_address
 * - user_agent
 * - workspace_slug
 *
 * Performance:
 * - Minimal overhead (logs after response sent)
 * - Async logging (doesn't block response)
 */

import { Context, Next } from 'hono'
import pino from 'pino'

const logger = pino({
  name: 'api-audit',
  level: process.env.LOG_LEVEL || 'info',
})

/**
 * Log all API requests (authenticated routes)
 *
 * Execution Order: 7th (after route handler completes)
 */
export async function auditLoggerMiddleware(c: Context, next: Next) {
  const startTime = Date.now()

  await next()

  // Calculate request duration
  const duration = Date.now() - startTime

  // Collect audit data
  const correlationId = c.get('correlationId') || 'unknown'
  const userId = c.get('userId')
  const authPayload = c.get('authPayload')
  const isAuthenticated = c.get('isAuthenticated')
  const workspaceSlug = c.get('workspaceSlug') || 'unknown'

  // Only log if authenticated
  if (!isAuthenticated || !authPayload) {
    return
  }

  const logEntry = {
    correlation_id: correlationId,
    timestamp: new Date().toISOString(),
    duration_ms: duration,
    method: c.req.method,
    path: c.req.path,
    status_code: c.res.status,
    user_id: userId,
    user_email: authPayload.user_email,
    ip_address: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
    user_agent: c.req.header('User-Agent'),
    workspace_slug: workspaceSlug,
    role: 'role' in authPayload ? authPayload.role : undefined,
  }

  // Log with appropriate level based on status
  if (c.res.status >= 400) {
    logger.warn(logEntry, '[API Audit] Request completed with error')
  } else {
    logger.info(logEntry, '[API Audit] Request completed successfully')
  }
}

/**
 * Get audit logger instance
 */
export function getAuditLogger() {
  return logger
}
