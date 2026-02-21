/**
 * Stage 06 Phase D Route Registration
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION – Phase D, T036
 *
 * Purpose: Register submit and result endpoints (Phase D)
 * Responsibility: Route binding, middleware orchestration
 *
 * Endpoints Registered:
 * - POST /api/workspaces/:slug/attempts/:id/submit (T028)
 * - GET /api/workspaces/:slug/attempts/:id/result (T031)
 *
 * Middleware Stack (both endpoints):
 * 1. Correlation ID (global)
 * 2. Tenant Resolver (extract workspace)
 * 3. License Validator (ACTIVE/SOFT_LOCKED status allowed for submit)
 * 4. Idempotency Key (for submit)
 * 5. Auth Context (JWT validation)
 * 6. RBAC (permission gating)
 * 7. Route Handler (business logic)
 * 8. Error Normalizer (catch and normalize)
 *
 * Constitutional Compliance:
 * - All routes require tenant resolver
 * - All routes require license validator (allow SOFT_LOCKED)
 * - All routes require auth context
 * - Error responses normalized to RFC 7807 format
 */

import { Logger } from '@zidney/logging'
import { Hono } from 'hono'
import { getAttemptResultHandler } from './result'
import { submitAttemptHandler } from './submit'

/**
 * Register Phase D (submit + result) routes
 *
 * Usage:
 * ```typescript
 * const app = new Hono()
 * registerStage06Phase DRoutes(app, logger)
 * ```
 */
export function registerStage06PhaseDRoutes(app: Hono, logger: Logger): void {
  // =========================================================================
  // SUBMISSION ENDPOINT (T028)
  // =========================================================================

  /**
   * POST /api/workspaces/:slug/attempts/:id/submit
   * Submit attempt for grading
   *
   * Middleware: tenantResolver → licenseValidator → idempotency → authContext → rbac
   * Authorization: RBAC (attempt owner only, instructor optional)
   * Response: 202 Accepted (async grading)
   * Idempotency: X-Idempotency-Key header (triple-layer check)
   */
  app.post('/api/workspaces/:slug/attempts/:id/submit', submitAttemptHandler)

  logger.info(
    'Registered route: POST /api/workspaces/:slug/attempts/:id/submit',
    {
      handler: 'submitAttemptHandler',
      middleware:
        'tenantResolver → licenseValidator → idempotency → authContext → rbac',
      response_code: 202,
      description:
        'Submit attempt for async grading (pessimistic lock, triple-layer idempotency)',
    }
  )

  // =========================================================================
  // RESULT POLLING ENDPOINT (T031)
  // =========================================================================

  /**
   * GET /api/workspaces/:slug/attempts/:id/result
   * Poll for async grading result
   *
   * Middleware: tenantResolver → licenseValidator → authContext → rbac
   * Authorization: RBAC (attempt owner or instructor/admin)
   * Response: 202 (processing) or 200 (complete)
   * Headers: Retry-After (when 202)
   */
  app.get('/api/workspaces/:slug/attempts/:id/result', getAttemptResultHandler)

  logger.info(
    'Registered route: GET /api/workspaces/:slug/attempts/:id/result',
    {
      handler: 'getAttemptResultHandler',
      middleware: 'tenantResolver → licenseValidator → authContext → rbac',
      response_code: '202 (polling) or 200 (result)',
      description: 'Poll for async grading result',
    }
  )

  logger.info(
    'Stage 06 Phase D (submit + result) routes registered successfully',
    {
      total_endpoints: 2,
      submit: 1,
      result: 1,
    }
  )
}

/**
 * Route Documentation
 *
 * POST /api/workspaces/:slug/attempts/:id/submit
 * ==============================================
 * Submit attempt for grading
 *
 * Headers:
 *   - Authorization: Bearer <jwt>
 *   - X-Idempotency-Key: <uuid> (required, for deduplication)
 *   - X-Correlation-ID: <uuid> (optional, for tracing)
 *
 * Request Body:
 *   {
 *     "reason": "COMPLETED|TIME_UP|INTERRUPTED",
 *     "submission_reason": "completed_exam|time_expired|student_abort",
 *     "all_responses": [
 *       {
 *         "question_index": 0,
 *         "user_response": {...}
 *       },
 *       ...
 *     ]
 *   }
 *
 * Success Response (202 Accepted):
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "attempt-uuid",
 *       "status": "SUBMITTED",
 *       "submitted_at": "2026-02-18T10:35:00Z",
 *       "server_time": "2026-02-18T10:35:00Z",
 *       "job_id": "job-uuid",
 *       "polling_url": "/api/workspaces/:slug/attempts/:id/result"
 *     },
 *     "error": null
 *   }
 *
 * Error Responses:
 *   - 400: Invalid submission data (validation error)
 *   - 404: Attempt not found or not owner
 *   - 409: Already submitted, or lock timeout, or time exceeded
 *   - 423: License soft-locked (grading postponed)
 *   - 500: Server error (job queue unavailable)
 *
 * Business Logic:
 *   1. Validate request format
 *   2. Load attempt (verify ownership, tenant scope)
 *   3. Validate time not exceeded (60s grace period)
 *   4. Acquire pessimistic lock (5s timeout, 3 retries)
 *   5. Validate submission content
 *   6. Store submission (idempotency triple-layer)
 *   7. Update attempt status to SUBMITTED
 *   8. Enqueue grading job
 *   9. Return 202 Accepted with job_id
 *
 * Idempotency:
 *   - Layer 1: Redis cache (fast-path)
 *   - Layer 2: PostgreSQL UNIQUE constraint
 *   - Layer 3: Attempt status check
 *   If replay detected, return cached response
 *
 * Concurrency:
 *   - Pessimistic lock (SELECT...FOR UPDATE NOWAIT)
 *   - 5s timeout, 3 retries with exponential backoff
 *   - 409 CONFLICT if all retries exhausted
 *
 * ---
 *
 * GET /api/workspaces/:slug/attempts/:id/result
 * ============================================
 * Poll for async grading result
 *
 * Headers:
 *   - Authorization: Bearer <jwt>
 *
 * Query Parameters:
 *   - ?job_id=<uuid> (optional, for verification)
 *   - ?poll_timeout=30s (optional)
 *
 * Response When Processing (202 Accepted):
 *   Headers:
 *     - Retry-After: 2 (seconds)
 *
 *   Body:
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "attempt-uuid",
 *       "status": "SUBMITTED",
 *       "job_status": "PENDING|PROCESSING",
 *       "job_id": "job-uuid",
 *       "retry_after_seconds": 2
 *     },
 *     "error": null
 *   }
 *
 * Response When Complete (200 OK):
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "attempt-uuid",
 *       "status": "FINALIZED",
 *       "submitted_at": "2026-02-18T10:35:00Z",
 *       "finalized_at": "2026-02-18T10:36:30Z",
 *       "score": 85.5,
 *       "passed": true,
 *       "result_snapshot": {
 *         "score": 85.5,
 *         "passed": true,
 *         "total_points": 100,
 *         "pass_score": 60,
 *         "question_results": [
 *           {
 *             "question_id": "q-uuid",
 *             "points_earned": 10,
 *             "points_possible": 10,
 *             "feedback": "Correct!",
 *             "explanation": "..."
 *           }
 *         ],
 *         "summary": "Congratulations!"
 *       }
 *     },
 *     "error": null
 *   }
 *
 * Response When Expired (200 OK):
 *   {
 *     "success": true,
 *     "data": {
 *       "id": "attempt-uuid",
 *       "status": "EXPIRED",
 *       "message": "Attempt time limit exceeded"
 *     },
 *     "error": null
 *   }
 *
 * Error Responses:
 *   - 404: Attempt not found
 *   - 409: Attempt not yet submitted (still IN_PROGRESS)
 *   - 410: Attempt was aborted
 *   - 500: Grading failed
 *
 * Polling Pattern:
 *   1. Client calls POST /submit
 *   2. Client receives 202 with job_id
 *   3. Client polls GET /result
 *   4. While status=SUBMITTED, retry with Retry-After delay
 *   5. When status=FINALIZED, retrieve final result
 */
