/**
 * Middleware Orchestration — STAGE_06 Attempt Engine
 *
 * Purpose: Register middleware in correct order for attempt engine routes
 * Pattern: Middleware Priority Chain (strict order to ensure security)
 *
 * Phase: B – Middleware Integration
 * Stage: STAGE_06_ATTEMPT_ENGINE_FOUNDATION
 *
 * Constitutional Compliance:
 * - TenantResolver MUST be first (before any DB access)
 * - LicenseValidator MUST be second (before business logic)
 * - Correlation ID MUST be first global middleware (for all logs)
 * - Error normalizer MUST be last (error handler)
 *
 * Middleware Chain (STRICT ORDER):
 * ================================
 * 1. [GLOBAL] Correlation ID (generates request ID)
 * 2. [WORKSPACE] Tenant Resolver (extract workspace, load pool)
 * 3. [WORKSPACE] License Validator (check ACTIVE/SOFT_LOCKED/ARCHIVED)
 * 4. [WORKSPACE] Idempotency (deduplicate mutable requests)
 * 5. [WORKSPACE] Auth Context (validate JWT, extract user)
 * 6. [WORKSPACE] RBAC (verify user has permission)
 * 7. [ROUTE] Route handlers (business logic)
 * 8. [ERROR] Error Normalizer (catch and normalize errors)
 *
 * NEVER VIOLATE THIS ORDER!
 * - Tenant resolver BEFORE license validator (need workspace context)
 * - License validator BEFORE business logic (need to verify ACTIVE)
 * - Auth context BEFORE RBAC (need user before permission check)
 * - Correlation ID FIRST global (needs to be set for all logs)
 */

import type { Logger } from '@zidney/logger'
import type { Hono } from 'hono'

// Middleware imports
import { createAuthContextMiddlewareStage06 } from './auth-context-stage06'
import { correlationIdMiddlewareHono } from './correlation-id-hono'
import { createErrorNormalizerStage06 } from './error-normalizer-stage06'
import { createIdempotencyMiddlewareStage06 } from './idempotency-stage06'
import { createLicenseValidatorStage06 } from './license-validator-stage06'
import { createRBACMiddlewareStage06 } from './rbac-stage06'
import { createTenantResolverStage06 } from './tenant-resolver-stage06'

/**
 * Register middleware stack for attempt engine
 *
 * Usage:
 * ```
 * const app = new Hono()
 * registerMiddlewareStackStage06(app, logger, { redis, masterDb })
 * // Then register routes
 * ```
 */
export function registerMiddlewareStackStage06(
  app: Hono,
  logger: Logger,
  dependencies: {
    redis?: any
    masterDb?: any
    tenantPoolManager?: any
  }
) {
  // =========================================================================
  // GLOBAL MIDDLEWARE (applied to ALL routes)
  // =========================================================================

  // 1. Correlation ID — MUST be first (generate request tracking ID)
  app.use('*', correlationIdMiddlewareHono)

  // =========================================================================
  // WORKSPACE-SCOPED MIDDLEWARE (applied to /api/workspaces/*)
  // =========================================================================

  // 2. Tenant Resolver — MUST be second (extract workspace, load DB pool)
  app.use('/api/workspaces/*', createTenantResolverStage06(logger, dependencies.tenantPoolManager))

  // 3. License Validator — MUST be third (verify ACTIVE/SOFT_LOCKED/ARCHIVED)
  // Applied BEFORE any business logic to prevent DB access if not licensed
  app.use('/api/workspaces/*', createLicenseValidatorStage06(logger))

  // 4. Idempotency Middleware — After license, before RBAC
  // Deduplicates mutable requests (POST, PUT, PATCH, DELETE)
  app.use('/api/workspaces/*', createIdempotencyMiddlewareStage06(logger, dependencies.redis))

  // 5. Auth Context — Validate JWT and extract user
  app.use('/api/workspaces/*', createAuthContextMiddlewareStage06(logger))

  // 6. RBAC Middleware — Check user has permission
  app.use('/api/workspaces/*', createRBACMiddlewareStage06(logger))

  // =========================================================================
  // ERROR HANDLER (must be last)
  // =========================================================================

  // Error normalizer — Catch all errors and normalize to RFC 7807 format
  app.onError(createErrorNormalizerStage06(logger))

  logger.info('Middleware stack registered for STAGE_06', {
    stack: [
      'correlationId',
      'tenantResolver',
      'licenseValidator',
      'idempotency',
      'authContext',
      'rbac',
      'errorHandler',
    ].join(' → '),
  })
}

/**
 * Middleware Priority Documentation
 *
 * PRIORITY ORDER (top = first):
 * =============================
 *
 * 1. [CRITICAL] Correlation ID
 *    - Must be first to set correlation_id for all logs
 *    - Generates UUID if not provided
 *    - Attaches to response headers
 *
 * 2. [CRITICAL] Tenant Resolver
 *    - Extracts workspace slug from request (subdomain or path)
 *    - Resolves workspace ID from tenant registry
 *    - Loads database connection pool
 *    - Attaches to req.tenant, req.tenantDb
 *    - BEFORE any other middleware (all others need tenant context)
 *
 * 3. [CRITICAL] License Validator
 *    - Queries master DB for license status
 *    - Returns 403 if ARCHIVED, 423 if SOFT_LOCKED
 *    - Returns 426 if schema/product version incompatible
 *    - BEFORE business logic (prevents DB access if not licensed)
 *
 * 4. [IMPORTANT] Idempotency Middleware
 *    - Checks Redis cache for idempotency_key (fast path)
 *    - Falls back to PostgreSQL submission_idempotency_keys table
 *    - Returns cached response if hit
 *    - Proceeds to route if miss
 *    - AFTER license (need valid license to query DB)
 *    - BEFORE auth (some requests may not require auth but need idempotency)
 *
 * 5. [IMPORTANT] Auth Context
 *    - Extracts Bearer token from Authorization header
 *    - Validates JWT format and claims
 *    - Extracts user_id, email, roles
 *    - Returns 401 if invalid/missing
 *    - Attaches to req.user
 *    - BEFORE RBAC (RBAC needs user context)
 *
 * 6. [IMPORTANT] RBAC Middleware
 *    - Checks user.roles for required permissions
 *    - Verifies user not suspended/restricted
 *    - Attaches permission flags to req.rbac
 *    - Returns 403 if denied
 *    - AFTER auth (needs user context)
 *    - BEFORE route logic (gate access early)
 *
 * 7. [NOT MIDDLEWARE] Route Handlers
 *    - Execute business logic
 *    - Have access to:
 *      - req.correlationId (set by step 1)
 *      - req.tenant (set by step 2)
 *      - req.tenantDb (set by step 2)
 *      - req.license (set by step 3)
 *      - req.user (set by step 5)
 *      - req.rbac (set by step 6)
 *      - req.idempotencyKey (set by step 4)
 *
 * 8. [LAST] Error Handler
 *    - Catches all errors from downstream
 *    - Normalizes to RFC 7807 + correlation_id
 *    - Returns appropriate HTTP status
 *    - Logs error with correlation_id
 *
 * WHY THIS ORDER?
 * ===============
 *
 * ✓ Correlation ID first: All logs need it
 * ✓ Tenant resolver second: All other middleware need tenant context
 * ✓ License validator third: Prevent DB access if not licensed
 * ✓ Idempotency before RBAC: Some endpoints don't need auth but need idempotency
 * ✓ Auth before RBAC: RBAC needs user context
 * ✓ Route logic after all middleware: Have all context available
 * ✓ Error handler last: Catch all errors from middleware + routes
 *
 * VIOLATIONS ARE BUGS
 * ===================
 *
 * If you:
 * - Put license validator BEFORE tenant resolver → ERROR (no tenant context)
 * - Put RBAC BEFORE auth → ERROR (no user context)
 * - Put idempotency AFTER auth → RISK (some endpoints need idempotency without auth)
 * - Put error handler BEFORE routes → ERROR (won't catch route errors)
 *
 * Configuration is LOCKED. Changes require ADR approval.
 */

export default registerMiddlewareStackStage06
