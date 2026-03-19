/**
 * Get Group — GET /groups/:id
 *
 * File: apps/api/src/routes/backoffice/groups/get-group.ts
 * Stage: STAGE_24_GROUPS
 *
 * Handler for fetching a single group by ID.
 * Validates path parameters via getGroupParamsSchema.
 */

import { getGroupById } from '@zidney/domain-core/groups'
import { createLogger } from '@zidney/logger'
import { getGroupParamsSchema } from '@zidney/validation/backoffice/groups.schemas'
import type { Context } from 'hono'
import { getDb, groupErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-groups-get')

/**
 * GET /groups/:id
 *
 * Path params:
 *   - id: UUID (group ID)
 *
 * Returns: 200 { success: true, data: { Group }, error: null }
 *          404 { success: false, data: null, error: { code: 'GROUP_NOT_FOUND', ... } }
 */
export async function getGroupHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    // Validate path parameters
    const params = await getGroupParamsSchema.parseAsync(c.req.param())

    logger.debug('Get group request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      group_id: params.id,
    })

    const db = getDb(c)

    const group = await getGroupById(db, params.id)

    logger.info('Group fetched successfully', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      group_id: group.id,
    })

    return c.json(successResponse(group), 200)
  } catch (err) {
    return groupErrorResponse(c, err)
  }
}
