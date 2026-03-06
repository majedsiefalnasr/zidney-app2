/**
 * Workflow Routes — Backoffice Router
 *
 * File: apps/api/src/routes/backoffice/workflow/index.ts
 * Stage: STAGE_20_STATUS_WORKFLOW_ENGINE
 * Date: 2026-03-01
 *
 * Combines workflow route handlers into a single Hono router.
 * Mounted at /api/v1/backoffice/workspace/workflow in app.ts.
 *
 * Middleware chain is absorbed from the backoffice group:
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit(60 global) → authentication
 *
 * Workflow-specific rate limit: 20 transitions/actor/entityType/minute.
 * Key pattern: workflow-transition:{actorId}:{entityType}
 * Applied before the handler to prevent engine invocation on breach.
 *
 * Constitutional Compliance:
 * ✓ No business logic — delegates to handler functions
 * ✓ All middleware inherited from backoffice group
 * ✓ Standard Hono<BackofficeEnv> type
 * ✓ Rate limiting enforced at API layer (FR-018)
 */

import { Hono } from 'hono'

import { createRateLimiter } from '../../../middleware/rate-limit.middleware'
import type { BackofficeEnv } from '../types'
import { handlePostTransition } from './post-transition'

export const workflowRouter = new Hono<BackofficeEnv>()

// -------------------------------------------------------------------------
// Workflow-specific rate limiter — 20 transitions/actor/entityType/minute
// Key: workflow-transition:{actorId}:{entityType}
// Applied before the handler — engine never reached on 429
// -------------------------------------------------------------------------
const workflowRateLimiter = createRateLimiter()
const WORKFLOW_RATE_LIMIT_MAX = 20
const WORKFLOW_RATE_LIMIT_WINDOW_SEC = 60

workflowRouter.use('/workflow/:entityType/:entityId/transition', async (c, next) => {
  const staffUser = c.get('staff_user')
  const entityType = c.req.param('entityType')
  const actorId = staffUser?.user_id ?? 'anonymous'
  const correlationId = c.get('correlationId') ?? c.req.header('x-correlation-id') ?? 'unknown'

  const key = `workflow-transition:${actorId}:${entityType}`
  const isLimited = await workflowRateLimiter.isLimited(
    key,
    WORKFLOW_RATE_LIMIT_MAX,
    WORKFLOW_RATE_LIMIT_WINDOW_SEC
  )

  if (isLimited) {
    c.header('Retry-After', String(WORKFLOW_RATE_LIMIT_WINDOW_SEC))
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'rate_limit_exceeded',
          message: `Rate limit exceeded. Maximum ${WORKFLOW_RATE_LIMIT_MAX} workflow transitions per ${WORKFLOW_RATE_LIMIT_WINDOW_SEC}s per actor per entity type.`,
          details: null,
          correlationId,
        },
      },
      429
    )
  }

  await next()
})

/**
 * POST /workflow/:entityType/:entityId/transition
 * Perform a state transition on any workflow-enabled entity.
 */
workflowRouter.post('/workflow/:entityType/:entityId/transition', handlePostTransition)
