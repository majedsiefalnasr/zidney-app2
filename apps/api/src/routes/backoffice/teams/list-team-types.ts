/**
 * List Team Types — GET /team-types
 *
 * File: apps/api/src/routes/backoffice/teams/list-team-types.ts
 * Stage: STAGE_26_TEAMS
 */

import { listTeamTypes } from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import { listTeamTypesQuerySchema } from '@zidney/validation/backoffice/teams.schemas'
import type { Context } from 'hono'
import { getDb, successResponse, teamsErrorResponse } from './helpers'

const logger = createLogger('teams-route:list-team-types')

export async function listTeamTypesHandler(c: Context) {
  try {
    const parsed = await listTeamTypesQuerySchema.parseAsync(c.req.query())

    logger.debug('List team types', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      limit: parsed.limit,
      cursor: parsed.cursor,
      status: parsed.status,
    })

    const result = await listTeamTypes(getDb(c), {
      limit: parsed.limit,
      cursor: parsed.cursor,
      status: parsed.status,
    })

    return c.json(successResponse(result), 200)
  } catch (err) {
    return teamsErrorResponse(c, err)
  }
}
