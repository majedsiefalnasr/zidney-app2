/**
 * Get Staff Groups — GET /staff/:staffId/groups
 *
 * File: apps/api/src/routes/backoffice/groups/get-staff-groups.ts
 * Stage: STAGE_24_GROUPS
 *
 * Handler for fetching all groups a staff member belongs to.
 */

import { getStaffGroups } from '@zidney/domain-core/groups'
import { createLogger } from '@zidney/logger'
import { staffGroupParamsSchema } from '@zidney/validation/backoffice/groups.schemas'
import type { Context } from 'hono'
import { getDb, groupErrorResponse, successResponse } from './helpers'

const logger = createLogger('backoffice-groups-get-staff')

/**
 * GET /staff/:staffId/groups
 *
 * Path params:
 *   - staffId: UUID
 *
 * Returns: 200 { success: true, data: GroupRow[], error: null }
 *
 * Errors:
 *   - 404 STAFF_NOT_FOUND
 */
export async function getStaffGroupsHandler(c: Context) {
  try {
    const correlationId = c.get('correlation_id')
    const workspaceId = c.get('workspace_id')

    // Validate path params
    const params = await staffGroupParamsSchema.parseAsync(c.req.param())

    logger.debug('Get staff groups request', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      staff_id: params.staffId,
    })

    const db = getDb(c)

    const groups = await getStaffGroups(db, params.staffId)

    logger.info('Staff groups fetched', {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      staff_id: params.staffId,
      count: groups.length,
    })

    return c.json(successResponse(groups), 200)
  } catch (err) {
    return groupErrorResponse(c, err)
  }
}
