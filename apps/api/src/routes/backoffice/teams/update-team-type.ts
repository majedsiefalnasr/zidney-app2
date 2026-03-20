/**
 * Update Team Type — PATCH /team-types/:id
 *
 * File: apps/api/src/routes/backoffice/teams/update-team-type.ts
 * Stage: STAGE_26_TEAMS
 */

import { updateTeamType } from '@zidney/domain-core/teams'
import { createLogger } from '@zidney/logger'
import {
  teamTypeParamsSchema,
  updateTeamTypeBodySchema,
} from '@zidney/validation/backoffice/teams.schemas'
import type { Context } from 'hono'
import { buildAuditCtx, getDb, successResponse, teamsErrorResponse } from './helpers'

const logger = createLogger('teams-route:update-team-type')

export async function updateTeamTypeHandler(c: Context) {
  try {
    const { id } = await teamTypeParamsSchema.parseAsync(c.req.param())
    const body = await c.req.json().catch(() => ({}))
    const parsed = await updateTeamTypeBodySchema.parseAsync(body)

    logger.debug('Update team type', {
      correlation_id: c.get('correlation_id'),
      workspace_id: c.get('workspace_id'),
      team_type_id: id,
    })

    const row = await updateTeamType(
      getDb(c),
      id,
      {
        name: parsed.name,
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
