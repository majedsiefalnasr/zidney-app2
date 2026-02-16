import type { NextFunction, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'

/**
 * T062: Request ID / Correlation ID Middleware
 * Generates unique identifier per request for distributed tracing
 */

declare global {
  namespace Express {
    interface Request {
      correlationId: string
    }
  }
}

/**
 * Generate correlation ID middleware
 * Uses UUID v7 (timestamp-based) for sortability
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check for existing correlationId (from upstream)
  const existingId =
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    req.headers['traceparent']

  if (typeof existingId === 'string') {
    req.correlationId = existingId
  } else {
    // Generate new UUID if none provided
    req.correlationId = uuidv4()
  }

  // Add to response headers for client tracking
  res.setHeader('x-correlation-id', req.correlationId)
  res.setHeader('x-request-id', req.correlationId)

  // Add to response locals for downstream middleware
  res.locals.correlationId = req.correlationId

  next()
}

/**
 * Extract correlation ID from request
 */
export function getCorrelationId(req: Request): string {
  return req.correlationId || 'unknown'
}
