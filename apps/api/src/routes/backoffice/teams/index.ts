/**
 * Teams Router — Index
 *
 * File: apps/api/src/routes/backoffice/teams/index.ts
 * Stage: STAGE_26_TEAMS
 *
 * Central router for all teams-related API endpoints.
 * Routes are registered in strict order to avoid path-parameter conflicts.
 *
 * CRITICAL: /teams/:id/members routes MUST be registered BEFORE /teams/:id
 * so that Hono does not greedily match ":id" with "members".
 */

import { Hono } from 'hono'
import type { BackofficeEnv } from '../types'
import { assignStaffTeamHandler } from './assign-staff-team'
import { createTeamHandler } from './create-team'
import { createTeamTypeHandler } from './create-team-type'
import { deleteTeamHandler } from './delete-team'
import { deleteTeamTypeHandler } from './delete-team-type'
import { getTeamHandler } from './get-team'
import { getTeamMembersHandler } from './get-team-members'
import { getTeamTypeHandler } from './get-team-type'
import { listTeamTypesHandler } from './list-team-types'
import { listTeamsHandler } from './list-teams'
import { removeStaffTeamHandler } from './remove-staff-team'
import { updateTeamHandler } from './update-team'
import { updateTeamTypeHandler } from './update-team-type'

/**
 * Create teams router with all endpoints.
 *
 * Routes mounted under /teams and /team-types
 * (relative to the workspace base, e.g. /api/v1/backoffice/workspace).
 *
 * Route registration order (conflict-safe):
 *  1. /team-types  (collection — no params)
 *  2. /team-types/:id  (detail with param)
 *  3. /teams  (collection — no params)
 *  4. /teams/:id/members  (nested — must precede /teams/:id)
 *  5. /teams/:id  (detail with param)
 */
export function createTeamsRouter(): Hono<BackofficeEnv> {
  const router = new Hono<BackofficeEnv>()

  // -------------------------------------------------------------------------
  // Team Types CRUD
  // -------------------------------------------------------------------------
  router.get('/team-types', listTeamTypesHandler)
  router.post('/team-types', createTeamTypeHandler)
  router.get('/team-types/:id', getTeamTypeHandler)
  router.patch('/team-types/:id', updateTeamTypeHandler)
  router.delete('/team-types/:id', deleteTeamTypeHandler)

  // -------------------------------------------------------------------------
  // Teams CRUD — collection (no params)
  // -------------------------------------------------------------------------
  router.get('/teams', listTeamsHandler)
  router.post('/teams', createTeamHandler)

  // -------------------------------------------------------------------------
  // Team Members — MUST come BEFORE /teams/:id to avoid param collision
  // -------------------------------------------------------------------------
  router.get('/teams/:id/members', getTeamMembersHandler)
  router.post('/teams/:id/members/:staffId', assignStaffTeamHandler)
  router.delete('/teams/:id/members/:staffId', removeStaffTeamHandler)

  // -------------------------------------------------------------------------
  // Teams CRUD — detail (/:id must come AFTER member sub-routes)
  // -------------------------------------------------------------------------
  router.get('/teams/:id', getTeamHandler)
  router.patch('/teams/:id', updateTeamHandler)
  router.delete('/teams/:id', deleteTeamHandler)

  return router
}

// Export router instance.
export const teamsRouter = createTeamsRouter()

// Re-export all handlers for testing.
export {
  listTeamTypesHandler,
  createTeamTypeHandler,
  getTeamTypeHandler,
  updateTeamTypeHandler,
  deleteTeamTypeHandler,
  listTeamsHandler,
  createTeamHandler,
  getTeamHandler,
  updateTeamHandler,
  deleteTeamHandler,
  getTeamMembersHandler,
  assignStaffTeamHandler,
  removeStaffTeamHandler,
}

// Re-export helpers for use by other route modules.
export { buildAuditCtx, getDb, successResponse, teamsErrorResponse } from './helpers'
