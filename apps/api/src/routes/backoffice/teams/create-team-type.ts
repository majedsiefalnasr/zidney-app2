/**
 * Create Team Type — POST /team-types
 *
 * File: apps/api/src/routes/backoffice/teams/create-team-type.ts
 * Stage: STAGE_26_TEAMS
 */

import { createTeamType } from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import { createTeamTypeBodySchema } from '@zidney/validation/backoffice/teams.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, successResponse, teamsErrorResponse } from './helpers'

const logger = createLogger('teams-route:create-team-type')

export async function createTeamTypeHandler(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const parsed = await createTeamTypeBodySchema.parseAsync(body)

    logger.debug('Create team type', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      name: parsed.name,
    })

    const row = await createTeamType(
      getDb(c),
      { name: parsed.name, description: parsed.description },
      buildAuditCtx(c)
    )

    return c.json(successResponse(row), 201)
  } catch (err) {
    return teamsErrorResponse(c, err)
  }
}
