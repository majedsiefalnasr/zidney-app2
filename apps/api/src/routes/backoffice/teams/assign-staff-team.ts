/**
 * Assign Staff to Team — POST /teams/:id/members/:staffId
 *
 * File: apps/api/src/routes/backoffice/teams/assign-staff-team.ts
 * Stage: STAGE_26_TEAMS
 */

import { assignStaffToTeam } from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import { teamMemberParamsSchema } from '@zidney/validation/backoffice/teams.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, successResponse, teamsErrorResponse } from './helpers'

const logger = createLogger('teams-route:assign-staff-team')

export async function assignStaffTeamHandler(c: Context) {
  try {
    const { id: teamId, staffId } = await teamMemberParamsSchema.parseAsync(c.req.param())

    logger.debug('Assign staff to team', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      team_id: teamId,
      staff_id: staffId,
    })

    const assignment = await assignStaffToTeam(getDb(c), teamId, staffId, buildAuditCtx(c))

    return c.json(successResponse(assignment), 201)
  } catch (err) {
    return teamsErrorResponse(c, err)
  }
}
