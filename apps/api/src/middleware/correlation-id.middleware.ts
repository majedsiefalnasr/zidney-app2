/**
 * Correlation ID Middleware
 *
 * File: apps/api/src/middleware/correlation-id.middleware.ts
 * Task: T007
 * Phase: 2 - Infrastructure & Middleware
 *
 * Extract or generate correlation ID from request headers.
 * Store in request context for propagation through all logs and operations.
 * Ensures distributed tracing across services.
 *
 * Properties:
 * - Extracts from X-Correlation-Id header (if provided by client)
 * - Generates new UUID if not provided
 * - Stores in request.context.correlationId
 * - Propagates to all logs and audit trails
 */

import type { Context, Next } from 'hono'
import { v4 as uuidv4 } from 'uuid'

export interface RequestContext {
  correlationId: string
  mmcUser?: {
    userId: string
    roleId: string
    tokenVersion: number
  }
  checkedPermission?: {
    domain: string
    action: string
    allowed: boolean
  }
}

/**
 * Correlation ID Middleware
 *
 * Extracts correlation ID from headers or generates new UUID.
 * All request-scoped operations are linked via this ID.
 */
export async function correlationIdMiddleware(ctx: Context, next: Next): Promise<void> {
  // Extract correlation ID from request header or generate new one
  const correlationId = ctx.req.header('X-Correlation-Id') || uuidv4()

  // Initialize request context
  if (!ctx.get('context')) {
    ctx.set('context', {} as RequestContext)
  }

  const context = ctx.get('context') as RequestContext
  context.correlationId = correlationId

  // Add correlation ID to response headers
  ctx.header('X-Correlation-Id', correlationId)

  await next()
}

/**
 * Get request context from Hono context
 */
export function getRequestContext(ctx: Context): RequestContext {
  let context = ctx.get('context') as RequestContext | undefined
  if (!context) {
    context = { correlationId: uuidv4() } as RequestContext
    ctx.set('context', context)
  }
  return context
}
