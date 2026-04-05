/**
 * Subscriptions Router — Index
 *
 * File: apps/api/src/routes/backoffice/subscriptions/index.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * Combines all subscription route handlers into a single Hono router.
 * Mounted at /api/v1/backoffice/workspace in app.ts via:
 *   app.route('/api/v1/backoffice/workspace', subscriptionsRouter)
 *
 * Middleware chain inherited from the backoffice group (app.ts):
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit → authentication
 *
 * Full route table:
 *   POST   /subscriptions        activate    SUBSCRIPTIONS.can_create
 *   GET    /subscriptions        list        SUBSCRIPTIONS.can_view
 *   GET    /subscriptions/:id    detail      SUBSCRIPTIONS.can_view
 *   PATCH  /subscriptions/:id/cancel cancel SUBSCRIPTIONS.can_edit
 *
 * Constitutional Compliance:
 * ✓ No business logic — delegates to handler functions
 * ✓ All middleware inherited from backoffice group
 * ✓ Per-route RBAC guards enforce permission checks
 */

import { PermissionModule } from '@zidney/domain-core/rbac'
import { createLogger } from '@zidney/logger'
import { Hono } from 'hono'

import { createPermissionGuard } from '../../../middleware/backoffice-permission-guard-v2'
import type { BackofficeEnv } from '../types'
import { handleActivateSubscription } from './activate-subscription'
import { handleCancelSubscription } from './cancel-subscription'
import { handleGetSubscription } from './get-subscription'
import { handleListSubscriptions } from './list-subscriptions'

const logger = createLogger('backoffice-subscriptions')

export const subscriptionsRouter = new Hono<BackofficeEnv>()

// ---------------------------------------------------------------------------
// Activate subscription (create)
// ---------------------------------------------------------------------------

subscriptionsRouter.post(
  '/subscriptions',
  createPermissionGuard(logger, PermissionModule.SUBSCRIPTIONS, 'can_create'),
  handleActivateSubscription
)

// ---------------------------------------------------------------------------
// List subscriptions
// ---------------------------------------------------------------------------

subscriptionsRouter.get(
  '/subscriptions',
  createPermissionGuard(logger, PermissionModule.SUBSCRIPTIONS, 'can_view'),
  handleListSubscriptions
)

// ---------------------------------------------------------------------------
// Get subscription by ID
// ---------------------------------------------------------------------------

subscriptionsRouter.get(
  '/subscriptions/:id',
  createPermissionGuard(logger, PermissionModule.SUBSCRIPTIONS, 'can_view'),
  handleGetSubscription
)

// ---------------------------------------------------------------------------
// Cancel subscription
// ---------------------------------------------------------------------------

subscriptionsRouter.patch(
  '/subscriptions/:id/cancel',
  createPermissionGuard(logger, PermissionModule.SUBSCRIPTIONS, 'can_edit'),
  handleCancelSubscription
)
