/**
 * Divisions Routes — Backoffice Router
 *
 * File: apps/api/src/routes/backoffice/divisions/index.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Combines all division route handlers into a single Hono router.
 * Mounted at /api/v1/backoffice/workspace in app.ts via:
 *   app.route('/api/v1/backoffice/workspace', divisionsRouter)
 *
 * Middleware chain inherited from the backoffice group (app.ts):
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit → authentication
 *
 * Per-route RBAC guards are applied at registration time using:
 *   createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, '<action>')
 *
 * ROUTING ORDER — Critical:
 *   POST /divisions/disable MUST be registered BEFORE POST /divisions (create)
 *   and before GET /divisions/:id to prevent "disable" from being matched as
 *   a UUID path parameter.
 *
 * Full route table:
 *   GET    /divisions                         list         can_view
 *   POST   /divisions/disable                 bulk disable can_delete  ← BEFORE /:id
 *   GET    /divisions/:id                     detail       can_view
 *   POST   /divisions                         create       can_create
 *   PUT    /divisions/:id                     update       can_edit
 *   PATCH  /divisions/:id/status              status       can_edit
 *   DELETE /divisions/:id                     delete       can_delete
 *   GET    /staff/:staffId/divisions          list staff   can_view
 *   POST   /staff/:staffId/divisions          assign       can_edit
 *   DELETE /staff/:staffId/divisions/:divId   remove       can_edit
 *
 * Constitutional Compliance:
 * ✓ No business logic — delegates to handler functions
 * ✓ All middleware inherited from backoffice group
 * ✓ per-route RBAC guards enforce permission checks
 * ✓ Standard Hono<BackofficeEnv> type
 */

import { PermissionModule } from '@zidney/domain-core/rbac'
import { createLogger } from '@zidney/logger'
import { Hono } from 'hono'

import { createPermissionGuard } from '../../../middleware/backoffice-permission-guard-v2'
import type { BackofficeEnv } from '../types'
import { handleDeleteDivision } from './delete-division'
import { handleGetDivision } from './get-detail'
import { handleGetListDivisions } from './get-list'
import { handleUpdateDivisionStatus } from './patch-status'
import { handleCreateDivision } from './post-create'
import { handleDisableDivisions } from './post-disable'
import { handleUpdateDivision } from './put-update'
import {
  handleAssignStaffDivision,
  handleGetStaffDivisions,
  handleRemoveStaffDivision,
} from './staff-divisions'

const logger = createLogger('backoffice-divisions')

export const divisionsRouter = new Hono<BackofficeEnv>()

// ---------------------------------------------------------------------------
// Division CRUD
// ---------------------------------------------------------------------------

/**
 * GET /divisions
 * Lists all divisions with keyset pagination and optional status filter.
 */
divisionsRouter.get(
  '/divisions',
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_view'),
  handleGetListDivisions
)

/**
 * POST /divisions/disable
 * Bulk disables all non-default divisions.
 * MUST be registered BEFORE GET /divisions/:id to prevent routing conflict.
 */
divisionsRouter.post(
  '/divisions/disable',
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_delete'),
  handleDisableDivisions
)

/**
 * GET /divisions/:id
 * Returns a single division by UUID.
 */
divisionsRouter.get(
  '/divisions/:id',
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_view'),
  handleGetDivision
)

/**
 * POST /divisions
 * Creates a new division.
 */
divisionsRouter.post(
  '/divisions',
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_create'),
  handleCreateDivision
)

/**
 * PUT /divisions/:id
 * Replaces name and description of an existing division.
 */
divisionsRouter.put(
  '/divisions/:id',
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_edit'),
  handleUpdateDivision
)

/**
 * PATCH /divisions/:id/status
 * Enables or disables a single division (default division cannot be disabled).
 */
divisionsRouter.patch(
  '/divisions/:id/status',
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_edit'),
  handleUpdateDivisionStatus
)

/**
 * DELETE /divisions/:id
 * Permanently deletes a division that has no students or staff assignments.
 */
divisionsRouter.delete(
  '/divisions/:id',
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_delete'),
  handleDeleteDivision
)

// ---------------------------------------------------------------------------
// Staff–Division Associations
// ---------------------------------------------------------------------------

/**
 * GET /staff/:staffId/divisions
 * Returns all division assignments for a staff member.
 */
divisionsRouter.get(
  '/staff/:staffId/divisions',
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_view'),
  handleGetStaffDivisions
)

/**
 * POST /staff/:staffId/divisions
 * Assigns a staff member to a division (idempotent).
 */
divisionsRouter.post(
  '/staff/:staffId/divisions',
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_edit'),
  handleAssignStaffDivision
)

/**
 * DELETE /staff/:staffId/divisions/:divisionId
 * Removes a staff member's association with a specific division.
 * Requires the staff member to retain at least one division.
 */
divisionsRouter.delete(
  '/staff/:staffId/divisions/:divisionId',
  createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, 'can_edit'),
  handleRemoveStaffDivision
)
