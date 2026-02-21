import { createLogger } from '@zidney/logging'
import { Context, Next } from 'hono'

const baseLogger = createLogger('correlation')

/**
 * Correlation context middleware - binds request-scoped context to child logger.
 *
 * Executes AFTER tenant resolver and license middleware (immutable order per constitution).
 *
 * Middleware:
 * 1. Extracts request_id from req.context (set by request-id middleware)
 * 2. Extracts workspace_id from tenant resolver context
 * 3. Extracts workspace_slug from tenant resolver context
 * 4. Extracts user_id from authentication context (if authenticated)
 * 5. Creates child logger with all context fields
 * 6. Attaches child logger to context for handler access
 * 7. Logs request_received event with method, path, remote_addr
 * 8. Logs request_completed event after response with status, duration
 */
export function correlationMiddleware() {
  return async (c: Context, next: Next): Promise<void> => {
    const requestId = c.get('request_id') as string
    const startTime = Date.now()

    // Extract context from middleware/resolver data
    const workspaceId = c.get('workspace_id') as string | undefined
    const workspaceSlug = c.get('workspace_slug') as string | undefined
    const userId = c.get('user_id') as string | undefined

    // Build context for child logger
    const childContext: {
      correlation_id: string
      workspace_id?: string
      workspace_slug?: string
      user_id?: string
    } = { correlation_id: requestId }

    if (workspaceId) {
      childContext.workspace_id = workspaceId
    }
    if (workspaceSlug) {
      childContext.workspace_slug = workspaceSlug
    }
    if (userId) {
      childContext.user_id = userId
    }

    // Create child logger with context (all subsequent logs include these fields)
    const childLogger = baseLogger.child(childContext)

    // Attach child logger to context for handler access
    c.set('logger', childLogger)

    // Log request received
    childLogger.info('request_received', {
      method: c.req.method,
      path: c.req.path,
      remote_addr:
        c.req.header('x-forwarded-for') ||
        c.req.header('x-real-ip') ||
        'unknown',
      user_agent: c.req.header('user-agent'),
      query_string: c.req.url.split('?')[1] || undefined,
    })

    // Execute next middleware and route handler
    await next()

    // Log request completed
    const duration = Date.now() - startTime
    const status = c.res.status

    childLogger.info('request_completed', {
      status_code: status,
      duration_ms: duration,
      content_type: c.res.headers.get('content-type'),
    })
  }
}
