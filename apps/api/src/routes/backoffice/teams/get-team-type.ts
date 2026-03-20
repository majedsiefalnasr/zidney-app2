/**
 * Get Team Type — GET /team-types/:id
 *
 * File: apps/api/src/routes/backoffice/teams/get-team-type.ts
 * Stage: STAGE_26_TEAMS
 */

import { getTeamTypeById } from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import { teamTypeParamsSchema } from '@zidney/validation/backoffice/teams.schemas'
import type { Context } from 'hono'
import { getDb, successResponse, teamsErrorResponse } from './helpers'

const logger = createLogger('teams-route:get-team-type')

export async function getTeamTypeHandler(c: Context) {
  try {
    const { id } = await teamTypeParamsSchema.parseAsync(c.req.param())

    logger.debug('Get team type', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      team_type_id: id,
    })

    const row = await getTeamTypeById(getDb(c), id)
    return c.json(successResponse(row), 200)
  } catch (err) {
    return teamsErrorResponse(c, err)
  }
}
