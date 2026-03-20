/**
 * Update Team — PATCH /teams/:id
 *
 * File: apps/api/src/routes/backoffice/teams/update-team.ts
 * Stage: STAGE_26_TEAMS
 */

import { updateTeam } from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import { teamParamsSchema, updateTeamBodySchema } from '@zidney/validation/backoffice/teams.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, successResponse, teamsErrorResponse } from './helpers'

const logger = createLogger('teams-route:update-team')

export async function updateTeamHandler(c: Context) {
  try {
    const { id } = await teamParamsSchema.parseAsync(c.req.param())
    const body = await c.req.json().catch(() => ({}))
    const parsed = await updateTeamBodySchema.parseAsync(body)

    logger.debug('Update team', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      team_id: id,
    })

    const row = await updateTeam(
      getDb(c),
      id,
      {
        name: parsed.name,
        team_type_id: parsed.team_type_id,
        max_members: parsed.max_members,
        description: parsed.description,
        status: parsed.status,
      },
      buildAuditCtx(c)
    )

    return c.json(successResponse(row), 200)
  } catch (err) {
    return teamsErrorResponse(c, err)
  }
}
