/**
 * Stage 06 Routes Registration
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase C, T027
 *
 * Purpose: Register all Phase C attempt engine endpoints
 * Responsibility: Route binding, middleware orchestration, error mapping
 *
 * Endpoints Registered:
 * - POST /api/workspaces/:slug/attempts (create)
 * - PATCH /api/workspaces/:slug/attempts/:id/progress (progress)
 * - GET /api/workspaces/:slug/attempts/:id (status)
 *
 * Middleware Stack (per endpoint):
 * 1. Correlation ID (global)
 * 2. Tenant Resolver (extract workspace)
 * 3. License Validator (ACTIVE/SOFT_LOCKED/ARCHIVED)
 * 4. Idempotency (mutable requests only)
 * 5. Auth Context (JWT validation)
 * 6. RBAC (permission gating)
 * 7. Route Handler (business logic)
 * 8. Error Normalizer (catch and normalize)
 *
 * Constitutional Compliance:
 * - All routes require tenant resolver
 * - All routes require license validator
 * - All routes require auth context
 * - Error responses normalized to RFC 7807 format
 */

import type { Logger } from '@zidney/logger'
import type { Hono } from 'hono'
import { createAttemptHandler } from './create'
import { updateProgressHandler } from './progress'
import { getAttemptStatusHandler } from './status'

/**
 * Register all Stage 06 attempt engine routes
 *
 * Usage:
 * ```typescript
 * const app = new Hono()
 * registerStage06Routes(app, logger)
 * ```
 */
export function registerStage06Routes(app: Hono, logger: Logger): void {
  // =========================================================================
  // ATTEMPT CREATION ENDPOINTS
  // =========================================================================

  /**
   * POST /api/workspaces/:slug/attempts
   * Create new attempt
   *
   * Middleware: tenantResolver → licenseValidator → authContext → rbac
   * Authorization: RBAC (student/instructor can create)
   * Response: 201 Created
   */
  app.post('/api/workspaces/:slug/attempts', createAttemptHandler)

  logger.info('Registered route: POST /api/workspaces/:slug/attempts', {
    handler: 'createAttemptHandler',
    middleware: 'tenantResolver → licenseValidator → authContext → rbac',
  })

  // =========================================================================
  // PROGRESS TRACKING ENDPOINTS
  // =========================================================================

  /**
   * PATCH /api/workspaces/:slug/attempts/:id/progress
   * Update attempt progress (autosave)
   *
   * Middleware: tenantResolver → licenseValidator → idempotency → authContext → rbac
   * Authorization: RBAC (attempt owner only)
   * Idempotency: UPSERT ON CONFLICT (attempt_id, question_id)
   * Response: 200 OK
   */
  app.patch('/api/workspaces/:slug/attempts/:id/progress', updateProgressHandler)

  logger.info('Registered route: PATCH /api/workspaces/:slug/attempts/:id/progress', {
    handler: 'updateProgressHandler',
    middleware: 'tenantResolver → licenseValidator → idempotency → authContext → rbac',
    idempotency: 'UPSERT method',
  })

  // =========================================================================
  // STATUS & METADATA ENDPOINTS
  // =========================================================================

  /**
   * GET /api/workspaces/:slug/attempts/:id
   * Get attempt status and progress
   *
   * Middleware: tenantResolver → licenseValidator → authContext → rbac
   * Authorization: RBAC (attempt owner or instructor/admin)
   * Response: 200 OK (varies by status)
   */
  app.get('/api/workspaces/:slug/attempts/:id', getAttemptStatusHandler)

  logger.info('Registered route: GET /api/workspaces/:slug/attempts/:id', {
    handler: 'getAttemptStatusHandler',
    middleware: 'tenantResolver → licenseValidator → authContext → rbac',
  })

  logger.info('Stage 06 attempt engine routes registered successfully', {
    total_endpoints: 3,
    create: 1,
    progress: 1,
    status: 1,
  })
}

/**
 * Route Documentation
 *
 * POST /api/workspaces/:slug/attempts
 * ===================================
 * Create new attempt
 *
 * Request:
 *   - exam_id (required, UUID)
 *   - attempt_mode (optional, RELAX|CHRONO|RUSH, default CHRONO)
 *   - notes (optional, string ≤1000 chars)
 *
 * Success Response (201):
 *   - id, workspace_id, user_id, exam_id
 *   - status (IN_PROGRESS)
 *   - started_at, server_start_time
 *   - mode, time_limit_seconds, question_count
 *   - questions[] (id, text, type, options, points)
 *
 * Errors:
 *   - 400: Invalid request format
 *   - 404: Exam not found
 *   - 409: In-progress attempt already exists
 *   - 423: License soft-locked
 *   - 426: Version incompatible
 *
 * ---
 *
 * PATCH /api/workspaces/:slug/attempts/:id/progress
 * ==================================================
 * Autosave attempt progress
 *
 * Request:
 *   - question_index (required, integer ≥ 0)
 *   - user_response (required, object)
 *     - MCQ: { selected_option: "A" | selected: ["A", "B"] }
 *     - SHORT_ANSWER: { text: string }
 *     - ESSAY: { text: string }
 *     - TRUE_FALSE: { selected_option: "true"|"false" }
 *     - MATCHING: { matches: [{from: string, to: string}] }
 *     - ORDERING: { order: [string] }
 *
 * Success Response (200):
 *   - attempt_id, responses_saved
 *   - time_remaining_seconds
 *   - saved_at, server_time
 *
 * Errors:
 *   - 400: Invalid request format or question index out of range
 *   - 404: Attempt not found
 *   - 409: Attempt not in progress
 *   - 410: Time limit exceeded
 *   - 422: Invalid response format
 *
 * ---
 *
 * GET /api/workspaces/:slug/attempts/:id
 * =======================================
 * Get attempt status and metadata
 *
 * Response (varies by status):
 *
 * IN_PROGRESS (200):
 *   - id, status
 *   - started_at, server_start_time
 *   - mode, time_limit_seconds, time_remaining_seconds
 *   - progress: { answered_count, flagged_count, total_questions }
 *
 * SUBMITTED (200):
 *   - id, status
 *   - submitted_at, score, passed
 *
 * FINALIZED (200):
 *   - id, status
 *   - submitted_at, finalized_at
 *   - score, passed, result
 *
 * EXPIRED (200):
 *   - id, status
 *   - expired_at, time_limit_seconds
 *
 * Errors:
 *   - 403: Access denied (not owner or insufficient permissions)
 *   - 404: Attempt not found
 */

/**
 * Middleware Stack Documentation
 *
 * REQUEST FLOW:
 * =============
 *
 * 1. HTTP Request arrives (e.g., POST /api/workspaces/acme/attempts)
 *
 * 2. Correlation ID Middleware (GLOBAL)
 *    - Generates UUID for request tracing
 *    - Attaches to c.get('correlationId')
 *    - Propagates to all logs
 *
 * 3. Tenant Resolver Middleware
 *    - Extracts workspace slug from path (:slug parameter)
 *    - Resolves workspace ID from tenant registry (master DB)
 *    - Loads database connection pool for tenant
 *    - Attaches to c.get('workspace') and c.get('tenantDb')
 *    - Returns 404 if workspace not found
 *
 * 4. License Validator Middleware
 *    - Queries license status from master DB
 *    - Validates schema_version compatibility
 *    - Validates product_version compatibility
 *    - Returns 403 if ARCHIVED
 *    - Returns 423 if SOFT_LOCKED
 *    - Returns 426 if version mismatch
 *    - Attaches license metadata to c.get('license')
 *
 * 5. Idempotency Middleware (POST/PATCH/DELETE only)
 *    - Checks Redis cache for idempotency_key
 *    - Falls back to PostgreSQL submission_idempotency_keys table
 *    - Returns cached response if hit (idempotent)
 *    - Generates new key if miss
 *    - Attaches to c.get('idempotencyKey')
 *
 * 6. Auth Context Middleware
 *    - Extracts Bearer token from Authorization header
 *    - Validates JWT format and claims
 *    - Extracts user_id, email, roles
 *    - Verifies user.workspace_id matches request workspace
 *    - Attaches to c.get('user') (UserContextStage06)
 *    - Returns 401 if invalid/missing
 *
 * 7. RBAC Middleware
 *    - Verifies user.roles for required permissions
 *    - Checks user not suspended/restricted
 *    - Attaches permission flags to c.get('rbac')
 *    - Returns 403 if denied
 *
 * 8. Route Handler
 *    - Executes business logic
 *    - Access to all context from steps 1-7
 *    - Returns response or throws error
 *
 * 9. Error Normalizer (Hono onError handler)
 *    - Catches all errors from middleware/handler
 *    - Normalizes to RFC 7807 format
 *    - Adds correlation_id to all errors
 *    - Returns appropriate HTTP status
 *    - Logs error with full context
 *
 * ERROR HANDLING:
 * ===============
 *
 * Errors are thrown with structure:
 * ```typescript
 * throw {
 *   code: 'ERROR_CODE',
 *   message: 'Human-readable message',
 *   status: 400,  // Optional (uses code→status mapping)
 * }
 * ```
 *
 * Error normalizer maps code → HTTP status and formats response:
 * ```json
 * {
 *   "success": false,
 *   "data": null,
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Human-readable message",
 *     "status": 400,
 *     "correlation_id": "uuid-from-middleware",
 *     "timestamp": "2026-02-18T14:30:00Z"
 *   }
 * }
 * ```
 */

export default registerStage06Routes
