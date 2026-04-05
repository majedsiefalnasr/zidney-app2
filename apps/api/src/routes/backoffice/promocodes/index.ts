/**
 * Promocodes Router — Index
 *
 * File: apps/api/src/routes/backoffice/promocodes/index.ts
 * Stage: STAGE_45_PROMOCODES
 *
 * Combines all promocode route handlers into a single Hono router.
 * Mounted at /api/v1/backoffice/workspace in app.ts via:
 *   app.route('/api/v1/backoffice/workspace', promocodesRouter)
 *
 * Middleware chain inherited from the backoffice group (app.ts):
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit → authentication
 *
 * Full route table:
 *   GET    /promocodes/analytics        aggregate analytics   PROMOCODES.can_view
 *   POST   /promocodes/validate         validate code         PROMOCODES.can_view  ← rate-limited 10/60s
 *   GET    /promocodes                  list                  PROMOCODES.can_view
 *   POST   /promocodes                  create                PROMOCODES.can_create
 *   GET    /promocodes/:id              detail                PROMOCODES.can_view
 *   POST   /promocodes/:id/deactivate   deactivate            PROMOCODES.can_edit
 *
 * IMPORTANT: /analytics and /validate are registered BEFORE /:id so Hono does not
 * interpret them as UUID path parameters.
 *
 * Constitutional Compliance:
 * ✓ No business logic — delegates to handler functions
 * ✓ All middleware inherited from backoffice group
 * ✓ Per-route RBAC guards enforce permission checks
 * ✓ Rate-limited validate endpoint: 10 req / 60 s per workspace
 */

import { PermissionModule } from '@zidney/domain-core/rbac'
import { createLogger } from '@zidney/logger'
import { Hono } from 'hono'

import { createPermissionGuard } from '../../../middleware/backoffice-permission-guard-v2'
import { RateLimiter } from '../../../middleware/rate-limit.middleware'
import type { BackofficeEnv } from '../types'
import { handleCreatePromocode } from './create-promocode'
import { handleDeactivatePromocode } from './deactivate-promocode'
import { handleGetPromocode } from './get-promocode'
import { handleGetPromocodeAnalytics } from './get-promocode-analytics'
import { handleListPromocodes } from './list-promocodes'
import { handleValidatePromocode } from './validate-promocode'

const logger = createLogger('backoffice-promocodes')

// Module-level rate limiter instance (stateless construction — no Redis dependency at startup)
const validateRateLimiter = new RateLimiter()

export const promocodesRouter = new Hono<BackofficeEnv>()

// ---------------------------------------------------------------------------
// GET /promocodes/analytics — MUST be before /:id
// ---------------------------------------------------------------------------

promocodesRouter.get(
  '/promocodes/analytics',
  createPermissionGuard(logger, PermissionModule.PROMOCODES, 'can_view'),
  handleGetPromocodeAnalytics
)

// ---------------------------------------------------------------------------
// POST /promocodes/validate — MUST be before /:id; rate-limited per workspace
// ---------------------------------------------------------------------------

promocodesRouter.post(
  '/promocodes/validate',
  createPermissionGuard(logger, PermissionModule.PROMOCODES, 'can_view'),
  async (c, next) => {
    const workspaceId = (c.get('workspace_id') as string) ?? 'unknown'
    const limited = await validateRateLimiter.isLimited(
      `promocodes:validate:${workspaceId}`,
      10,
      60
    )
    if (limited) {
      c.header('Retry-After', '60')
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many validation requests. Please try again in a minute.',
          },
          request_id: c.get('request_id') ?? undefined,
        },
        429
      )
    }
    await next()
  },
  handleValidatePromocode
)

// ---------------------------------------------------------------------------
// GET /promocodes — list all
// ---------------------------------------------------------------------------

promocodesRouter.get(
  '/promocodes',
  createPermissionGuard(logger, PermissionModule.PROMOCODES, 'can_view'),
  handleListPromocodes
)

// ---------------------------------------------------------------------------
// POST /promocodes — create
// ---------------------------------------------------------------------------

promocodesRouter.post(
  '/promocodes',
  createPermissionGuard(logger, PermissionModule.PROMOCODES, 'can_create'),
  handleCreatePromocode
)

// ---------------------------------------------------------------------------
// GET /promocodes/:id
// ---------------------------------------------------------------------------

promocodesRouter.get(
  '/promocodes/:id',
  createPermissionGuard(logger, PermissionModule.PROMOCODES, 'can_view'),
  handleGetPromocode
)

// ---------------------------------------------------------------------------
// POST /promocodes/:id/deactivate
// ---------------------------------------------------------------------------

promocodesRouter.post(
  '/promocodes/:id/deactivate',
  createPermissionGuard(logger, PermissionModule.PROMOCODES, 'can_edit'),
  handleDeactivatePromocode
)
