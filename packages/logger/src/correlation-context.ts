/**
 * Correlation Context
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Provides async context propagation for correlation IDs and workspace context.
 *
 * Uses AsyncLocalStorage to maintain context across async boundaries.
 * This ensures correlation IDs are available in nested async calls without
 * explicit parameter passing.
 *
 * Usage:
 *   const correlationContext = new CorrelationContext('uuid-1234', 'acme-workspace');
 *   await correlationContext.run(async () => {
 *     // correlation ID available in all nested calls
 *     const id = getCorrelationId(); // returns 'uuid-1234'
 *   });
 */

import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Correlation Context Data
 */
export interface CorrelationContextData {
  correlationId: string
  workspaceSlug?: string
  licenseId?: string
  userId?: string
  requestId?: string
  startTime: number // milliseconds since epoch
}

/**
 * Global async local storage for correlation context
 */
const correlationStorage = new AsyncLocalStorage<CorrelationContextData>()

/**
 * Set correlation context for async operation
 */
export class CorrelationContext {
  private data: CorrelationContextData

  constructor(
    correlationId: string,
    workspaceSlug?: string,
    licenseId?: string,
    userId?: string
  ) {
    this.data = {
      correlationId,
      workspaceSlug,
      licenseId,
      userId,
      startTime: Date.now(),
    }
  }

  /**
   * Run async operation within this correlation context
   */
  async run<T>(callback: () => Promise<T>): Promise<T> {
    return correlationStorage.run(this.data, callback)
  }

  /**
   * Run sync operation within this correlation context
   */
  runSync<T>(callback: () => T): T {
    return correlationStorage.run(this.data, callback)
  }
}

/**
 * Get current correlation context data
 */
export function getCorrelationContextData():
  | CorrelationContextData
  | undefined {
  return correlationStorage.getStore()
}

/**
 * Get current correlation ID
 */
export function getCorrelationId(): string {
  return correlationStorage.getStore()?.correlationId || 'unknown'
}

/**
 * Get current workspace slug
 */
export function getWorkspaceSlug(): string | undefined {
  return correlationStorage.getStore()?.workspaceSlug
}

/**
 * Get current license ID
 */
export function getLicenseId(): string | undefined {
  return correlationStorage.getStore()?.licenseId
}

/**
 * Get current user ID
 */
export function getUserId(): string | undefined {
  return correlationStorage.getStore()?.userId
}

/**
 * Get elapsed time since context creation (milliseconds)
 */
export function getElapsedTime(): number {
  const context = correlationStorage.getStore()
  if (!context) return 0
  return Date.now() - context.startTime
}

/**
 * Create correlation ID (UUID format)
 */
export function createCorrelationId(): string {
  // Using crypto.randomUUID when available (Node.js 15+)
  return crypto.randomUUID?.() || generateUuid()
}

/**
 * Fallback UUID generator for older Node versions
 */
function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Middleware helper: Create and set correlation context from request headers
 */
export function correlationIdFromHeaders(
  headers: Record<string, string | string[]>
): string {
  // Check for X-Correlation-ID header
  const correlationId =
    headers['x-correlation-id'] ||
    headers['correlation-id'] ||
    headers['x-request-id']

  if (typeof correlationId === 'string') {
    return correlationId
  }

  if (Array.isArray(correlationId)) {
    return correlationId[0] || createCorrelationId()
  }

  return createCorrelationId()
}

/**
 * Extract correlation context from request headers and metadata
 */
export function extractCorrelationContext(
  headers: Record<string, string | string[]>,
  metadata?: { workspaceSlug?: string; licenseId?: string; userId?: string }
): CorrelationContextData {
  return {
    correlationId: correlationIdFromHeaders(headers),
    workspaceSlug: metadata?.workspaceSlug,
    licenseId: metadata?.licenseId,
    userId: metadata?.userId,
    startTime: Date.now(),
  }
}

/**
 * Middleware factory: Express-style correlation ID middleware
 */
export function correlationIdMiddleware(req: any, res: any, next: any): void {
  const correlationId = correlationIdFromHeaders(req.headers)
  req.correlationId = correlationId
  res.setHeader('X-Correlation-ID', correlationId)
  next()
}

/**
 * Format correlation context for logging
 */
export function formatCorrelationContext(): Record<string, unknown> {
  const context = correlationStorage.getStore()
  if (!context) {
    return { correlation_id: 'unknown' }
  }

  return {
    correlation_id: context.correlationId,
    workspace_slug: context.workspaceSlug,
    license_id: context.licenseId,
    user_id: context.userId,
    elapsed_ms: Date.now() - context.startTime,
  }
}

/**
 * Propagate correlation context to async child tasks
 */
export async function propagateCorrelationContext<T>(
  task: () => Promise<T>
): Promise<T> {
  const context = correlationStorage.getStore()
  if (!context) {
    return task()
  }
  return correlationStorage.run(context, task)
}

/**
 * Create child context with additional metadata
 */
export function createChildContext(
  additional: Partial<CorrelationContextData>
): CorrelationContextData {
  const current = correlationStorage.getStore()
  return {
    ...current,
    ...additional,
    startTime: additional.startTime || Date.now(),
  }
}
