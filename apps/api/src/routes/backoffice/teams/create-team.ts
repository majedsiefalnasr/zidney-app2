/**
 * Create Team — POST /teams
 *
 * File: apps/api/src/routes/backoffice/teams/create-team.ts
 * Stage: STAGE_26_TEAMS
 */

import { createTeam } from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import { createTeamBodySchema } from '@zidney/validation/backoffice/teams.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, successResponse, teamsErrorResponse } from './helpers'

const logger = createLogger('teams-route:create-team')

export async function createTeamHandler(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const parsed = await createTeamBodySchema.parseAsync(body)

    logger.debug('Create team', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      name: parsed.name,
    })

    const row = await createTeam(
      getDb(c),
      {
        name: parsed.name,
        team_type_id: parsed.team_type_id,
        max_members: parsed.max_members,
        description: parsed.description,
      },
      buildAuditCtx(c)
    )

    return c.json(successResponse(row), 201)
  } catch (err) {
    return teamsErrorResponse(c, err)
  }
}
