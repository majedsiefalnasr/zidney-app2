/**
 * Plans Router — Index
 *
 * File: apps/api/src/routes/backoffice/plans/index.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * Combines all plan route handlers into a single Hono router.
 * Mounted at /api/v1/backoffice/workspace in app.ts via:
 *   app.route('/api/v1/backoffice/workspace', plansRouter)
 *
 * Middleware chain inherited from the backoffice group (app.ts):
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit → authentication
 *
 * Full route table:
 *   POST   /plans          create   PLANS.can_create
 *   GET    /plans          list     PLANS.can_view
 *   GET    /plans/:id      detail   PLANS.can_view
 *   PATCH  /plans/:id      update   PLANS.can_edit
 *   DELETE /plans/:id      delete   PLANS.can_delete
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
import { handleCreatePlan } from './create-plan'
import { handleDeletePlan } from './delete-plan'
import { handleGetPlan } from './get-plan'
import { handleListPlans } from './list-plans'
import { handleUpdatePlan } from './update-plan'

const logger = createLogger('backoffice-plans')

export const plansRouter = new Hono<BackofficeEnv>()

// ---------------------------------------------------------------------------
// Create plan
// ---------------------------------------------------------------------------

plansRouter.post(
  '/plans',
  createPermissionGuard(logger, PermissionModule.PLANS, 'can_create'),
  handleCreatePlan
)

// ---------------------------------------------------------------------------
// List plans
// ---------------------------------------------------------------------------

plansRouter.get(
  '/plans',
  createPermissionGuard(logger, PermissionModule.PLANS, 'can_view'),
  handleListPlans
)

// ---------------------------------------------------------------------------
// Get plan by ID
// ---------------------------------------------------------------------------

plansRouter.get(
  '/plans/:id',
  createPermissionGuard(logger, PermissionModule.PLANS, 'can_view'),
  handleGetPlan
)

// ---------------------------------------------------------------------------
// Update plan
// ---------------------------------------------------------------------------

plansRouter.patch(
  '/plans/:id',
  createPermissionGuard(logger, PermissionModule.PLANS, 'can_edit'),
  handleUpdatePlan
)

// ---------------------------------------------------------------------------
// Delete plan (soft delete)
// ---------------------------------------------------------------------------

plansRouter.delete(
  '/plans/:id',
  createPermissionGuard(logger, PermissionModule.PLANS, 'can_delete'),
  handleDeletePlan
)
