/**
 * Get Team Members — GET /teams/:id/members
 *
 * File: apps/api/src/routes/backoffice/teams/get-team-members.ts
 * Stage: STAGE_26_TEAMS
 */

import { listTeamMembers } from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import {
  listTeamMembersQuerySchema,
  teamParamsSchema,
} from '@zidney/validation/backoffice/teams.schemas'
import type { Context } from 'hono'
import { getDb, successResponse, teamsErrorResponse } from './helpers'

const logger = createLogger('teams-route:get-team-members')

export async function getTeamMembersHandler(c: Context) {
  try {
    const { id } = await teamParamsSchema.parseAsync(c.req.param())
    const parsed = await listTeamMembersQuerySchema.parseAsync(c.req.query())

    logger.debug('Get team members', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      team_id: id,
      limit: parsed.limit,
      cursor: parsed.cursor,
    })

    const result = await listTeamMembers(getDb(c), id, {
      limit: parsed.limit,
      cursor: parsed.cursor,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return teamsErrorResponse(c, err)
  }
}
