/**
 * Delete Team — DELETE /teams/:id
 *
 * File: apps/api/src/routes/backoffice/teams/delete-team.ts
 * Stage: STAGE_26_TEAMS
 */

import { deleteTeam } from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import { teamParamsSchema } from '@zidney/validation/backoffice/teams.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, successResponse, teamsErrorResponse } from './helpers'

const logger = createLogger('teams-route:delete-team')

export async function deleteTeamHandler(c: Context) {
  try {
    const { id } = await teamParamsSchema.parseAsync(c.req.param())

    logger.debug('Delete team', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      team_id: id,
    })

    await deleteTeam(getDb(c), id, buildAuditCtx(c))

    return c.json(successResponse({ deleted: true }), 200)
  } catch (err) {
    return teamsErrorResponse(c, err)
  }
}
