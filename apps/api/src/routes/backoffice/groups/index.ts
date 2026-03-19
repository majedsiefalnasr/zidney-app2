/**
 * Groups Router — Index
 *
 * File: apps/api/src/routes/backoffice/groups/index.ts
 * Stage: STAGE_24_GROUPS
 *
 * Central router for all groups-related API endpoints.
 * Registers routes in CRITICAL dependency order to avoid route conflicts.
 */

import { Hono } from 'hono'
import type { BackofficeEnv } from '../../../types'
import { assignStaffGroupHandler } from './assign-staff-group'
import { assignStudentGroupHandler } from './assign-student-group'
import { createGroupHandler } from './create-group'
import { deleteGroupHandler } from './delete-group'
import { getGroupHandler } from './get-group'
import { getStaffGroupsHandler } from './get-staff-groups'
import { getStudentGroupHandler } from './get-student-group'
import { listGroupsHandler } from './list-groups'
import { removeStaffGroupHandler } from './remove-staff-group'
import { removeStudentGroupHandler } from './remove-student-group'
import { updateGroupHandler } from './update-group'

/**
 * Create groups router with all endpoints.
 * Routes are registered in strict order to avoid parameter conflicts.
 *
 * GROUPS CRUD routes are mounted under /groups (relative to workspace base)
 * STUDENT routes: /students/:studentId/group
 * STAFF routes:   /staff/:staffId/groups
 */
export function createGroupsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  // -------------------------------------------------------------------------
  // Groups CRUD — list and create (no params, registered before /:id)
  // -------------------------------------------------------------------------
  router.get('/groups', listGroupsHandler)
  router.post('/groups', createGroupHandler)

  // -------------------------------------------------------------------------
  // Groups CRUD — detail (/:id must come AFTER exact routes)
  // -------------------------------------------------------------------------
  router.get('/groups/:id', getGroupHandler)
  router.patch('/groups/:id', updateGroupHandler)
  router.delete('/groups/:id', deleteGroupHandler)

  // -------------------------------------------------------------------------
  // Student → group assignment  (nested under /students/:studentId)
  // -------------------------------------------------------------------------
  router.put('/students/:studentId/group', assignStudentGroupHandler)
  router.delete('/students/:studentId/group', removeStudentGroupHandler)
  router.get('/students/:studentId/group', getStudentGroupHandler)

  // -------------------------------------------------------------------------
  // Staff → group assignments  (nested under /staff/:staffId)
  // -------------------------------------------------------------------------
  router.get('/staff/:staffId/groups', getStaffGroupsHandler)
  router.post('/staff/:staffId/groups', assignStaffGroupHandler)
  router.delete('/staff/:staffId/groups/:groupId', removeStaffGroupHandler)

  return router
}

// Export router instance
export const groupsRouter = createGroupsRouter()

// Re-export all handlers for testing
export {
  listGroupsHandler,
  createGroupHandler,
  getGroupHandler,
  updateGroupHandler,
  deleteGroupHandler,
  assignStudentGroupHandler,
  removeStudentGroupHandler,
  getStudentGroupHandler,
  getStaffGroupsHandler,
  assignStaffGroupHandler,
  removeStaffGroupHandler,
}

// Re-export helpers for use by other route modules
export { buildAuditCtx, getDb, groupErrorResponse, successResponse } from './helpers'
