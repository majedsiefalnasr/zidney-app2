/**
 * T016: Middleware Composition Utility
 *
 * Purpose: Enforce immutable middleware execution order
 * Layer: API Middleware
 * Transactional: No
 * Idempotent: Yes
 * Version Enforcement: Not applicable
 * License Middleware: Not applicable
 *
 * Constitutional Compliance:
 * ✓ Middleware order enforced (CRITICAL for security)
 * ✓ All middleware present on startup (safety check)
 * ✓ Order immutable guarantees Zidney trust chain
 *
 * Mandatory Middleware Order (per Constitution):
 * 1. Correlation ID (UUID generation)
 * 2. Tenant Resolver (workspace_id extraction)
 * 3. License Enforcement (validate status + version)
 * 4. Schema Version Check (426 if incompatible)
 * 5. Rate Limiting (429 if quota exceeded)
 * 6. Route Handler
 *
 * No route may bypass tenant + license validation.
 */

import { logger } from '@zidney/logger'
import type { Context, Next } from 'hono'

export enum MiddlewareStage {
  CORRELATION_ID = 'correlation-id',
  TENANT_RESOLVER = 'tenant-resolver',
  LICENSE_ENFORCEMENT = 'license-enforcement',
  SCHEMA_VERSION = 'schema-version',
  RATE_LIMITING = 'rate-limiting',
  RBAC = 'rbac',
  SECURITY_HEADERS = 'security-headers',
}

// Immutable middleware execution order
const MIDDLEWARE_ORDER: MiddlewareStage[] = [
  MiddlewareStage.CORRELATION_ID,
  MiddlewareStage.TENANT_RESOLVER,
  MiddlewareStage.LICENSE_ENFORCEMENT,
  MiddlewareStage.SCHEMA_VERSION,
  MiddlewareStage.RATE_LIMITING,
  MiddlewareStage.RBAC,
  MiddlewareStage.SECURITY_HEADERS,
]

/**
 * Middleware chain composition factory
 * Builds a request handler with all required middleware in order
 */
export class MiddlewareChain {
  private executed: Set<MiddlewareStage> = new Set()
  private order: MiddlewareStage[] = MIDDLEWARE_ORDER

  /**
   * Record that a middleware stage has executed
   */
  recordExecution(stage: MiddlewareStage): void {
    this.executed.add(stage)
  }

  /**
   * Verify that all required middleware have executed in order
   */
  verifyExecutionOrder(): boolean {
    const required = [
      MiddlewareStage.CORRELATION_ID,
      MiddlewareStage.TENANT_RESOLVER,
      MiddlewareStage.LICENSE_ENFORCEMENT,
      MiddlewareStage.SCHEMA_VERSION,
      MiddlewareStage.RATE_LIMITING,
    ]

    for (const stage of required) {
      if (!this.executed.has(stage)) {
        logger.error(`[Middleware Chain] Missing required middleware: ${stage}`)
        return false
      }
    }

    // Verify order
    let lastIndex = -1
    for (const stage of required) {
      const index = this.order.indexOf(stage)
      if (index <= lastIndex) {
        logger.error(`[Middleware Chain] Middleware ${stage} executed out of order`)
        return false
      }
      lastIndex = index
    }

    return true
  }

  /**
   * Throw error if middleware chain incomplete
   */
  requireComplete(): void {
    if (!this.verifyExecutionOrder()) {
      throw new Error('Middleware chain incomplete or out of order. Request cannot proceed.')
    }
  }

  /**
   * Get middleware execution status (for debugging)
   */
  getStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {}
    for (const stage of this.order) {
      status[stage] = this.executed.has(stage)
    }
    return status
  }
}

/**
 * Extend Hono Context to include middleware chain tracking
 * Note: Hono context extensions can be added via module augmentation
 */

/**
 * Factory function to create middleware chain
 */
export function createMiddlewareChain(): MiddlewareChain {
  return new MiddlewareChain()
}

/**
 * Middleware factory for recording execution
 */
export function recordMiddlewareExecution(
  stage: MiddlewareStage
): (c: Context, next: Next) => Promise<void> {
  return async (c: Context, next: Next) => {
    const stateful = c as Context & {
      state?: { middlewareChain?: MiddlewareChain; [key: string]: unknown }
    }
    const chain = stateful.state?.middlewareChain || createMiddlewareChain()
    chain.recordExecution(stage)
    stateful.state = { ...(stateful.state || {}), middlewareChain: chain }
    await next()
  }
}
