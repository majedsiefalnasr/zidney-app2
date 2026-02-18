/**
 * Correlation ID Middleware — Hono Version — STAGE_06 Attempt Engine
 *
 * Purpose: Generate/propagate unique request ID for distributed tracing
 * Middleware Priority: FIRST (before all others)
 *
 * Task: T015 (Part 1) – Correlation ID propagator
 * Phase: B – Middleware Integration
 * Stage: STAGE_06_ATTEMPT_ENGINE_FOUNDATION
 *
 * Constitutional Compliance:
 * - Correlation ID attached to EVERY request
 * - Propagated to all logs for tracing
 * - Included in response headers for client tracking
 * - Enables RCA (root cause analysis) across services
 *
 * Usage:
 * ```
 * app.use('*', correlationIdMiddlewareHono)
 * // Now all downstream have c.get('correlationId')
 * ```
 */

import { Context, MiddlewareHandler } from 'hono'
import { v4 as uuidv4 } from 'uuid'

/**
 * Generate correlation ID middleware for Hono
 *
 * 1. Checks request headers for X-Correlation-ID or X-Request-ID
 * 2. If not found: generates new UUID
 * 3. Attaches to context: c.set('correlationId', id)
 * 4. Attaches to response headers: X-Correlation-ID, X-Request-ID
 * 5. Proceeds to next middleware
 */
export const correlationIdMiddlewareHono: MiddlewareHandler = async (
  c: Context,
  next
) => {
  // Check for existing correlation ID in request headers
  const existingId =
    c.req.header('x-correlation-id') ||
    c.req.header('X-Correlation-ID') ||
    c.req.header('x-request-id') ||
    c.req.header('X-Request-ID') ||
    c.req.header('traceparent')

  // Use existing or generate new UUID
  const correlationId = existingId || uuidv4()

  // Attach to context for downstream middleware/handlers
  c.set('correlationId', correlationId)

  // Proceed to next middleware
  await next()

  // Set response headers AFTER route is handled
  // This allows errors to also include the correlation ID
  c.header('x-correlation-id', correlationId)
  c.header('X-Correlation-ID', correlationId)
  c.header('x-request-id', correlationId)
  c.header('X-Request-ID', correlationId)
}

/**
 * Extract correlation ID from Hono context
 *
 * Usage in route handler:
 * ```
 * const cid = getCorrelationIdFromContext(c)
 * ```
 */
export function getCorrelationIdFromContext(c: Context): string {
  return c.get('correlationId') || 'unknown'
}

export default correlationIdMiddlewareHono
