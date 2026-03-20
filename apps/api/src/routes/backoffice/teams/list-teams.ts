/**
 * List Teams — GET /teams
 *
 * File: apps/api/src/routes/backoffice/teams/list-teams.ts
 * Stage: STAGE_26_TEAMS
 */

import { listTeams } from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import { listTeamsQuerySchema } from '@zidney/validation/backoffice/teams.schemas'
import type { Context } from 'hono'
import { getDb, successResponse, teamsErrorResponse } from './helpers'

const logger = createLogger('teams-route:list-teams')

export async function listTeamsHandler(c: Context) {
  try {
    const parsed = await listTeamsQuerySchema.parseAsync(c.req.query())

    logger.debug('List teams', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      limit: parsed.limit,
      cursor: parsed.cursor,
      status: parsed.status,
      team_type_id: parsed.team_type_id,
    })

    const result = await listTeams(getDb(c), {
      limit: parsed.limit,
      cursor: parsed.cursor,
      status: parsed.status,
      team_type_id: parsed.team_type_id,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return teamsErrorResponse(c, err)
  }
}
