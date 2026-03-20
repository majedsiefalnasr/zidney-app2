/**
 * Delete Team Type — DELETE /team-types/:id
 *
 * File: apps/api/src/routes/backoffice/teams/delete-team-type.ts
 * Stage: STAGE_26_TEAMS
 */

import { deleteTeamType } from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import { teamTypeParamsSchema } from '@zidney/validation/backoffice/teams.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, successResponse, teamsErrorResponse } from './helpers'

const logger = createLogger('teams-route:delete-team-type')

export async function deleteTeamTypeHandler(c: Context) {
  try {
    const { id } = await teamTypeParamsSchema.parseAsync(c.req.param())

    logger.debug('Delete team type', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      team_type_id: id,
    })

    await deleteTeamType(getDb(c), id, buildAuditCtx(c))

    return c.json(successResponse({ deleted: true }), 200)
  } catch (err) {
    return teamsErrorResponse(c, err)
  }
}
