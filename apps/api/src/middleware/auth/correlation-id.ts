/**
 * Correlation ID Middleware
 *
 * File: apps/api/src/middleware/auth/correlation-id.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Generate and propagate unique correlation ID for request tracing.
 * Enables distributed tracing across services and audit log queries.
 *
 * Mechanism:
 * - If request has X-Correlation-ID header, use it
 * - Otherwise generate new UUID v4
 * - Attach to Hono context
 * - All downstream middleware/logs use this ID
 *
 * Benefits:
 * - Trace single user request across multiple services
 * - Correlate all audit events/logs for incident investigation
 * - Debug production issues with complete request history
 *
 * Usage:
 * ```
 * // All logs automatically include correlation_id:
 * GET /api/protected with correlation_id "req-uuid-123"
 * → 3 auth checks, 2 RBAC queries, 1 data fetch
 * → All logs tagged with "req-uuid-123"
 * → Query: SELECT * FROM audit_logs WHERE correlation_id = 'req-uuid-123'
 * → Get complete request trace
 * ```
 */

import { Context, Next } from 'hono'
import { v4 as uuidv4 } from 'uuid'

/**
 * Generate or extract correlation ID and attach to context
 *
 * Execution Order: 2nd (after tenant resolver, before JWT validation)
 *
 * Sets context:
 * - correlationId: Unique identifier for this request
 */
export async function correlationIdMiddleware(c: Context, next: Next) {
  // Check if client provided correlation ID
  const clientProvidedId = c.req.header('X-Correlation-ID')

  // Use client ID if valid, otherwise generate new
  const correlationId = clientProvidedId || uuidv4()

  // Validate format: allow UUIDs or alphanumeric+dash (max 50 chars)
  const isValidFormat = /^[a-zA-Z0-9\-]{8,50}$/.test(correlationId)

  if (!isValidFormat) {
    // Invalid format provided, generate new one
    const newId = uuidv4()
    c.set('correlationId', newId)
    c.res.headers.set('X-Correlation-ID', newId)
    await next()
    return
  }

  // Valid correlation ID, attach to context
  c.set('correlationId', correlationId)

  // Also set in response headers (client can use for support queries)
  c.res.headers.set('X-Correlation-ID', correlationId)

  await next()
}

/**
 * Get correlation ID from context (helper for logs)
 */
export function getCorrelationId(c: Context): string {
  return c.get('correlationId') || 'unknown'
}
