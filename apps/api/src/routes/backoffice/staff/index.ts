/**
 * Staff Router — Index
 *
 * File: apps/api/src/routes/backoffice/staff/index.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 *
 * Combines all staff route handlers into a single Hono router.
 * Mounted at /api/v1/backoffice/workspace in app.ts via:
 *   app.route('/api/v1/backoffice/workspace', staffRouter)
 *
 * Middleware chain inherited from the backoffice group (app.ts):
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit → authentication
 *
 * Per-route RBAC guards are applied at registration time using:
 *   createPermissionGuard(logger, PermissionModule.USERS, '<action>')
 *
 * ROUTING ORDER — Critical:
 *   PATCH /:id/disable MUST be registered BEFORE PATCH /:id/enable and
 *   all /:id routes to prevent partial-path match ambiguity.
 *   DELETE /:id BEFORE GET /:id and PUT /:id.
 *   POST / and GET / last (no path param conflict).
 *
 * Full route table:
 *   GET    /staff                  list      can_view
 *   POST   /staff                  create    can_create
 *   PATCH  /staff/:id/disable      disable   can_edit   ← BEFORE /:id
 *   PATCH  /staff/:id/enable       enable    can_edit   ← BEFORE /:id
 *   DELETE /staff/:id              delete    can_delete
 *   GET    /staff/:id              detail    can_view
 *   PUT    /staff/:id              update    can_edit
 *
 * Constitutional Compliance:
 * ✓ No business logic — delegates to handler functions
 * ✓ All middleware inherited from backoffice group
 * ✓ Per-route RBAC guards enforce permission checks
 * ✓ Standard Hono<BackofficeEnv> type
 */

import { PermissionModule } from '@zidney/domain-core/rbac'
import { createLogger } from '@zidney/logger'
import { Hono } from 'hono'

import { createPermissionGuard } from '../../../middleware/backoffice-permission-guard-v2'
import type { BackofficeEnv } from '../types'
import { handleCreateStaff } from './create-staff'
import { handleDeleteStaff } from './delete-staff'
import { handleDisableStaff } from './disable-staff'
import { handleEnableStaff } from './enable-staff'
import { handleGetStaff } from './get-staff'
import { handleListStaff } from './list-staff'
import { handleUpdateStaff } from './update-staff'

const logger = createLogger('backoffice-staff')

export const staffRouter = new Hono<BackofficeEnv>()

// ---------------------------------------------------------------------------
// List staff
// ---------------------------------------------------------------------------

staffRouter.get(
  '/staff',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_view'),
  handleListStaff
)

// ---------------------------------------------------------------------------
// Create staff
// ---------------------------------------------------------------------------

staffRouter.post(
  '/staff',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_create'),
  handleCreateStaff
)

// ---------------------------------------------------------------------------
// Disable staff (BEFORE /:id to avoid route conflict)
// ---------------------------------------------------------------------------

staffRouter.patch(
  '/staff/:id/disable',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_edit'),
  handleDisableStaff
)

// ---------------------------------------------------------------------------
// Enable staff (BEFORE /:id to avoid route conflict)
// ---------------------------------------------------------------------------

staffRouter.patch(
  '/staff/:id/enable',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_edit'),
  handleEnableStaff
)

// ---------------------------------------------------------------------------
// Delete staff
// ---------------------------------------------------------------------------

staffRouter.delete(
  '/staff/:id',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_delete'),
  handleDeleteStaff
)

// ---------------------------------------------------------------------------
// Get staff by ID
// ---------------------------------------------------------------------------

staffRouter.get(
  '/staff/:id',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_view'),
  handleGetStaff
)

// ---------------------------------------------------------------------------
// Update staff
// ---------------------------------------------------------------------------

staffRouter.put(
  '/staff/:id',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_edit'),
  handleUpdateStaff
)
