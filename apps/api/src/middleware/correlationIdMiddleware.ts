/**
 * Correlation ID Middleware
 *
 * Extracts or generates a correlation ID from request headers.
 * Sets it on context for all downstream handlers.
 * Returns correlation ID in response header.
 *
 * Stage: STAGE_09_PRODUCTS
 * Task: T028
 */

import type { Context, Next } from 'hono'
import { v4 as uuidv4 } from 'uuid'

/**
 * Correlation ID middleware
 *
 * Extracts or generates x-correlation-id header and sets on context.
 * All downstream operations use this ID for tracing.
 */
export async function correlationIdMiddleware(
  c: Context,
  next: Next
): Promise<void> {
  // Extract or generate correlation ID
  const headerValue =
    c.req.header('x-correlation-id') || c.req.header('correlation-id')
  const correlationId =
    headerValue && typeof headerValue === 'string' ? headerValue : uuidv4()

  // Set on context
  c.set('correlationId', correlationId)

  // Continue to next handler
  await next()

  // Set response header
  c.header('x-correlation-id', correlationId)
}

/**
 * Get correlation ID from context
 */
export function getCorrelationId(c: Context): string {
  const id = c.get('correlationId')
  return typeof id === 'string' ? id : uuidv4()
}
