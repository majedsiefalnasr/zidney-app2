/**
 * Get Team — GET /teams/:id
 *
 * File: apps/api/src/routes/backoffice/teams/get-team.ts
 * Stage: STAGE_26_TEAMS
 */

import { getTeamById } from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import { teamParamsSchema } from '@zidney/validation/backoffice/teams.schemas'
import type { Context } from 'hono'
import { getDb, successResponse, teamsErrorResponse } from './helpers'

const logger = createLogger('teams-route:get-team')

export async function getTeamHandler(c: Context) {
  try {
    const { id } = await teamParamsSchema.parseAsync(c.req.param())

    logger.debug('Get team', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      team_id: id,
    })

    const row = await getTeamById(getDb(c), id)
    return c.json(successResponse(row), 200)
  } catch (err) {
    return teamsErrorResponse(c, err)
  }
}
