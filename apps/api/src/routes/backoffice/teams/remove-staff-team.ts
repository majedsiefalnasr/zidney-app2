/**
 * Remove Staff from Team — DELETE /teams/:id/members/:staffId
 *
 * File: apps/api/src/routes/backoffice/teams/remove-staff-team.ts
 * Stage: STAGE_26_TEAMS
 */

import { removeStaffFromTeam } from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import { teamMemberParamsSchema } from '@zidney/validation/backoffice/teams.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, successResponse, teamsErrorResponse } from './helpers'

const logger = createLogger('teams-route:remove-staff-team')

export async function removeStaffTeamHandler(c: Context) {
  try {
    const { id: teamId, staffId } = await teamMemberParamsSchema.parseAsync(c.req.param())

    logger.debug('Remove staff from team', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      team_id: teamId,
      staff_id: staffId,
    })

    await removeStaffFromTeam(getDb(c), teamId, staffId, buildAuditCtx(c))

    return c.json(successResponse({ removed: true }), 200)
  } catch (err) {
    return teamsErrorResponse(c, err)
  }
}
