/**
 * Students Router — Index
 *
 * File: apps/api/src/routes/backoffice/students/index.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 *
 * Combines all student route handlers into a single Hono router.
 * Mounted at /api/v1/backoffice/workspace in app.ts via:
 *   app.route('/api/v1/backoffice/workspace', studentsRouter)
 *
 * Middleware chain inherited from the backoffice group (app.ts):
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit → authentication
 *
 * ROUTING ORDER — Critical:
 *   POST /students/bulk-import MUST be registered BEFORE /students/:id (avoids :id = "bulk-import")
 *   PATCH /:id/disable, PATCH /:id/enable, PATCH /:id/subscription BEFORE PATCH /:id
 *   DELETE /:id BEFORE GET /:id
 *
 * Full route table:
 *   POST   /students/bulk-import        bulk import  can_create  ← BEFORE /:id
 *   POST   /students                    create       can_create
 *   GET    /students                    list         can_view
 *   PATCH  /students/:id/disable        disable      can_edit    ← BEFORE /:id
 *   PATCH  /students/:id/enable         enable       can_edit    ← BEFORE /:id
 *   PATCH  /students/:id/subscription   subscription can_edit    ← BEFORE /:id
 *   DELETE /students/:id                delete       can_delete
 *   GET    /students/:id                detail       can_view
 *   PATCH  /students/:id                update       can_edit
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
import { handleBulkImportStudents } from './bulk-import-students'
import { handleCreateStudent } from './create-student'
import { handleDeleteStudent } from './delete-student'
import { handleDisableStudent } from './disable-student'
import { handleEnableStudent } from './enable-student'
import { handleGetStudent } from './get-student'
import { handleListStudents } from './list-students'
import { handleUpdateStudent } from './update-student'
import { handleUpdateStudentSubscription } from './update-student-subscription'

const logger = createLogger('backoffice-students')

export const studentsRouter = new Hono<BackofficeEnv>()

// ---------------------------------------------------------------------------
// Bulk import (BEFORE /:id to prevent "bulk-import" matching as :id)
// ---------------------------------------------------------------------------

studentsRouter.post(
  '/students/bulk-import',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_create'),
  handleBulkImportStudents
)

// ---------------------------------------------------------------------------
// Create student
// ---------------------------------------------------------------------------

studentsRouter.post(
  '/students',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_create'),
  handleCreateStudent
)

// ---------------------------------------------------------------------------
// List students
// ---------------------------------------------------------------------------

studentsRouter.get(
  '/students',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_view'),
  handleListStudents
)

// ---------------------------------------------------------------------------
// Disable student (BEFORE /:id to avoid route conflict)
// ---------------------------------------------------------------------------

studentsRouter.patch(
  '/students/:id/disable',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_edit'),
  handleDisableStudent
)

// ---------------------------------------------------------------------------
// Enable student (BEFORE /:id to avoid route conflict)
// ---------------------------------------------------------------------------

studentsRouter.patch(
  '/students/:id/enable',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_edit'),
  handleEnableStudent
)

// ---------------------------------------------------------------------------
// Update subscription status (BEFORE /:id to avoid route conflict)
// ---------------------------------------------------------------------------

studentsRouter.patch(
  '/students/:id/subscription',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_edit'),
  handleUpdateStudentSubscription
)

// ---------------------------------------------------------------------------
// Delete student
// ---------------------------------------------------------------------------

studentsRouter.delete(
  '/students/:id',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_delete'),
  handleDeleteStudent
)

// ---------------------------------------------------------------------------
// Get student by ID
// ---------------------------------------------------------------------------

studentsRouter.get(
  '/students/:id',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_view'),
  handleGetStudent
)

// ---------------------------------------------------------------------------
// Update student
// ---------------------------------------------------------------------------

studentsRouter.patch(
  '/students/:id',
  createPermissionGuard(logger, PermissionModule.USERS, 'can_edit'),
  handleUpdateStudent
)
