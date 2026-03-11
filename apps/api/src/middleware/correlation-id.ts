/**
 * T017: Correlation ID Middleware
 *
 * Purpose: Generate or extract request correlation ID (UUID v4)
 * Layer: API Middleware (STAGE 1 of 5 - must be first)
 * Transactional: No
 * Idempotent: Yes
 * Version Enforcement: Not applicable
 * License Middleware: Not applicable
 *
 * Constitutional Compliance:
 * ✓ Correlation ID propagation (required for all structured logging)
 * ✓ Traceability enabled (all downstream logs tagged)
 * ✓ Structured logging ready (correlation_id in all logs)
 *
 * Execution Order: #1 (FIRST - before tenant resolver)
 * All logs must include correlationId from request context
 */

import { logger } from '@zidney/logger'
import type { Context, Next } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { MiddlewareStage, recordMiddlewareExecution } from './middleware-chain'

/**
 * Correlation ID middleware
 * Generates UUID v4 or extracts from X-Request-ID header
 */
export async function correlationIdMiddleware(c: Context, next: Next): Promise<void> {
  // T017: Generate or extract correlation ID
  let correlationId = c.req.header('x-request-id') || c.req.header('x-correlation-id')

  if (!correlationId) {
    // Generate new UUID v4 if not provided
    correlationId = uuidv4()
  }

  // Validate format (UUID v4)
  if (!isValidUUID(correlationId)) {
    correlationId = uuidv4()
  }

  // Store in request context
  c.state.requestId = correlationId
  c.state.correlationId = correlationId

  // Store in request timestamp for latency tracking
  c.state.requestStartTime = Date.now()

  // Add to response headers
  c.header('x-request-id', correlationId)
  c.header('x-correlation-id', correlationId)

  // Record execution in middleware chain
  const recordExecution = recordMiddlewareExecution(MiddlewareStage.CORRELATION_ID)
  await recordExecution(c, next)

  // Log after request completes
  const duration = Date.now() - c.state.requestStartTime
  const method = c.req.method
  const path = c.req.path
  const statusCode = c.res.status

  logger.info('request_completed', {
    service: 'api',
    event: 'request_completed',
    correlation_id: correlationId,
    method,
    path,
    status_code: statusCode,
    duration_ms: duration,
  })
}

/**
 * Validate UUID v4 format
 */
function isValidUUID(uuid: string): boolean {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidV4Regex.test(uuid)
}

/**
 * Helper function to get correlation ID from context
 */
export function getCorrelationId(c: Context): string {
  return c.state.correlationId || 'unknown'
}

/**
 * Helper function to add correlation ID to logs
 */
export function logWithCorrelation(
  message: string,
  level: 'info' | 'warn' | 'error' | 'debug' = 'info',
  context?: Record<string, unknown>
): void {
  logger[level](message, { service: 'api', ...(context || {}) })
}
