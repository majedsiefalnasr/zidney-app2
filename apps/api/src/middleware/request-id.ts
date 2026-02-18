import { randomUUID } from 'crypto'
import { Context, Next } from 'hono'

/**
 * Request ID middleware - generates unique UUID for each request.
 * Request ID is propagated through all downstream middleware and handlers.
 *
 * Middleware attaches request ID to request context:
 * - c.get('request_id') - accessor via Hono context
 * - c.req.context.request_id - direct context access
 *
 * Request ID is returned in response headers for client trace correlation.
 */
export function requestIdMiddleware() {
  return async (c: Context, next: Next): Promise<void> => {
    // Extract request ID from header (for distributed tracing continuity)
    // or generate new UUID-v4 for this request
    const requestId = c.req.header('x-request-id') || randomUUID()

    // Attach to Hono context (string key access)
    c.set('request_id', requestId)

    // Initialize req context if not present
    if (!c.req.context) {
      c.req.context = {}
    }

    // Attach to req.context for downstream middleware access
    c.req.context.request_id = requestId

    // Add to response headers for client trace correlation
    c.header('x-request-id', requestId)

    // Continue to next middleware
    await next()
  }
}
